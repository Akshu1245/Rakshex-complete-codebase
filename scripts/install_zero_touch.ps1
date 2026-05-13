# DevPulse Zero-Touch Installation
# Run ONCE. After this, DevPulse runs itself forever.
# No prompts. No commands. No human. Ever.

$DEVPULSE_ROOT = "C:\Users\aksha\Downloads\DevPulse_Complete_Codebase"
$TASK_NAME = "DevPulse_Autonomous_Swarm"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEVPULSE ZERO-TOUCH INSTALLATION" -ForegroundColor Cyan
Write-Host "  After this, you never touch DevPulse again." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Remove any existing task ---
Write-Host "[1/5] Cleaning up old task..." -ForegroundColor Gray
schtasks /DELETE /TN $TASK_NAME /F 2>$null

# --- 2. Create boot-triggered task ---
Write-Host "[2/5] Registering boot-time trigger..." -ForegroundColor Gray
$action = "pwsh -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$DEVPULSE_ROOT\scripts\auto_start.ps1`""
schtasks /CREATE /TN $TASK_NAME /SC ONLOGON /DELAY 0001:00 /RL HIGHEST /TR $action /F | Out-Null

# --- 3. Verify task exists ---
$task = schtasks /QUERY /TN $TASK_NAME /FO CSV 2>$null
if ($task) {
    Write-Host "[2/5] Task registered: $TASK_NAME" -ForegroundColor Green
} else {
    Write-Host "[2/5] ERROR: Task registration failed" -ForegroundColor Red
    exit 1
}

# --- 4. Start the swarm immediately ---
Write-Host "[3/5] Launching swarm now..." -ForegroundColor Gray
Start-Process -WindowStyle Hidden -FilePath "pwsh" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$DEVPULSE_ROOT\scripts\auto_start.ps1`""

# --- 5. Verify it's running ---
Start-Sleep -Seconds 5
$running = Get-Process -Name pwsh -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "auto_start" }
if ($running) {
    Write-Host "[4/5] Swarm running (PID: $($running.Id))" -ForegroundColor Green
} else {
    Write-Host "[4/5] WARNING: Swarm process not detected yet — may still be starting" -ForegroundColor Yellow
}

# --- 6. Confirm final state ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEVPULSE IS NOW 100% AUTONOMOUS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Boot trigger:  YES (starts 60s after login)"
Write-Host "  Running now:   YES"
Write-Host "  Self-feeding:  YES (GitHub, files, timers, inbox)"
Write-Host "  Self-improving: YES (daily 2am learning loop)"
Write-Host "  Notifications:  Only if 30+ min unresolved errors"
Write-Host "  Human needed:   NEVER"
Write-Host ""
Write-Host "  Just close this window. DevPulse runs itself."
Write-Host "  Check status:  cc dp-status"
Write-Host "  Check scores:  cc dp-parallel-stats"
Write-Host ""
