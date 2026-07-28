@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Save Slot Launcher

set "POWERSHELL_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%POWERSHELL_EXE%" goto :powershell_ready

where pwsh >nul 2>&1
if errorlevel 1 goto :missing_powershell
set "POWERSHELL_EXE=pwsh"

:powershell_ready
echo.
echo ========================================
echo   SAVE SLOT v1 - AUTOMATIC LAUNCHER
echo ========================================
echo.
echo [SETUP] Перший запуск автоматично підготує локальне середовище.
echo [SETUP] Системне встановлення Node.js або pnpm не потрібне.
echo.

if not exist "%CD%\scripts\bootstrap-windows.ps1" goto :missing_startup_file
if not exist "%CD%\scripts\launch-windows.ps1" goto :missing_startup_file
if not exist "%CD%\scripts\run-service-windows.cmd" goto :missing_startup_file
if not exist "%CD%\scripts\service-probe.mjs" goto :missing_startup_file

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\bootstrap-windows.ps1" -ProjectRoot "%CD%"
if errorlevel 1 goto :setup_failed

set "NODE_EXE=%CD%\.runtime\node\node.exe"
set "PNPM_COMMAND=%CD%\.runtime\pnpm\pnpm.cmd"
if not exist "%NODE_EXE%" goto :setup_failed
if not exist "%PNPM_COMMAND%" goto :setup_failed

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\launch-windows.ps1" -ProjectRoot "%CD%" -NodeExecutable "%NODE_EXE%" -PnpmCommand "%PNPM_COMMAND%"
if errorlevel 1 goto :launch_failed

exit /b 0

:missing_powershell
echo [ERROR] Windows PowerShell або PowerShell 7 не знайдено.
echo Він потрібен для автоматичної підготовки portable runtime.
pause
exit /b 1

:missing_startup_file
echo [ERROR] Один або кілька стартових файлів Save Slot відсутні.
echo Онови гілку app-v1 і повтори запуск.
pause
exit /b 1

:setup_failed
echo.
echo [ERROR] Автоматична підготовка Save Slot не завершилась.
echo Перевір повідомлення вище та доступ до Інтернету.
echo Права адміністратора не потрібні.
pause
exit /b 1

:launch_failed
echo.
echo [ERROR] Один із локальних сервісів Save Slot не запустився.
echo Перевір повідомлення вище та відкриті вікна сервісів.
pause
exit /b 1
