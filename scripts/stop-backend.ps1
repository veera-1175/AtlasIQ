# Stop all AtlasIQ backend processes and free port 8000
$ErrorActionPreference = "SilentlyContinue"

function Stop-ProcessTree([int]$ProcessId) {
    Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $ProcessId } |
        ForEach-Object { Stop-ProcessTree $_.ProcessId }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

# 1) Uvicorn / AtlasIQ backend command lines
Get-CimInstance Win32_Process |
    Where-Object {
        $_.CommandLine -like "*uvicorn*app.main*" -or
        $_.CommandLine -like "*atlasiq*backend*uvicorn*"
    } |
    ForEach-Object { Stop-ProcessTree $_.ProcessId }

# 2) Orphaned uvicorn worker children (multiprocessing spawn)
Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -like "*multiprocessing.spawn*" -and $_.CommandLine -like "*spawn_main*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# 3) Anything still listening on port 8000
$pids = @()
try {
    $pids += Get-NetTCPConnection -LocalPort 8000 -State Listen |
        Select-Object -ExpandProperty OwningProcess -Unique
} catch {}

if (-not $pids) {
    netstat -ano | Select-String ":8000\s+.*LISTENING" | ForEach-Object {
        if ($_ -match "\s+(\d+)\s*$") { $pids += [int]$Matches[1] }
    }
}

$pids | Select-Object -Unique | ForEach-Object {
    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    taskkill /F /PID $_ 2>$null | Out-Null
}

Start-Sleep -Seconds 1
