@echo off
setlocal
cd /d "%~dp0"

set BACKEND_ONLY=0
if not "%~1"=="" (
  for %%A in (%*) do (
    if /i "%%A"=="backend" set BACKEND_ONLY=1
    if /i "%%A"=="--backend-only" set BACKEND_ONLY=1
  )
)

set MODE=PYTHON backend + frontend
if "%BACKEND_ONLY%"=="1" set MODE=PYTHON backend only

echo ============================================
echo    RestClient - %MODE%
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3.10+ is not installed or not on PATH.
  pause
  exit /b 1
)

python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
if errorlevel 1 (
  echo [ERROR] Python 3.10 or newer is required.
  pause
  exit /b 1
)

if not exist "backendpy\.venv\Scripts\python.exe" (
  echo [python] Creating virtual environment...
  python -m venv backendpy\.venv
  if errorlevel 1 (
    echo [ERROR] Could not create the Python virtual environment.
    pause
    exit /b 1
  )
)

"backendpy\.venv\Scripts\python.exe" -c "import fastapi, uvicorn, requests" >nul 2>nul
if errorlevel 1 (
  echo [python] Installing dependencies...
  "backendpy\.venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r backendpy\requirements.txt
  if errorlevel 1 (
    echo [ERROR] Python dependency installation failed.
    pause
    exit /b 1
  )
)
echo [python] Environment ready.

netstat -ano | findstr /c:":8080 " | findstr /i "LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 8080 is already in use. Run stop.bat first, or use start-java.bat for the Java backend.
  pause
  exit /b 1
)

echo [python] Starting on http://localhost:8080 ...
start "RestClient Python Backend" /d "%~dp0backendpy" cmd /k ".venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8080"

if "%BACKEND_ONLY%"=="1" (
  echo.
  echo Python backend is running. Frontend was not started.
  echo Health check: http://localhost:8080/api/health
  echo Run stop.bat to stop it.
  endlocal
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 18+ is not installed or not on PATH.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo [frontend] Installing dependencies ^(first run only^)...
  call npm install --prefix frontend --no-fund --no-audit
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [frontend] Dependencies found, skipping npm install.
)

netstat -ano | findstr /c:":5173 " | findstr /i "LISTENING" >nul
if not errorlevel 1 (
  echo [frontend] Port 5173 is already in use, assuming the frontend is running.
) else (
  echo [frontend] Starting on http://localhost:5173 ...
  start "RestClient Frontend" /d "%~dp0frontend" cmd /k "npm run dev"
)

echo.
echo Waiting for services to start...
timeout /t 7 /nobreak >nul
start "" http://localhost:5173

echo.
echo Python backend: http://localhost:8080/api/health
echo Frontend      : http://localhost:5173
echo Run stop.bat to stop both.
endlocal
