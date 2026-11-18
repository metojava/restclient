@echo off
setlocal
cd /d "%~dp0"

rem Usage:
rem   start.bat                 -> Java backend + frontend
rem   start.bat python          -> Python backend + frontend
rem   start.bat backend         -> Java backend only
rem   start.bat python backend  -> Python backend only
rem   start.bat --rebuild       -> rebuild the Java JAR first

if /i "%~1"=="python" (
  call "%~dp0start-python.bat" %2 %3
) else (
  call "%~dp0start-java.bat" %*
)

endlocal
