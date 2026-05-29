# Rakshex Autonomous Command Aliases
# Source this in your PowerShell profile for full autonomy mode
# Add to $PROFILE: . C:\Users\aksha\devpulse-complete-codebase\scripts\autonomous_profile.ps1

# Full autonomy: no prompts, no confirmations, no waiting
function cc {
    commandcode --yolo --auto-accept --permission-mode auto-accept @args
}

# Short alias chain
Set-Alias -Name cc -Value cc -Force
Set-Alias -Name rx -Value cc -Force  # 'rx' for quick Rakshex commands

# Auto-start the swarm (runs on shell open)
function Start-RakshexSwarm {
    $swarmRunning = Get-Process -Name commandcode -ErrorAction SilentlyContinue
    if (-not $swarmRunning) {
        Write-Host "Rakshex swarm not running — auto-starting..." -ForegroundColor Cyan
        Start-Process -NoNewWindow -FilePath "pwsh" -ArgumentList "-File `"C:\Users\aksha\devpulse-complete-codebase\scripts\auto_start.ps1`""
    } else {
        Write-Host "Rakshex swarm already running (PID: $($swarmRunning.Id))" -ForegroundColor Green
    }
}

# Convenience commands for autonomy
function rx-status {
    commandcode --yolo --auto-accept "status"
}

# Auto-start on profile load (uncomment to enable)
# Start-RakshexSwarm

Write-Host "Rakshex Autonomous Mode Active | Commands: cc, rx, rx-status" -ForegroundColor Green
