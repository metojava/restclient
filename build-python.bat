@echo off
setlocal
cd /d "%~dp0"

echo Preparing Python backend environment...
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
  echo [1/3] Creating virtual environment...
  python -m venv backendpy\.venv
  if errorlevel 1 (
    echo [ERROR] Could not create the Python virtual environment.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Virtual environment found.
)

"backendpy\.venv\Scripts\python.exe" -c "import fastapi, uvicorn, requests" >nul 2>nul
if errorlevel 1 (
  echo [2/3] Installing dependencies...
  "backendpy\.venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r backendpy\requirements.txt
  if errorlevel 1 (
    echo [ERROR] Python dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo [2/3] Dependencies found.
)

echo [3/3] Checking Python sources...
"backendpy\.venv\Scripts\python.exe" -m py_compile backendpy\app.py backendpy\executor.py backendpy\models.py backendpy\stores.py backendpy\errors.py
if errorlevel 1 (
  echo [ERROR] Python syntax check failed.
  pause
  exit /b 1
)

echo.
echo Python backend is ready.
echo   Environment : backendpy\.venv
echo   Start only  : start-python.bat backend
echo   Start with UI: start-python.bat
endlocal
