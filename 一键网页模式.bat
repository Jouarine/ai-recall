@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] npm not found. Please install Node.js first.
  pause
  exit /b 1
)

for /f %%i in ('powershell -NoProfile -Command "$ip=(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch ''^127\.|^169\.254\.'' -and $_.InterfaceAlias -notmatch ''Loopback|vEthernet|VMware|Hyper-V|Docker'' } | Select-Object -First 1 -ExpandProperty IPAddress); if([string]::IsNullOrWhiteSpace($ip)){ $ip=''localhost'' }; Write-Output $ip"') do set LAN_IP=%%i

echo.
echo ======================================
echo AI-Recall Web Mode
echo Local: http://localhost:3000
echo LAN:   http://%LAN_IP%:3000
echo ======================================
echo.

echo Opening browser...
start "" "http://localhost:3000"

echo Starting server...
npm run dev

pause
