@echo off
echo Starting Memory Assistant Application...
echo.

echo [1/3] Starting Backend Server...
start "Backend Server" cmd /k "cd backend && python start_backend.py"

echo [2/3] Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Server...
start "Frontend Server" cmd /k "cd frontend && python start_frontend.py"

echo.
echo Both servers are starting...
echo Backend: http://127.0.0.1:5000
echo Frontend: http://localhost:8000
echo.
echo Your browser should open automatically.
echo If not, open http://localhost:3000 manually.
echo.
pause
