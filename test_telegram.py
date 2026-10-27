import os
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
if not token or not chat_id:
    raise SystemExit("Fill Telegram credentials in .env first.")
r = requests.post(
    f"https://api.telegram.org/bot{token}/sendMessage",
    json={"chat_id": chat_id, "text": "✅ Telegram test from your NSE Market Lens crawler."},
    timeout=20,
)
r.raise_for_status()
print(r.json())
