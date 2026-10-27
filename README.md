# NSE Market Lens -> Telegram Crawler (local browser prototype)

The local mode opens your Market Lens screener, reads the currently rendered rows, sorts by **1D RETURN** descending, and sends Telegram alerts at or above `THRESHOLD_PERCENT`. The unattended GitHub Actions mode uses the official NSE public market-data endpoint so it does not depend on an interactive Market Lens browser session.

## Setup on Windows

1. Install Python 3.11 or newer.
2. Extract this folder.
3. Create a Telegram bot using https://t.me/BotFather and press Start on your new bot.
4. Get your Telegram chat ID by sending `/start`, then open `https://api.telegram.org/botYOUR_TOKEN/getUpdates` and find `message.chat.id`.
5. Run `start_windows.bat`. It installs dependencies and Chromium on the first run.
6. Fill in `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `SCREENER_URL`: paste the full URL of the saved Market Lens screener from your address bar.
7. Run `start_windows.bat` again. Browser opens; log in yourself if needed, ensure results and the 1D RETURN column are visible, then press Enter in the terminal.
8. Leave the terminal and browser open. It refreshes every 5 minutes.

## Always-on cloud operation

For unattended five-minute monitoring, deploy to an always-on VM instead of leaving the laptop running. An Oracle Cloud deployment template is included in [`deploy/oracle/`](deploy/oracle/). It runs Playwright headlessly as a `systemd` service, restarts after failures or reboots, and keeps the existing India market-hours filter.

Set `HEADLESS=true` and `AUTO_START=true` in the VM's `.env`. Keep `RUN_ONCE=false` for continuous monitoring. Follow [`deploy/oracle/README.md`](deploy/oracle/README.md).

If you cannot complete cloud card verification, the repository also includes a cardless GitHub Actions workflow in [`.github/workflows/market-lens-alerts.yml`](.github/workflows/market-lens-alerts.yml). It performs one headless check every five minutes during market hours; scheduled runs may be delayed. Follow [`deploy/github-actions/README.md`](deploy/github-actions/README.md).

## Alert behavior

- Uses the 1D RETURN shown in the screener and alerts at or above `THRESHOLD_PERCENT`.
- Sends one alert per symbol per calendar day by default; set `ALLOW_REPEAT_ALERTS=true` to alert again on every qualifying check.
- Checks weekdays during 09:15–15:30 India time.
- Reads only rendered page content; does not bypass login/CAPTCHA or hidden access controls.
- Browser profile is stored locally in `browser_profile/`. Do not share that folder; it can contain session data.
- The URL in `.env` may contain a private token-like query string. Do not publish it.

## Important limitations

- This is a practical starting prototype. Market Lens uses a dynamic page and may change its HTML; if no rows are detected or the wrong percentage is read, inspect `crawler.log` and adjust `extract_rows()` selectors.
- It relies on the page's currently rendered results and the site's permitted use/access. It does not assume or use a private Market Lens API.
- This monitors the screener's displayed **1D RETURN**. It does not calculate a fresh live price increase itself. If you instead want a rolling +2% change since the prior five-minute check, the script needs a separately available price feed or reliable current price field.
- The browser, computer, and internet must remain running. It is not a cloud service.
- For production, confirm the website terms permit automated access and consider an authorized exchange data feed.
