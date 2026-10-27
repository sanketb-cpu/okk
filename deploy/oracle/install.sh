#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
SERVICE_NAME="nse-market-lens"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"

if [[ "${EUID}" -eq 0 ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

if [[ ! -f "$APP_DIR/.env" ]]; then
    cp "$APP_DIR/deploy/oracle/app.env.example" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    echo "Created $APP_DIR/.env. Fill in the private values, then run this script again."
    exit 1
fi

$SUDO apt-get update
$SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip

python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/python" -m pip install --upgrade pip
"$APP_DIR/.venv/bin/pip" install -r "$APP_DIR/requirements.txt"
"$APP_DIR/.venv/bin/python" -m playwright install --with-deps chromium

if ! grep -q '^HEADLESS=true$' "$APP_DIR/.env" || ! grep -q '^AUTO_START=true$' "$APP_DIR/.env"; then
    echo "Set HEADLESS=true and AUTO_START=true in $APP_DIR/.env before enabling the service."
    exit 1
fi

escape_sed() {
    printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

APP_DIR_ESCAPED="$(escape_sed "$APP_DIR")"
SERVICE_USER_ESCAPED="$(escape_sed "$SERVICE_USER")"
TEMP_UNIT="$(mktemp)"
trap 'rm -f "$TEMP_UNIT"' EXIT
sed \
    -e "s|__APP_DIR__|$APP_DIR_ESCAPED|g" \
    -e "s|__SERVICE_USER__|$SERVICE_USER_ESCAPED|g" \
    "$APP_DIR/deploy/oracle/nse-market-lens.service" > "$TEMP_UNIT"

$SUDO install -m 0644 "$TEMP_UNIT" "/etc/systemd/system/$SERVICE_NAME.service"
$SUDO systemctl daemon-reload
$SUDO systemctl enable --now "$SERVICE_NAME.service"

echo "Service enabled: $SERVICE_NAME"
echo "Logs: sudo journalctl -u $SERVICE_NAME -f"
