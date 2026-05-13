# DevPulse Autonomous Health Check
# Runs every hour via Task Scheduler or auto_start.ps1
# Auto-heals common failures. Escalates only if unresolvable.

param(
    [switch]$Verbose
)

$DEVPULSE_ROOT = "C:\Users\aksha\Downloads\DevPulse_Complete_Codebase"
$HEALTH_LOG = "$DEVPULSE_ROOT\.team\autonomy\health.log"
$ERROR_THRESHOLD = 3  # Max auto-heal attempts per issue

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
$issues = @()
$resolved = @()
$unresolved = @()

function Write-HealthLog {
    param([string]$Level, [string]$Message)
    $entry = "$timestamp|$Level|$Message"
    Add-Content -Path $HEALTH_LOG -Value $entry
    if ($Verbose) { Write-Host $entry -ForegroundColor $(if ($Level -eq "ERROR") { "Red" } elseif ($Level -eq "WARN") { "Yellow" } else { "Gray" }) }
}

Write-HealthLog "INFO" "Health check started"

# --- CHECK 1: API Health Endpoint ---
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10 -ErrorAction Stop
    if ($response.status -ne "OK") {
        $issues += "API_HEALTH: status is '$($response.status)', expected 'OK'"
    }
} catch {
    $issues += "API_HEALTH: endpoint unreachable — $_"
}

# --- CHECK 2: Swarm Process Health ---
if (Test-Path "$DEVPULSE_ROOT\.team\autonomy\swarm.pid") {
    $savedPid = Get-Content "$DEVPULSE_ROOT\.team\autonomy\swarm.pid"
    $process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    if (-not $process) {
        $issues += "SWARM_PROCESS: PID $savedPid not running — needs restart"
    }
} else {
    $issues += "SWARM_PID: PID file missing — swarm may not be running"
}

# --- CHECK 3: Agent Count ---
$agentCount = (Get-ChildItem "$DEVPULSE_ROOT\agents\*.md" -ErrorAction SilentlyContinue | Measure-Object).Count
if ($agentCount -lt 20) {
    $issues += "AGENT_COUNT: $agentCount agents (<20 minimum) — need restoration"
}

# --- CHECK 4: Memory / Log Integrity ---
$requiredDirs = @(
    ".team\memory",
    ".team\autonomy",
    ".team\learning",
    ".team\errors",
    ".team\deferred"
)
foreach ($dir in $requiredDirs) {
    $fullPath = "$DEVPULSE_ROOT\$dir"
    if (-not (Test-Path $fullPath)) {
        try {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            $resolved += "DIR_MISSING: $dir — auto-created"
        } catch {
            $issues += "DIR_CREATE_FAIL: $dir — $_"
        }
    }
}

# --- CHECK 5: Git Repository Health ---
Push-Location $DEVPULSE_ROOT
try {
    $gitStatus = & git status --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) {
        $issues += "GIT: status failed — $gitStatus"
    }
    
    $branch = & git branch --show-current 2>&1
    if (-not $branch) {
        $issues += "GIT: cannot determine current branch"
    }
} catch {
    $issues += "GIT: repository check failed — $_"
} finally {
    Pop-Location
}

# --- CHECK 6: Recent Error Count ---
$errorFiles = Get-ChildItem "$DEVPULSE_ROOT\.team\errors\*.log" -ErrorAction SilentlyContinue
$recentErrors = $errorFiles | Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-1) }
if ($recentErrors.Count -gt 10) {
    $issues += "ERROR_RATE: $($recentErrors.Count) errors in last hour — elevated"
}

# --- CHECK 7: Disk Space ---
$drive = Get-PSDrive -Name (Split-Path $DEVPULSE_ROOT -Qualifier).TrimEnd(':')
if ($drive.Free -lt 1GB) {
    $issues += "DISK_SPACE: $([math]::Round($drive.Free/1MB, 2)) MB free — critical"
}

# --- CHECK 8: Parallel Score Health ---
if (Test-Path "$DEVPULSE_ROOT\.team\memory\parallel_scores.log") {
    $scores = Get-Content "$DEVPULSE_ROOT\.team\memory\parallel_scores.log" | Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}' }
    $negativeScores = ($scores | Where-Object { $_ -match '\|-5\||\|-2\|' }).Count
    if ($negativeScores -gt ($scores.Count * 0.3)) {
        $issues += "PARL_HEALTH: $negativeScores negative scores — detection may need tuning"
    }
}

# --- AUTO-HEAL ATTEMPTS ---
Write-HealthLog "INFO" "Issues found: $($issues.Count), Attempting auto-heal..."

foreach ($issue in $issues) {
    Write-HealthLog "WARN" "Issue: $issue"
    $healAttempts = 0
    $healed = $false
    
    if ($issue -match "API_HEALTH") {
        Write-HealthLog "INFO" "Auto-healing: API health..."
        & commandcode --agent DEV-DEVOPS --prompt "auto-heal: restart all services and verify health endpoint" --non-interactive
        Start-Sleep -Seconds 30
        try {
            $retry = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10
            if ($retry.status -eq "OK") {
                $resolved += "API_HEALTH: auto-healed — services restarted"
                $healed = $true
            }
        } catch {}
    }
    
    if ($issue -match "SWARM_PROCESS|SWARM_PID") {
        Write-HealthLog "INFO" "Auto-healing: Swarm process..."
        Start-Process -NoNewWindow -FilePath "pwsh" -ArgumentList "-File `"$DEVPULSE_ROOT\scripts\auto_start.ps1`" --resume"
        $resolved += "SWARM: auto-restarted"
        $healed = $true
    }
    
    if ($issue -match "AGENT_COUNT") {
        Write-HealthLog "INFO" "Auto-healing: Agent count..."
        & commandcode --agent AGENT-FACTORY --prompt "restore-missing-agents: restore to minimum 28 agents" --non-interactive
        $resolved += "AGENT_COUNT: auto-restore triggered"
        $healed = $true
    }
    
    if (-not $healed) {
        $unresolved += $issue
    }
}

# --- NOTIFICATION GATE ---
if ($unresolved.Count -gt 0) {
    Write-HealthLog "ERROR" "UNRESOLVED: $($unresolved -join '; ')"
    
    # Check if this is a repeated failure
    $recentFails = (Select-String -Path $HEALTH_LOG -Pattern "UNRESOLVED").Count
    if ($recentFails -ge $ERROR_THRESHOLD) {
        Write-HealthLog "ERROR" "THRESHOLD REACHED: $recentFails consecutive failures — escalating"
        & "$DEVPULSE_ROOT\scripts\notify_only_on_fail.ps1"
    }
}

# --- SUMMARY ---
$summary = "Health check: $($issues.Count) issues, $($resolved.Count) resolved, $($unresolved.Count) unresolved"
Write-HealthLog "INFO" $summary
Write-Host $summary -ForegroundColor $(if ($unresolved.Count -gt 0) { "Yellow" } else { "Green" })
