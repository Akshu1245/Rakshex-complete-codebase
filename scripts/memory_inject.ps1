# Memory injection fallback - searches codemem store
param([string]$Query)

$MEM_DIR = "$env:USERPROFILE\.commandcode\codemem\data"
$PROJECT_DIR = "C:\Users\aksha\Downloads\DevPulse_Complete_Codebase"

if (-not $Query) {
    Write-Host "[] No query provided"
    exit 0
}

Write-Host "[MEMORY] Searching: $Query"

# Search decisions
if (Test-Path "$MEM_DIR\memory.json") {
    $m = Get-Content "$MEM_DIR\memory.json" -Raw | ConvertFrom-Json
    $m.decisions | Where-Object { $_.text -match $Query } | ForEach-Object {
        Write-Host "  [$($_.ts)] $($_.text)"
    }
}

# File search fallback
Get-ChildItem $PROJECT_DIR -Recurse -Include *.ts,*.tsx,*.js -Exclude node_modules,*test* -ErrorAction SilentlyContinue |
    Select-String -Pattern $Query -SimpleMatch -ErrorAction SilentlyContinue |
    Select-Object -First 3 |
    ForEach-Object {
        $line = if ($_.Line.Length -gt 120) { $_.Line.Substring(0, 120) } else { $_.Line }
        Write-Host "  [$($_.Filename):$($_.LineNumber)] $line"
    }
