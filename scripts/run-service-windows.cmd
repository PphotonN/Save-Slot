@echo off
setlocal EnableExtensions
chcp 65001 >nul

title %~1
cd /d "%~2"

call "%~3" %~4
set "SERVICE_EXIT=%ERRORLEVEL%"

echo.
if "%SERVICE_EXIT%"=="0" (
  echo [STOPPED] %~1 завершив роботу.
) else (
  echo [ERROR] %~1 завершився з кодом %SERVICE_EXIT%.
)
echo Закрий це вікно або натисни будь-яку клавішу.
pause >nul
exit /b %SERVICE_EXIT%
