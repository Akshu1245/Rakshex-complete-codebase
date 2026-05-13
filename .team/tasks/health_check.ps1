# health_check.ps1
$healthy = $true

# Check 1: Agent files exist
$agentCount = (Get-ChildItem "agents/*.md" -ErrorAction SilentlyContinue).Count
if ($agentCount -lt 20) { $healthy = $false; Write-Host "WARNING: Only $agentCount agents found" }

# Check 2: Memory directory exists
if (-not (Test-Path ".team/memory")) { $healthy = $false; Write-Host "WARNING: Memory directory missing" }

# Check 3: Hermes database exists
if (-not (Test-Path "hermes/memory/hermes_memory.db")) { $healthy = $false; Write-Host "WARNING: Hermes database missing" }

# Auto-heal if unhealthy
if (-not $healthy) {
    Write-Host "Auto-healing DevPulse..." -ForegroundColor Yellow
    commandcode "/sequential auto-repair: restore missing components"
}

exit 0
