# Oracle Always Free deployment

This runs the crawler continuously on an Oracle Cloud Linux VM, checking every five minutes during the configured India market hours.

## Setup

1. Create an Oracle Cloud Always Free VM with Ubuntu or Debian and SSH access.
2. Copy or clone this project to the VM.
3. From the project root, run:

   ```bash
   cp deploy/oracle/app.env.example .env
   chmod 600 .env
   nano .env
   ```

4. Fill in the Telegram values and the private `SCREENER_URL`. Keep these values out of Git.
5. Confirm the unattended settings are present:

   ```env
   HEADLESS=true
   AUTO_START=true
   RUN_ONCE=false
   CHECK_EVERY_SECONDS=300
   ```

6. Install and start the service:

   ```bash
   bash deploy/oracle/install.sh
   ```

## Check the service

```bash
sudo systemctl status nse-market-lens
sudo journalctl -u nse-market-lens -f
```

The service restarts automatically after a crash or VM reboot. Stop it with:

```bash
sudo systemctl disable --now nse-market-lens
```

If Market Lens requires an interactive login, complete one authorized login on the VM and preserve the generated `browser_profile/`. Do not bypass a CAPTCHA or access control. The session can expire and may need to be refreshed manually.
