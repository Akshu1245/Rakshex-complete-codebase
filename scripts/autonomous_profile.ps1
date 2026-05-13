# DevPulse Autonomous Command Aliases
# Source this in your PowerShell profile for full autonomy mode
# Add to $PROFILE: . C:\Users\aksha\Downloads\DevPulse_Complete_Codebase\scripts\autonomous_profile.ps1

# Full autonomy: no prompts, no confirmations, no waiting
function cc {
    commandcode --yolo --auto-accept --permission-mode auto-accept @args
}

# Short alias chain
Set-Alias -Name cc -Value cc -Force
Set-Alias -Name dp -Value cc -Force  # 'dp' for quick DevPulse commands

# Auto-start the swarm (runs on shell open)
function Start-DevPulseSwarm {
    $swarmRunning = Get-Process -Name commandcode -ErrorAction SilentlyContinue
    if (-not $swarmRunning) {
        Write-Host "DevPulse swarm not running — auto-starting..." -ForegroundColor Cyan
        Start-Process -NoNewWindow -FilePath "pwsh" -ArgumentList "-File `"C:\Users\aksha\Downloads\DevPulse_Complete_Codebase\scripts\auto_start.ps1`""
    } else {
        Write-Host "DevPulse swarm already running (PID: $($swarmRunning.Id))" -ForegroundColor Green
    }
}

# Convenience commands for autonomy
function dp-status {
    commandcode --yolo --auto-accept "status"
}

function dp-meeting {
    commandcode --yolo --auto-accept "meeting"
}

function dp-parallel-stats {
    commandcode --yolo --auto-accept "/parallel-stats"
}

# Auto-start on profile load (uncomment to enable)
# Start-DevPulseSwarm

Write-Host "DevPulse Autonomous Mode Active | Commands: cc, dp, dp-status, dp-meeting, dp-parallel-stats" -ForegroundColor Green
