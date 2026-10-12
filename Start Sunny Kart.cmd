@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer from https://nodejs.org/en/download
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
node scripts/serve.mjs --open
exit /b 0
:failed
echo Setup failed. See the error above and docs\INSTALL.zh-CN.md.
pause
exit /b 1
