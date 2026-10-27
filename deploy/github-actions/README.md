# GitHub Actions deployment

This is the cardless, free-runner option for best-effort five-minute checks. GitHub Actions schedules can be delayed, and the workflow cannot complete a new interactive Market Lens login.

## Setup

1. Push this project to a GitHub repository. A public repository avoids GitHub-hosted runner charges; private repositories use the account's included Actions quota.
2. Open the repository's **Settings → Secrets and variables → Actions**.
3. Add these repository secrets:

   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `SCREENER_URL`

4. Open **Actions**, select **NSE Market Lens alerts**, and run it once with **Run workflow**.
5. Check the workflow logs and Telegram message.

The workflow runs one headless check every five minutes during 09:15-15:30 Asia/Kolkata on weekdays. It sends no startup message and exits after each check. Keep the screener URL and Telegram token only in GitHub Secrets; never commit `.env` or `browser_profile/`.

If the screener redirects to login in the GitHub runner, this option cannot authenticate interactively. Use an authorized session/data source that the site permits, or use an always-on VM where the session can be initialized once.
