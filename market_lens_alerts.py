"""
NSE Market Lens browser monitor -> Telegram alerts.

This monitors the visible screener results in a locally controlled browser.
It does NOT bypass login, CAPTCHAs, or access controls. You log in yourself.
The site's page structure can change; selectors may need adjustment.
"""
import json
import os
import re
import time
import logging
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()
THRESHOLD_PERCENT = float(os.getenv("THRESHOLD_PERCENT", "10"))
ALLOW_REPEAT_ALERTS = os.getenv("ALLOW_REPEAT_ALERTS", "false").strip().lower() == "true"
CHECK_EVERY_SECONDS = int(os.getenv("CHECK_EVERY_SECONDS", "300"))
SCREENER_URL = os.getenv("SCREENER_URL", "").strip()
HEADLESS = os.getenv("HEADLESS", "false").strip().lower() == "true"
AUTO_START = os.getenv("AUTO_START", "false").strip().lower() == "true"
RUN_ONCE = os.getenv("RUN_ONCE", "false").strip().lower() == "true"
SEND_STARTUP_MESSAGE = os.getenv("SEND_STARTUP_MESSAGE", "true").strip().lower() == "true"
PROFILE_DIR = ROOT / "browser_profile"
STATE_FILE = ROOT / "alerts_sent.json"
IST = ZoneInfo("Asia/Kolkata")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(ROOT / "crawler.log", encoding="utf-8"),
    ],
)

def send_telegram(text):
    if not BOT_TOKEN or not CHAT_ID:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env")
    r = requests.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        json={"chat_id": CHAT_ID, "text": text},
        timeout=20,
    )
    r.raise_for_status()
    payload = r.json()
    if not payload.get("ok"):
        raise RuntimeError(f"Telegram error: {payload}")

def load_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        logging.exception("Alert state file is invalid; starting fresh")
        return {}

def save_state(state):
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)

def parse_percent(text):
    # Supports "+17.31%", "−2.34%", "-2.34%", and "2.34%".
    m = re.search(r"([+\-−]?\s*\d+(?:,\d{3})*(?:\.\d+)?)\s*%", text)
    if not m:
        return None
    return float(m.group(1).replace(",", "").replace(" ", "").replace("−", "-"))

def parse_visible_metrics(text):
    """Parse extra metrics visible in a rendered Market Lens row."""
    percent_texts = re.findall(r"[+\-âˆ’]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*%", text)
    percent_values = [parse_percent(value) for value in percent_texts]
    metrics = {
        "1d_return": percent_values[0] if len(percent_values) > 0 else None,
        "1w_return": percent_values[1] if len(percent_values) > 1 else None,
        "1m_return": percent_values[2] if len(percent_values) > 2 else None,
    }

    market_cap_match = re.search(
        r"(?<![\w%])(\d[\d,]*(?:\.\d+)?)\s*(Cr|Crore|Lakhs?|Million|Billion)\b",
        text,
        re.IGNORECASE,
    )
    if market_cap_match:
        metrics["market_cap"] = f"{market_cap_match.group(1)} {market_cap_match.group(2)}"
        after_market_cap = text[market_cap_match.end():]
        volume_match = re.search(r"\b\d[\d,]{2,}\b", after_market_cap)
        if volume_match:
            metrics["volume"] = volume_match.group(0)

    pe_match = re.search(r"(?<![\w%])(\d+(?:\.\d+)?)\s*$", text)
    if pe_match:
        metrics["pe_ratio"] = pe_match.group(1)
    return metrics

def format_alert_metrics(item):
    metrics = item.get("metrics", {})
    lines = [
        f"1D RETURN: {item['change']:+.2f}%",
        f"1W RETURN: {metrics['1w_return']:+.2f}%" if metrics.get("1w_return") is not None else "1W RETURN: n/a",
        f"1M RETURN: {metrics['1m_return']:+.2f}%" if metrics.get("1m_return") is not None else "1M RETURN: n/a",
    ]
    if metrics.get("market_cap"):
        lines.append(f"Market cap: {metrics['market_cap']}")
    if metrics.get("volume"):
        lines.append(f"Volume: {metrics['volume']}")
    if metrics.get("pe_ratio"):
        lines.append(f"P/E: {metrics['pe_ratio']}")
    return "\n".join(lines)

def extract_rows(page):
    """
    Read rendered rows. Prefer accessible grid/table rows; use a text fallback
    for custom div-based tables. The fallback expects each company ticker to
    appear as a standalone line, as in the Market Lens screenshot.
    """
    rows = []
    for selector in ['[role="row"]', "tr"]:
        try:
            loc = page.locator(selector)
            count = min(loc.count(), 500)
            candidates = []
            for i in range(count):
                txt = " ".join(loc.nth(i).inner_text(timeout=1500).split())
                if txt and "%" in txt:
                    candidates.append(txt)
            if candidates:
                rows = candidates
                break
        except Exception:
            pass

    if rows:
        parsed = []
        for txt in rows:
            # In the Market Lens grid, return percentages are usually in order:
            # 1D Return, 1W Return, 1M Return.
            percents = re.findall(r"[+\-−]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*%", txt)
            if not percents:
                continue
            # Ignore header rows and parse company/ticker from row text.
            ticker_match = re.search(r"\b([A-Z][A-Z0-9&.\-]{1,19})\b", txt)
            if not ticker_match:
                continue
            ticker = ticker_match.group(1)
            change = parse_percent(percents[0])
            if change is None:
                continue
            parsed.append(
                {
                    "ticker": ticker,
                    "row": txt,
                    "change": change,
                    "metrics": parse_visible_metrics(txt),
                }
            )
        if parsed:
            return parsed

    # Fallback: parse body lines. This is intentionally conservative.
    lines = page.locator("body").inner_text(timeout=5000).splitlines()
    lines = [x.strip() for x in lines if x.strip()]
    parsed = []
    for i, line in enumerate(lines):
        # In screenshot each symbol appears under company name on its own line.
        if re.fullmatch(r"[A-Z][A-Z0-9&.\-]{1,19}", line):
            context = " ".join(lines[i:i+12])
            if "%" not in context:
                continue
            pct_lines = re.findall(r"[+\-−]?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*%", context)
            if not pct_lines:
                continue
            change = parse_percent(pct_lines[0])
            if change is not None:
                parsed.append(
                    {
                        "ticker": line,
                        "row": context,
                        "change": change,
                        "metrics": parse_visible_metrics(context),
                    }
                )
    # Deduplicate symbols, keeping the first matching row.
    out = {}
    for item in parsed:
        out[item["ticker"]] = item
    return list(out.values())

