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

if not exist "%CD%\scripts\bootstrap-windows.ps1" goto :missing_bootstrap

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\bootstrap-windows.ps1" -ProjectRoot "%CD%"
if errorlevel 1 goto :setup_failed

set "NODE_HOME=%CD%\.runtime\node"
set "PNPM_HOME=%CD%\.runtime\pnpm"
set "PNPM_COMMAND=%PNPM_HOME%\pnpm.cmd"
set "PATH=%NODE_HOME%;%PNPM_HOME%;%PATH%"

if not exist "%PNPM_COMMAND%" goto :setup_failed

echo.
echo [START] Запускаю кеш бібліотеки: http://127.0.0.1:8791
start "Save Slot Library" /D "%CD%" "%ComSpec%" /d /k call "%PNPM_COMMAND%" dev:library

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(20); do { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8791/health' -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0} } catch {}; Start-Sleep -Milliseconds 500 } while((Get-Date)-lt $deadline); exit 1"
if errorlevel 1 goto :library_timeout

echo [START] Запускаю Save Slot API: http://localhost:8787
start "Save Slot API" /D "%CD%" "%ComSpec%" /d /k call "%PNPM_COMMAND%" dev:api

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(45); do { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8787/health' -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0} } catch {}; Start-Sleep -Milliseconds 750 } while((Get-Date)-lt $deadline); exit 1"
if errorlevel 1 echo [WARN] API ще не відповідає. Вебзастосунок все одно запуститься з локальним fallback.

echo [START] Запускаю Save Slot Web: http://localhost:5173
start "Save Slot Web" /D "%CD%" "%ComSpec%" /d /k call "%PNPM_COMMAND%" dev

"%POWERSHELL_EXE%" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(60); do { try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5173' -TimeoutSec 2; if($r.StatusCode -lt 500){exit 0} } catch {}; Start-Sleep -Milliseconds 750 } while((Get-Date)-lt $deadline); exit 1"
if errorlevel 1 goto :web_timeout

start "" "http://localhost:5173"
echo.
echo [READY] Save Slot запущено.
echo Колекція кешується у .save-slot-data\library.json.
echo Закрий вікна Save Slot Library, Save Slot API та Save Slot Web, щоб зупинити застосунок.
echo.
timeout /t 3 /nobreak >nul
exit /b 0

:missing_powershell
echo [ERROR] Windows PowerShell або PowerShell 7 не знайдено.
echo Він потрібен лише для автоматичного завантаження portable runtime.
pause
exit /b 1

:missing_bootstrap
echo [ERROR] Відсутній scripts\bootstrap-windows.ps1.
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

:library_timeout
echo.
echo [ERROR] Локальний кеш бібліотеки не відповів протягом 20 секунд.
echo Перевір вікно Save Slot Library — там буде точна помилка.
pause
exit /b 1

:web_timeout
echo.
echo [ERROR] Вебзастосунок не відповів протягом 60 секунд.
echo Перевір вікна Save Slot API та Save Slot Web — там буде точна помилка.
pause
exit /b 1
