@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python -m venv backend\venv
)

echo Syncing backend dependencies...
backend\venv\Scripts\pip install -r backend\requirements.txt -q

if not exist "sample_data\sales.db" (
    echo Creating sample sales database...
    backend\venv\Scripts\python backend\scripts\create_sample_db.py
)

echo Seeding demo tenant (if needed)...
backend\venv\Scripts\python backend\scripts\seed_demo.py

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

echo.
echo Starting AtlasIQ in this terminal...
echo   API  -^> http://localhost:8000
echo   UI   -^> http://localhost:5173
echo   Mode -^> Simple (see README.md for enterprise / Docker)
echo   Press Ctrl+C to stop both servers.
echo.

REM Stop leftover backend instances and zombie workers on port 8000
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-backend.ps1"

REM Backend in background (same window — no separate cmd popup)
start /b "" cmd /c "cd /d %~dp0backend && venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

REM Frontend in foreground — logs stay in this terminal
pushd frontend
call npm run dev -- --host
popd

echo.
echo Stopping backend...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-backend.ps1"
echo Done.