def ensure_1d_return_descending(page):
    """Set the screener's 1D RETURN column to high-to-low order."""
    header = page.locator(
        '[role="columnheader"]',
        has_text=re.compile(r"\b1D\s+RETURN\b", re.IGNORECASE),
    ).first
    if header.count() == 0:
        header = page.locator(
            "th",
            has_text=re.compile(r"\b1D\s+RETURN\b", re.IGNORECASE),
        ).first
    if header.count() == 0:
        header = page.get_by_text("1D RETURN", exact=True).first
    if header.count() == 0:
        logging.warning("Could not find the 1D RETURN column header to sort it")
        return False

    aria_sort = (header.get_attribute("aria-sort") or "").lower()
    if aria_sort == "descending":
        logging.info("1D RETURN is already sorted descending")
        return True
    if aria_sort == "ascending":
        header.click(timeout=5000)
        page.wait_for_timeout(1000)
        logging.info("Changed 1D RETURN sort to descending")
        return True

    # Some custom grids do not expose aria-sort. Compare visible endpoints
    # before clicking so an already-ascending table is left unchanged.
    before = extract_rows(page)
    if len(before) >= 2 and before[0]["change"] >= before[-1]["change"]:
        logging.info("1D RETURN appears sorted descending")
        return True

    header.click(timeout=5000)
    page.wait_for_timeout(1000)
    logging.info("Clicked 1D RETURN to sort descending")
    return True

def is_market_daytime():
    now = datetime.now(IST)
    return now.weekday() < 5 and (now.hour > 9 or (now.hour == 9 and now.minute >= 15)) and (
        now.hour < 15 or (now.hour == 15 and now.minute <= 30)
    )

def main():
    if not SCREENER_URL:
        raise SystemExit("Set SCREENER_URL in .env to your NSE Market Lens screener URL.")

    with sync_playwright() as p:
        browser = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=HEADLESS,
            viewport={"width": 1600, "height": 1000},
            accept_downloads=False,
        )
        page = browser.pages[0] if browser.pages else browser.new_page()
        page.goto(SCREENER_URL, wait_until="domcontentloaded", timeout=60000)

        if AUTO_START:
            logging.info("Auto-start enabled; beginning without terminal input")
        else:
            print("\nBrowser opened. If needed, log in to NSE Market Lens yourself.")
            print("Make sure the screener results table is visible and has the 1D RETURN column.")
            input("When the screener is ready, press ENTER here to begin monitoring... ")

        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except PlaywrightTimeoutError:
            pass
        ensure_1d_return_descending(page)

        if SEND_STARTUP_MESSAGE:
            send_telegram(
            "✅ NSE Market Lens crawler started.\n"
            f"Alert rule: 1D RETURN >= +{THRESHOLD_PERCENT:.2f}%\n"
            f"Repeat alerts: {'enabled' if ALLOW_REPEAT_ALERTS else 'one per symbol per day'}.\n"
            f"Check interval: {CHECK_EVERY_SECONDS // 60} minutes.\n"
                "Monitoring the visible screener results in your browser."
            )

        while True:
            try:
                if is_market_daytime():
                    rows = extract_rows(page)
                    if not rows:
                        logging.warning(
                            "No stock rows parsed. Check that the results table is visible; "
                            "the site's HTML may have changed."
                        )
                    state = load_state()
                    day = datetime.now(IST).date().isoformat()
                    logging.info("Parsed %d visible stock rows", len(rows))

                    for item in rows:
                        ticker = item["ticker"]
                        change = item["change"]
                        key = f"{day}:{ticker}"
                        logging.info("%s 1D return %.2f%%", ticker, change)

                        if change >= THRESHOLD_PERCENT and (ALLOW_REPEAT_ALERTS or key not in state):
                            message = (
                                "🚨 NSE MARKET LENS ALERT\n\n"
                                f"Stock: {ticker}\n"
                                f"{format_alert_metrics(item)}\n"
                                f"Alert threshold: +{THRESHOLD_PERCENT:.2f}%\n\n"
                                "This stock currently appears in your Market Lens screener.\n"
                                "VWAP, relative volume, entry, stop-loss, and target are not available from this screener row.\n"
                                "Verify the latest price and risk before acting."
                            )
                            send_telegram(message)
                            state[key] = datetime.now(IST).isoformat()
                            save_state(state)
                            logging.info("Alert sent: %s", ticker)

                else:
                    logging.info("Outside weekday market hours; waiting.")

            except Exception:
                logging.exception("Monitoring pass failed")

            if RUN_ONCE:
                logging.info("Run-once mode complete; exiting")
                break

            # Keep the same browser page; reload to refresh screener data.
            time.sleep(CHECK_EVERY_SECONDS)
            try:
                page.reload(wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(2500)
                ensure_1d_return_descending(page)
            except Exception:
                logging.exception("Page reload failed; will retry next cycle")

if __name__ == "__main__":
    main()
