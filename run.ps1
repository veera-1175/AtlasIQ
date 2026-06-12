# AtlasIQ — run backend + frontend in the current terminal (PowerShell / Cursor)
Set-Location $PSScriptRoot

function Stop-AtlasIQBackend {
    & (Join-Path $PSScriptRoot "scripts\stop-backend.ps1")
}

if (-not (Test-Path "backend\venv\Scripts\python.exe")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv backend\venv
}

Write-Host "Syncing backend dependencies..."
& backend\venv\Scripts\pip install -r backend\requirements.txt -q

if (-not (Test-Path "sample_data\sales.db")) {
    Write-Host "Creating sample sales database..."
    & backend\venv\Scripts\python backend\scripts\create_sample_db.py
}

Write-Host "Seeding demo tenant (if needed)..."
& backend\venv\Scripts\python backend\scripts\seed_demo.py

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..."
    Push-Location frontend; npm install; Pop-Location
}

Write-Host ""
Write-Host "Starting AtlasIQ in this terminal..."
Write-Host "  API  -> http://localhost:8000"
Write-Host "  UI   -> http://localhost:5173"
Write-Host "  Mode -> Simple (see README.md for enterprise / Docker)"
Write-Host "  Press Ctrl+C to stop both servers."
Write-Host ""

Stop-AtlasIQBackend

$backendJob = Start-Job -ScriptBlock {
    Set-Location (Join-Path $using:PSScriptRoot "backend")
    & .\venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1
}

Start-Sleep -Seconds 3

if ($backendJob.State -eq "Failed" -or (Receive-Job $backendJob -Keep 2>$null | Select-String -Pattern "Error|Traceback" -Quiet)) {
    Write-Host "Backend failed to start:" -ForegroundColor Red
    Receive-Job $backendJob 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    exit 1
}

try {
    Push-Location frontend
    npm run dev -- --host
} finally {
    Pop-Location
    Write-Host "`nStopping backend..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    Stop-AtlasIQBackend
    Write-Host "Done." -ForegroundColor Green
}
