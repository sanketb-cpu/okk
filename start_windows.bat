@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -m venv .venv
  call ".venv\Scripts\activate.bat"
  python -m pip install --upgrade pip
  pip install -r requirements.txt
  python -m playwright install chromium
) else (
  call ".venv\Scripts\activate.bat"
)
if not exist ".env" (
  copy ".env.example" ".env"
  notepad ".env"
  echo Fill in .env, save it, then run this file again.
  pause
  exit /b 1
)
python market_lens_alerts.py
pause
