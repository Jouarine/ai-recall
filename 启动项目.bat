@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] npm not found. Please install Node.js first.
  pause
  exit /b 1
)

echo Starting AI-Recall dev server...
start "" "http://localhost:3000"
npm run dev

pause
