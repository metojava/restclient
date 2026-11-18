@echo off
setlocal
cd /d "%~dp0"

echo Starting RestClient frontend only...

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 18+ is not installed or not on PATH.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies ^(first run only^)...
  call npm install --prefix frontend --no-fund --no-audit
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

netstat -ano | findstr /c:":5173 " | findstr /i "LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 5173 is already in use. Run stop.bat first.
  pause
  exit /b 1
)

echo Starting frontend on http://localhost:5173 ...
start "RestClient Frontend" /d "%~dp0frontend" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "" http://localhost:5173
echo The frontend needs a backend on port 8080 (start-java.bat or start-python.bat).
endlocal
