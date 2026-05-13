# DevPulse Autonomous Notification Script
# Only triggers when swarm cannot self-resolve after 30 minutes
# Silent by design — if this runs, something actually needs attention

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$DEVPULSE_ROOT = "C:\Users\aksha\Downloads\DevPulse_Complete_Codebase"
$ERROR_DIR = "$DEVPULSE_ROOT\.team\errors"
$NOTIFY_LOG = "$DEVPULSE_ROOT\.team\autonomy\notifications.log"

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"

# --- Check if notification is warranted ---
$errorFiles = Get-ChildItem -Path $ERROR_DIR -Filter "*.log" -ErrorAction SilentlyContinue

if (-not $errorFiles -or $errorFiles.Count -eq 0) {
    # No errors — nothing to notify
    exit 0
}

$latestError = $errorFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$errorAge = (Get-Date) - $latestError.LastWriteTime

# Only notify if errors persist >30 minutes
if ($errorAge.TotalMinutes -lt 30) {
    exit 0
}

# --- Build notification content ---
$errorContent = Get-Content $latestError.FullName -Tail 10 | Out-String
$errorCount = $errorFiles.Count
$unresolvedCount = ($errorFiles | Where-Object { 
    (Get-Date) - $_.LastWriteTime -gt (Get-Date).AddMinutes(-30) 
}).Count

$message = @"
DEVPULSE AUTONOMOUS SWARM — ATTENTION NEEDED
═══════════════════════════════════════════════

$unresolvedCount unresolved errors in last 30 minutes
Total error files: $errorCount
Oldest unresolved: $([math]::Round($errorAge.TotalMinutes)) minutes ago

Latest Error ($($latestError.Name)):
$errorContent

═══════════════════════════════════════════════
Swarm attempted auto-heal 3+ times.
Check: $ERROR_DIR
Log:  $NOTIFY_LOG

System continues running. This notification is for awareness only.
"@

# --- Show Windows notification ---
[System.Windows.Forms.MessageBox]::Show(
    $message,
    "DevPulse Auto — Unresolved Errors",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Warning
)

# --- Log notification ---
"$timestamp|NOTIFY|$unresolvedCount unresolved errors|Age: $([math]::Round($errorAge.TotalMinutes))min|Files: $errorCount" | Out-File -Append -FilePath $NOTIFY_LOG

Write-Host "$timestamp : Notification sent — $unresolvedCount unresolved errors" -ForegroundColor Yellow
