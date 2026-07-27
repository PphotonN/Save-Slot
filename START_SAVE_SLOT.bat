@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Save Slot Launcher

echo.
echo ========================================
echo   SAVE SLOT v1 - LOCAL LAUNCHER
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :missing_node

set "PNPM_COMMAND=pnpm"
where pnpm >nul 2>&1
if not errorlevel 1 goto :pnpm_ready

where corepack >nul 2>&1
if errorlevel 1 goto :missing_pnpm

corepack pnpm --version >nul 2>&1
if errorlevel 1 (
  echo [SETUP] Preparing pnpm 10.14.0 through Corepack...
  corepack prepare pnpm@10.14.0 --activate
  if errorlevel 1 goto :missing_pnpm
)
set "PNPM_COMMAND=corepack pnpm"

:pnpm_ready
if not exist "apps\web\.env" (
  echo [SETUP] Creating apps\web\.env...
  copy /Y "apps\web\.env.example" "apps\web\.env" >nul
)

if not exist "apps\api\.dev.vars" (
  echo [SETUP] Creating apps\api\.dev.vars...
  copy /Y "apps\api\.dev.vars.example" "apps\api\.dev.vars" >nul
)

if not exist "node_modules\.pnpm" (
  echo [SETUP] Installing dependencies. This is required only on the first launch...
  call %PNPM_COMMAND% install
  if errorlevel 1 goto :install_failed
)

echo [START] Launching Save Slot API on http://localhost:8787 ...
start "Save Slot API" /D "%CD%" cmd /k "%PNPM_COMMAND% dev:api"

timeout /t 2 /nobreak >nul

echo [START] Launching Save Slot web app on http://localhost:5173 ...
start "Save Slot Web" /D "%CD%" cmd /k "%PNPM_COMMAND% dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Save Slot was started in two terminal windows.
echo Close those windows to stop the local application.
echo.
timeout /t 3 /nobreak >nul
exit /b 0

:missing_node
echo [ERROR] Node.js was not found.
echo Install Node.js 20.19 or newer, then run this file again.
echo https://nodejs.org/
pause
exit /b 1

:missing_pnpm
echo [ERROR] pnpm and Corepack were not found.
echo Install pnpm 10.14 or enable Corepack, then run this file again.
pause
exit /b 1

:install_failed
echo [ERROR] Dependency installation failed.
echo Check the messages above and your internet connection.
pause
exit /b 1
