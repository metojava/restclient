@echo off
setlocal
cd /d "%~dp0"

set BACKEND_ONLY=0
set REBUILD=0
if not "%~1"=="" (
  for %%A in (%*) do (
    if /i "%%A"=="backend" set BACKEND_ONLY=1
    if /i "%%A"=="--backend-only" set BACKEND_ONLY=1
    if /i "%%A"=="--rebuild" set REBUILD=1
  )
)

set MODE=JAVA backend + frontend
if "%BACKEND_ONLY%"=="1" set MODE=JAVA backend only

echo ============================================
echo    RestClient - %MODE%
echo ============================================
echo.

where java >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Java 21+ is not installed or not on PATH.
  pause
  exit /b 1
)

set NEEDS_BUILD=0
if not exist "backend\target\restclient-backend.jar" set NEEDS_BUILD=1
if "%REBUILD%"=="1" set NEEDS_BUILD=1

if "%NEEDS_BUILD%"=="1" (
  where mvn >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Maven is required to build the Java backend.
    pause
    exit /b 1
  )
  echo [backend] Building Java JAR...
  call mvn -q -f backend\pom.xml -DskipTests package
  if errorlevel 1 (
    echo [ERROR] Java backend build failed.
    pause
    exit /b 1
  )
) else (
  echo [backend] Java JAR found, skipping Maven build.
)

netstat -ano | findstr /c:":8080 " | findstr /i "LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 8080 is already in use. Run stop.bat first.
  pause
  exit /b 1
)

echo [backend] Starting Java on http://localhost:8080 ...
start "RestClient Java Backend" /d "%~dp0backend" cmd /k "java -jar target\restclient-backend.jar"

if "%BACKEND_ONLY%"=="1" (
  echo.
  echo Java backend is running. Frontend was not started.
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
echo Java backend: http://localhost:8080/api/health
echo Frontend    : http://localhost:5173
echo Run stop.bat to stop both.
endlocal
