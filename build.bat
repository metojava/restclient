@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo    RestClient - build all components
echo ==========================================
echo.

rem ---------- Java backend ----------
where mvn >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Maven is not installed or not on PATH.
  pause
  exit /b 1
)

echo [1/3] Building Java backend JAR...
call mvn -q -f backend\pom.xml -DskipTests package
if errorlevel 1 (
  echo [ERROR] Java backend build failed.
  pause
  exit /b 1
)
echo       backend\target\restclient-backend.jar

rem ---------- Python backend ----------
where python >nul 2>nul
if errorlevel 1 (
  echo [2/3] Python not found, skipping Python backend setup.
) else (
  python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
  if errorlevel 1 (
    echo [ERROR] Python 3.10 or newer is required.
    pause
    exit /b 1
  )

  if not exist "backendpy\.venv\Scripts\python.exe" (
    echo [2/3] Creating Python virtual environment...
    python -m venv backendpy\.venv
    if errorlevel 1 (
      echo [ERROR] Could not create the Python virtual environment.
      pause
      exit /b 1
    )
  )

  "backendpy\.venv\Scripts\python.exe" -c "import fastapi, uvicorn, requests" >nul 2>nul
  if errorlevel 1 (
    echo [2/3] Installing Python dependencies...
    "backendpy\.venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r backendpy\requirements.txt
    if errorlevel 1 (
      echo [ERROR] Python dependency installation failed.
      pause
      exit /b 1
    )
  )

  "backendpy\.venv\Scripts\python.exe" -m py_compile backendpy\app.py backendpy\executor.py backendpy\models.py backendpy\stores.py backendpy\errors.py
  if errorlevel 1 (
    echo [ERROR] Python syntax check failed.
    pause
    exit /b 1
  )
  echo [2/3] Python environment ready: backendpy\.venv
)

rem ---------- Frontend ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 18+ is not installed or not on PATH.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo [3/3] Installing frontend dependencies...
  call npm install --prefix frontend --no-fund --no-audit
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [3/3] Building frontend bundle...
call npm run build --prefix frontend
if errorlevel 1 (
  echo [ERROR] Frontend build failed.
  pause
  exit /b 1
)
echo       frontend\dist

echo.
echo Build finished.
echo   Java backend : backend\target\restclient-backend.jar
echo   Python env   : backendpy\.venv
echo   Frontend     : frontend\dist
endlocal
