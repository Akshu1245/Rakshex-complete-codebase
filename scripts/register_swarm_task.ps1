# DevPulse Task Scheduler Registration
# Installs the swarm as a Windows scheduled task that auto-starts on boot.
# Run once: powershell -ExecutionPolicy Bypass -File scripts\register_swarm_task.ps1

$taskName = "DevPulse_Autonomous_Swarm"
$scriptPath = "$PSScriptRoot\auto_start.ps1"
$pythonPath = (Get-Command python).Source

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing task: $taskName"
}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "DevPulse Autonomous AI Engineering Swarm — discovers and fixes code continuously"
Write-Host "Registered: $taskName"
Write-Host "  - Starts on boot"
Write-Host "  - Auto-restarts on crash (3 retries)"
Write-Host "  - Runs 24/7 in background"
Write-Host ""
Write-Host "To start now: devpulse start"
Write-Host "To stop:      Stop-ScheduledTask -TaskName '$taskName'"
Write-Host "To remove:    Unregister-ScheduledTask -TaskName '$taskName'"
