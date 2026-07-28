@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 24 is not installed or not available in PATH.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODE_MAJOR=%%V
if not "%NODE_MAJOR%"=="24" (
  echo [ERROR] Save Slot requires Node.js 24. Current version:
  node --version
  pause
  exit /b 1
)

start "" http://127.0.0.1:8080
node tools\local-server.mjs

if errorlevel 1 pause
