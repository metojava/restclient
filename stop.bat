@echo off
setlocal enabledelayedexpansion

echo Stopping RestClient services...

for %%P in (8080 5173) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /c:":%%P " ^| findstr /i "LISTENING"') do (
    echo   Killing PID %%A on port %%P
    taskkill /f /pid %%A >nul 2>nul
  )
)

echo Done.
endlocal
