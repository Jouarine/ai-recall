@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] npm not found. Please install Node.js first.
  pause
  exit /b 1
)

echo Building AI-Recall...
npm run build
if errorlevel 1 (
  echo.
  echo [Build Failed] Please check terminal output.
  pause
  exit /b 1
)

echo Build succeeded. Starting production server...
start "" "http://localhost:3000"
npm run start

pause
