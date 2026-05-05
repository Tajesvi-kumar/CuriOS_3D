@echo off
echo ========================================
echo Starting CuriOS Application
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org
    echo After installation, restart this script.
    pause
    exit /b 1
)

echo Node.js found!
echo.

echo Starting Backend Server...
start "CuriOS Backend" cmd /k "cd curios-ai\backend && uvicorn main:app --reload --port 8000"
timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
start "CuriOS Frontend" cmd /k "cd curios-ai\frontend && npm install && npm run dev"

echo.
echo ========================================
echo Both servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo ========================================
echo.
echo Press any key to stop all servers...
pause >nul

taskkill /FI "WINDOWTITLE eq CuriOS Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CuriOS Frontend*" /F >nul 2>&1
echo Servers stopped.
