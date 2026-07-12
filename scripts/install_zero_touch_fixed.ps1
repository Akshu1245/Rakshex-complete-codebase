# install_zero_touch.ps1 - Fixed Windows Version
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEVPULSE ZERO-TOUCH INSTALLATION" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$taskName = "DevPulse_Autonomous"

# Check if task exists, remove if old version exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing scheduled task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Get current directory
$currentDir = Get-Location

# Create the action (start PowerShell with autonome mode)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"cd '$currentDir'; while (`$true) { try { commandcode --resume autonomous-swarm --yolo --auto-accept 2>> .team/autonomy/error.log } catch { Add-Content .team/autonomy/error.log `"`$(Get-Date): `$(`$_.Exception.Message)`" } Start-Sleep -Seconds 300 }`""

# Create trigger (at logon)
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Create settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartInterval (New-TimeSpan -Minutes 5) -RestartCount 3

# Register the task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Scheduled task installed: $taskName" -ForegroundColor Green

# Create necessary directories
New-Item -ItemType Directory -Force -Path ".team/autonomy" | Out-Null
New-Item -ItemType Directory -Force -Path ".team/tasks" | Out-Null
New-Item -ItemType Directory -Force -Path ".team/inbox" | Out-Null

# Create autonomous task generator script
$taskGenerator = @'
# task_generator.py - Auto-discovers work
import os, json, glob, subprocess
from datetime import datetime

tasks = []
repo_path = os.getcwd()

# Source 1: Uncommitted changes
result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True, cwd=repo_path)
if result.stdout.strip():
    tasks.append({"source": "git_uncommitted", "task": "Commit pending changes", "files": result.stdout.strip().split('\n')[:5]})

# Source 2: TODOs in code
for file in glob.glob('**/*.py', recursive=True) + glob.glob('**/*.ts', recursive=True) + glob.glob('**/*.md', recursive=True):
    try:
        with open(file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if 'TODO' in line.upper():
                tasks.append({"source": "todo", "task": f"Fix TODO: {line.strip()}", "file": file, "line": i+1})
                break
    except: pass

# Source 3: Untested files
for file in glob.glob('**/*.ts', recursive=True):
    test_file = file.replace('.ts', '.test.ts').replace('/server/', '/server/__tests__/')
    if not os.path.exists(test_file):
        tasks.append({"source": "untested", "task": f"Write tests for {os.path.basename(file)}", "file": file})

# Write to inbox
for i, task in enumerate(tasks[:10]):
    task_file = f".team/inbox/auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{i}.json"
    with open(task_file, 'w') as f:
        json.dump(task, f, indent=2)
    print(f"Task generated: {task['task'][:50]}...")

print(f"Generated {min(10, len(tasks))} tasks")
'@

$taskGenerator | Out-File -FilePath ".team/tasks/task_generator.py" -Encoding UTF8

Write-Host "Task generator created" -ForegroundColor Green

# Create health check script
$healthScript = @'
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
'@

$healthScript | Out-File -FilePath ".team/tasks/health_check.ps1" -Encoding UTF8

Write-Host "Health check created" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "DevPulse zero-touch autonomy is now installed." -ForegroundColor White
Write-Host ""
Write-Host "  Schedule:  $taskName" -ForegroundColor Gray
Write-Host "  Trigger:   At logon (60 second delay)" -ForegroundColor Gray
Write-Host "  Action:    Runs autonomous swarm in background" -ForegroundColor Gray
Write-Host ""
Write-Host "To verify installation:" -ForegroundColor White
Write-Host "  Get-ScheduledTask -TaskName '$taskName'" -ForegroundColor Gray
Write-Host ""
Write-Host "To test immediately instead of waiting for reboot:" -ForegroundColor White
Write-Host "  commandcode --resume autonomous-swarm --yolo --auto-accept" -ForegroundColor Gray
Write-Host ""
