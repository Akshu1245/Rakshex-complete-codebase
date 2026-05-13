# DevPulse Autonomous Swarm Startup Script
# Triggers on Windows boot. Self-maintaining. Zero human input required.
# Install: Register via Task Scheduler or add to Startup folder.

$ErrorActionPreference = "Continue"
$DEVPULSE_ROOT = "C:\Users\aksha\Downloads\DevPulse_Complete_Codebase"
$PID_FILE = "$DEVPULSE_ROOT\.team\autonomy\swarm.pid"
$RESTART_LOG = "$DEVPULSE_ROOT\.team\autonomy\restart.log"

# Ensure autonomy directories exist
$dirs = @(
    "$DEVPULSE_ROOT\.team\autonomy",
    "$DEVPULSE_ROOT\.team\learning",
    "$DEVPULSE_ROOT\.team\deferred",
    "$DEVPULSE_ROOT\.team\rules",
    "$DEVPULSE_ROOT\.team\errors"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# Announce startup
$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
Write-Host "DEVPULSE AUTONOMOUS SWARM v2.0 — Starting at $timestamp" -ForegroundColor Cyan
Write-Host "Root: $DEVPULSE_ROOT" -ForegroundColor Gray
Write-Host "Mode: 100% AUTONOMOUS — Zero human input" -ForegroundColor Green
Write-Host "I think for myself. I find my own work. I never ask." -ForegroundColor Green

# Launch task generator in background (finds work autonomously)
$taskGenScript = "$DEVPULSE_ROOT\scripts\task_generator.py"
if (Test-Path $taskGenScript) {
    Write-Host "Launching autonomous task generator..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath "python" -ArgumentList $taskGenScript
    Write-Host "  Task generator: ACTIVE (7 sources, every 5 min)" -ForegroundColor Green
}

# Launch Hermes agent loop in background
$hermesLoop = "$DEVPULSE_ROOT\hermes\agent_loop.py"
if (Test-Path $hermesLoop) {
    Write-Host "Launching Hermes agent loop..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath "python" -ArgumentList $hermesLoop
    Write-Host "  Hermes loop: ACTIVE (Sense -> Think -> Act, FTS5 memory)" -ForegroundColor Green
}

# Launch autonomous executor in background
$executor = "$DEVPULSE_ROOT\scripts\autonomous_executor.py"
if (Test-Path $executor) {
    Write-Host "Launching autonomous executor..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath "python" -ArgumentList "$executor --daemon"
    Write-Host "  Executor: ACTIVE (writes tasks to .team/inbox/ for Codex)" -ForegroundColor Green
}

# Record PID
$pid | Out-File -FilePath $PID_FILE -Force

# Crash recovery: monitor swarm process
function Monitor-SwarmHealth {
    param([int]$MainPid)
    
    $swarmProcess = Get-Process -Id $MainPid -ErrorAction SilentlyContinue
    if (-not $swarmProcess) {
        $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
        "$ts : Swarm died — auto-restarting" | Out-File -Append -FilePath $RESTART_LOG
        Write-Host "SWARM CRASHED — Auto-restarting..." -ForegroundColor Red
        Start-Process -NoNewWindow -FilePath "pwsh" -ArgumentList "-File `"$PSCommandPath`" --resume" 
        exit
    }
}

# Health check: verify critical services
function Test-CriticalServices {
    $issues = @()
    
    # Check main health endpoint
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5 -ErrorAction Stop
        if ($health.status -ne "OK") { $issues += "Health endpoint not OK" }
    } catch {
        $issues += "Health endpoint unreachable"
    }
    
    # Check agent count
    $agentCount = (Get-ChildItem "$DEVPULSE_ROOT\agents\*.md" -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($agentCount -lt 20) {
        $issues += "Agent count low: $agentCount (<20 minimum)"
    }
    
    # Check memory/log store
    if (-not (Test-Path "$DEVPULSE_ROOT\.team\memory")) {
        $issues += "Memory directory missing"
    }
    
    return $issues
}

# Auto-heal: attempt recovery when issues found
function Invoke-AutoHeal {
    param([string[]]$Issues)
    
    Write-Host "AUTO-HEAL triggered for: $($Issues -join ', ')" -ForegroundColor Yellow
    Write-Host "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss') : Auto-heal: $($Issues -join ', ')" | Out-File -Append -FilePath "$DEVPULSE_ROOT\.team\autonomy\heal.log"
    
    foreach ($issue in $Issues) {
        if ($issue -match "Agent count") {
            Write-Host "  Restoring agents via AGENT-FACTORY..." -ForegroundColor Yellow
            python -c "
import sys; sys.path.insert(0, r'$DEVPULSE_ROOT')
from hermes.agent_loop import HermesAgent
import asyncio
async def heal():
    agent = HermesAgent()
    await agent.submit_task('restore missing agents to minimum 28', 'AGENT-FACTORY')
    agent.memory.close()
asyncio.run(heal())
"
        }
        if ($issue -match "Health endpoint") {
            Write-Host "  Restarting services..." -ForegroundColor Yellow
            python -c "
import sys; sys.path.insert(0, r'$DEVPULSE_ROOT')
from hermes.agent_loop import HermesAgent
import asyncio
async def heal():
    agent = HermesAgent()
    await agent.submit_task('restart all services and health endpoint', 'DEV-DEVOPS')
    agent.memory.close()
asyncio.run(heal())
"
        }
    }
}

# Dispatch a task to a DevPulse agent via Hermes
function Invoke-AgentDispatch {
    param([string]$AgentName, [string]$TaskDescription, [string]$Mode = "auto")
    
    $agentPy = @"
import sys; sys.path.insert(0, r'$DEVPULSE_ROOT')
from hermes.agent_loop import HermesAgent, GatewayEvent
from hermes.workflow_router import router, execute
import asyncio, json

async def dispatch():
    agent = HermesAgent()
    plan = router.resolve_command('$TaskDescription')
    result = await execute(plan, agent)
    print(result)
    agent.memory.close()

asyncio.run(dispatch())
"@

    $result = python -c $agentPy 2>&1
    return $result
}

# Dispatch parallel tasks via autonomous executor
function Invoke-ParallelDispatch {
    param([string]$TaskDescription)
    python "$DEVPULSE_ROOT\scripts\autonomous_executor.py" PULSE-COMMAND "$TaskDescription"
}

# Main autonomy loop
Write-Host "Entering autonomy loop... (Ctrl+C to stop)" -ForegroundColor Cyan

while ($true) {
    $cycleStart = Get-Date
    
    # --- STEP 1: Monitor process health ---
    Monitor-SwarmHealth -MainPid $pid
    
    # --- STEP 2: Health check ---
    $healthIssues = Test-CriticalServices
    if ($healthIssues.Count -gt 0) {
        Invoke-AutoHeal -Issues $healthIssues
    }
    
    # --- STEP 3: Scan ALL monitored projects (from global config) ---
    $globalConfig = "$env:USERPROFILE\.devpulse\projects.json"
    $repos = @()
    
    if (Test-Path $globalConfig) {
        $config = Get-Content $globalConfig | ConvertFrom-Json
        $repos = @($config.projects | Where-Object { Test-Path "$_\.git" })
        if ($repos.Count -eq 0) {
            $repos = @($DEVPULSE_ROOT)
        }
    } else {
        $repos = @($DEVPULSE_ROOT)
    }
    
    Write-Host "Scanning $($repos.Count) monitored project(s)..." -ForegroundColor DarkGray
    
    foreach ($repo in $repos) {
        $repoName = Split-Path $repo -Leaf
        Push-Location $repo
        try {
            $hasChanges = $false
            $status = & git status --porcelain 2>$null
            if ($status) { $hasChanges = $true }
            
            $prs = & gh pr list --state open --limit 1 2>$null
            if ($prs) { $hasChanges = $true }
            
            if ($hasChanges) {
                Write-Host "  [$repoName] Work detected — dispatching swarm" -ForegroundColor Green
                Invoke-ParallelDispatch "autonomous scan, plan, execute, test, commit, push in $repoName"
            } else {
                Write-Host "  [$repoName] Clean — no work needed" -ForegroundColor DarkGray
            }
        } catch {
            Write-Host "  [$repoName] Scan error: $_" -ForegroundColor DarkGray
        } finally {
            Pop-Location
        }
    }
    
    # --- STEP 4: Check task inbox ---
    $inboxPath = "$DEVPULSE_ROOT\.team\inbox"
    $inboxFiles = Get-ChildItem -Path $inboxPath -Filter "auto_*.json" -ErrorAction SilentlyContinue
    if ($inboxFiles) {
        Write-Host "Inbox has $($inboxFiles.Count) auto-generated tasks — processing" -ForegroundColor Green
        foreach ($taskFile in $inboxFiles) {
            $task = Get-Content $taskFile.FullName | ConvertFrom-Json
            Write-Host "  Executing: $($task.task) [priority: $($task.priority)]"
            Invoke-ParallelDispatch $task.task
            Remove-Item $taskFile.FullName -Force
        }
    }
    
    # --- STEP 5: Error notification (only on persistent failures) ---
    $errorPath = "$DEVPULSE_ROOT\.team\errors"
    $errorFiles = Get-ChildItem -Path $errorPath -Filter "*.log" -ErrorAction SilentlyContinue
    if ($errorFiles) {
        $latestError = $errorFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $errorAge = (Get-Date) - $latestError.LastWriteTime
        
        if ($errorAge.TotalMinutes -gt 30) {
            Write-Host "UNRESOLVED ERROR (>30 min): $($latestError.Name)" -ForegroundColor Red
            & "$DEVPULSE_ROOT\scripts\notify_only_on_fail.ps1"
        }
    }
    
    # --- STEP 6: Check for deferred decisions ---
    $deferredPath = "$DEVPULSE_ROOT\.team\deferred"
    $deferredFiles = Get-ChildItem -Path $deferredPath -Filter "*.json" -ErrorAction SilentlyContinue
    if ($deferredFiles) {
        Write-Host "Deferred decisions pending: $($deferredFiles.Count) — re-evaluating" -ForegroundColor Yellow
        foreach ($df in $deferredFiles) {
            Invoke-ParallelDispatch "resolve deferred decision: $($df.BaseName)"
        }
    }
    
    # --- SLEEP ---
    $cycleTime = ((Get-Date) - $cycleStart).TotalSeconds
    $sleepTime = [Math]::Max(10, 300 - $cycleTime)
    Write-Host "Cycle complete (${cycleTime}s). Sleeping ${sleepTime}s..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $sleepTime
}
