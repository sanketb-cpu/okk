# Google Apps Script deployment

This is a cardless, laptop-independent alternative to GitHub Actions. It fetches the official NSE public gainers endpoint every five minutes during 09:15–15:30 Asia/Kolkata on weekdays and sends Telegram alerts when 1D return is at least +10%.

## One-time setup

1. Open [script.google.com](https://script.google.com/) and create a **New project**.
2. Replace the default code with [`Code.gs`](Code.gs).
3. Open **Project Settings → Script Properties** and add:
   - `TELEGRAM_BOT_TOKEN`: your newly regenerated BotFather token
   - `TELEGRAM_CHAT_ID`: `1471908211` if that is still your chat ID
   - `THRESHOLD_PERCENT`: `10`
   - `ALLOW_REPEAT_ALERTS`: `true`
4. Select the `setup` function and click **Run** once. Approve Google’s authorization prompt.
5. Leave the project alone. The time-driven trigger runs automatically every five minutes; no laptop is required.

The first run may take a few seconds while Google asks for authorization. Do not paste the bot token into chat or into the source code; keep it only in Script Properties. Because the previous token was exposed, regenerate it with BotFather before adding it here.
