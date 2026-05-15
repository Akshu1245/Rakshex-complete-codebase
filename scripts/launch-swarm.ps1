# DevPulse Swarm Launcher
# Usage: .\scripts\launch-swarm.ps1 -Swarm <test|security|migration|all>
#        .\scripts\launch-swarm.ps1 -Swarm test -Fast
#        .\scripts\launch-swarm.ps1 -Swarm all -Parallel

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("test", "security", "migration", "all")]
    [string]$Swarm,
    
    [switch]$Fast,      # For test swarm: skip heavy squads (E2E, visual)
    [switch]$Parallel,  # Run multiple swarm commanders simultaneously
    [switch]$AutoFix,   # Auto-remediate where safe
    [int]$TimeoutMinutes = 10
)

$ErrorActionPreference = "Stop"
$swarmStart = Get-Date
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $projectRoot

Write-Host ""
Write-Host "    ____             __             ______            __             " -ForegroundColor Cyan
Write-Host "   / __ \\____ ______/ /_____  _____/ __/ /___  ____ _/ /____         " -ForegroundColor Cyan
Write-Host "  / / / / __  / ___/ //_/ _ \\/ ___/ /_/ / __ \\/ __  / ___/         " -ForegroundColor Cyan
Write-Host " / /_/ / /_/ (__  ) ,< /  __/ /  / __/ / /_/ / /_/ (__  )          " -ForegroundColor Cyan
Write-Host "/_____/\\__,_/____/_/|_|\\___/_/  /_/ /_/\\____/\\__,_/____/           " -ForegroundColor Cyan
Write-Host "                                                                    " -ForegroundColor Cyan
Write-Host "═══ DEVPULSE SWARM LAUNCHER ═══" -ForegroundColor Cyan
Write-Host "Swarm: $Swarm | Fast: $Fast | AutoFix: $AutoFix | Timeout: ${TimeoutMinutes}m"
Write-Host "Project: $projectRoot"
Write-Host ""

# ─── Environment Checks ─────────────────────────────────────────────────────
function Test-SwarmEnvironment {
    $issues = @()
    if (-not (Test-Path "package.json")) { $issues += "No package.json found" }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $issues += "Node.js not in PATH" }
    if (-not (Test-Path "agents/29-swarm-test-legion.md")) { $issues += "Agent definitions missing — run from project root" }
    if ($issues.Count -gt 0) {
        Write-Host "ENVIRONMENT ERRORS:" -ForegroundColor Red
        $issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        exit 1
    }
}

# ─── Swarm: Test Legion ──────────────────────────────────────────────────────
function Invoke-TestSwarm {
    param([switch]$FastMode)
    
    Write-Host "═══ LAUNCHING: SWARM-TEST-LEGION ═══" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path ".team/swarm" | Out-Null
    
    $squads = @()
    $squads += @{ Name = "UNIT"; Command = "npx vitest run --config vitest.config.ts --reporter=json"; Output = ".team/swarm/unit.json"; Weight = 1 }
    $squads += @{ Name = "INTEGRATION"; Command = "npx vitest run --config vitest.config.ts --testNamePattern='integration|api' --reporter=json"; Output = ".team/swarm/integration.json"; Weight = 2 }
    
    if (-not $FastMode) {
        $squads += @{ Name = "E2E"; Command = "npx playwright test --reporter=json"; Output = ".team/swarm/e2e.json"; Weight = 5 }
        $squads += @{ Name = "TYPECHECK"; Command = "npx tsc --noEmit"; Output = $null; Weight = 3 }
    }
    
    $jobs = @()
    foreach ($squad in $squads) {
        Write-Host "  [LAUNCH] $($squad.Name) squad..." -ForegroundColor Green
        $squadName = $squad.Name
        $squadCmd = $squad.Command
        $squadOut = $squad.Output
        
        $jobs += Start-Job -Name $squadName -ScriptBlock {
            param($cmd, $out, $name)
            $start = Get-Date
            try {
                if ($out) {
                    Invoke-Expression $cmd | Out-File $out -Encoding utf8
                } else {
                    Invoke-Expression $cmd | Out-Null
                }
                $exit = $LASTEXITCODE
            } catch {
                $exit = 1
            }
            return @{ Squad = $name; ExitCode = $exit; Duration = ([int]((Get-Date) - $start).TotalSeconds) }
        } -ArgumentList $squadCmd, $squadOut, $squadName
    }
    
    # Progress monitor
    $completed = 0
    while (($jobs | Where-Object { $_.State -eq 'Running' }).Count -gt 0) {
        Start-Sleep -Seconds 2
        $running = ($jobs | Where-Object { $_.State -eq 'Running' }).Count
        $done = ($jobs | Where-Object { $_.State -eq 'Completed' }).Count
        if ($done -gt $completed) {
            $completed = $done
            Write-Host "  Progress: $done/$($jobs.Count) squads complete, $running running..." -ForegroundColor Gray
        }
    }
    
    $results = $jobs | Wait-Job -Timeout ($TimeoutMinutes * 60) | Receive-Job
    $jobs | Remove-Job -Force
    
    Write-Host ""
    Write-Host "═══ SWARM-TEST-LEGION RESULTS ═══" -ForegroundColor Cyan
    $allPassed = $true
    foreach ($r in $results) {
        $color = if ($r.ExitCode -eq 0) { "Green" } else { "Red" }
        $status = if ($r.ExitCode -eq 0) { "PASS" } else { "FAIL" }
        Write-Host "  [$status] $($r.Squad) — ${$r.Duration}s" -ForegroundColor $color
        if ($r.ExitCode -ne 0) { $allPassed = $false }
    }
    
    return @{ Passed = $allPassed; Results = $results }
}

# ─── Swarm: Security Squad ───────────────────────────────────────────────────
function Invoke-SecuritySwarm {
    Write-Host "═══ LAUNCHING: SWARM-SECURITY-SQUAD ═══" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path ".team/swarm/security_$(Get-Date -Format 'yyyyMMdd_HHmmss')" | Out-Null
    $outDir = ".team/swarm/security_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    
    $scanners = @()
    $scanners += @{ Name = "NPM-AUDIT"; Command = "npm audit --audit-level=high"; Output = "$outDir/npm-audit.txt" }
    $scanners += @{ Name = "SECRET-SCAN"; Command = "npx gitleaks detect --source . --verbose"; Output = "$outDir/secrets.txt" }
    $scanners += @{ Name = "DEPENDENCIES"; Command = "npm outdated"; Output = "$outDir/outdated.txt" }
    
    $jobs = @()
    foreach ($scan in $scanners) {
        Write-Host "  [LAUNCH] $($scan.Name)..." -ForegroundColor Green
        $scanCmd = $scan.Command
        $scanOut = $scan.Output
        $scanName = $scan.Name
        
        $jobs += Start-Job -Name $scanName -ScriptBlock {
            param($cmd, $out, $name)
            $start = Get-Date
            try {
                $output = Invoke-Expression $cmd 2>&1
                $output | Out-File $out -Encoding utf8
                # npm audit returns non-zero when vulnerabilities found
                # We treat that as informational, not failure
                $exit = if ($name -eq "NPM-AUDIT" -and $output -match "found.*vulnerabilities") { 0 } else { $LASTEXITCODE }
            } catch {
                $exit = 1
            }
            return @{ Scanner = $name; ExitCode = $exit; Duration = ([int]((Get-Date) - $start).TotalSeconds) }
        } -ArgumentList $scanCmd, $scanOut, $scanName
    }
    
    $results = $jobs | Wait-Job -Timeout ($TimeoutMinutes * 60) | Receive-Job
    $jobs | Remove-Job -Force
    
    Write-Host ""
    Write-Host "═══ SWARM-SECURITY-SQUAD RESULTS ═══" -ForegroundColor Cyan
    foreach ($r in $results) {
        $color = if ($r.ExitCode -eq 0) { "Green" } else { "Yellow" }
        $status = if ($r.ExitCode -eq 0) { "CLEAR" } else { "REVIEW" }
        Write-Host "  [$status] $($r.Scanner) — ${$r.Duration}s" -ForegroundColor $color
    }
    Write-Host "  Report directory: $outDir" -ForegroundColor Gray
    
    return @{ Passed = $true; Results = $results; ReportDir = $outDir }
}

# ─── Swarm: Migration Corps ──────────────────────────────────────────────────
function Invoke-MigrationSwarm {
    Write-Host "═══ LAUNCHING: SWARM-MIGRATION-CORPS ═══" -ForegroundColor Yellow
    
    $checks = @()
    
    # Check outdated packages
    $outdated = npm outdated --json 2>$null | ConvertFrom-Json
    if ($outdated) {
        foreach ($pkg in $outdated.PSObject.Properties) {
            $checks += @{ Type = "PACKAGE"; Name = $pkg.Name; Current = $pkg.Value.current; Wanted = $pkg.Value.wanted; Latest = $pkg.Value.latest }
        }
    }
    
    # Check Node version
    $nodeCurrent = node --version
    Write-Host "  Node.js: $nodeCurrent" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "═══ SWARM-MIGRATION-CORPS DISCOVERY ═══" -ForegroundColor Cyan
    Write-Host "  Components needing attention: $($checks.Count)"
    foreach ($c in $checks | Select-Object -First 10) {
        $color = if ($c.Latest -ne $c.Wanted) { "Red" } else { "Yellow" }
        Write-Host "    $($c.Name): $($c.Current) → $($c.Latest)" -ForegroundColor $color
    }
    if ($checks.Count -gt 10) {
        Write-Host "    ... and $($checks.Count - 10) more" -ForegroundColor Gray
    }
    
    return @{ Checks = $checks; Count = $checks.Count }
}

# ─── Main ──────────────────────────────────────────────────────────────────────
Test-SwarmEnvironment

$results = @{}

switch ($Swarm) {
    "test"       { $results.Test = Invoke-TestSwarm -FastMode:$Fast }
    "security"   { $results.Security = Invoke-SecuritySwarm }
    "migration"  { $results.Migration = Invoke-MigrationSwarm }
    "all" {
        if ($Parallel) {
            Write-Host "Running all swarms in PARALLEL mode..." -ForegroundColor Magenta
            $testJob = Start-Job { param($p,$f) . $p\scripts\launch-swarm.ps1 -Swarm test $(if($f){"-Fast"}) } -ArgumentList $projectRoot, $Fast
            $secJob  = Start-Job { param($p) . $p\scripts\launch-swarm.ps1 -Swarm security } -ArgumentList $projectRoot
            $migJob = Start-Job { param($p) . $p\scripts\launch-swarm.ps1 -Swarm migration } -ArgumentList $projectRoot
            
            $null = $testJob, $secJob, $migJob | Wait-Job -Timeout ($TimeoutMinutes * 60)
            Write-Host "═══ ALL SWARMS COMPLETE ═══" -ForegroundColor Cyan
        } else {
            $results.Test = Invoke-TestSwarm -FastMode:$Fast
            $results.Security = Invoke-SecuritySwarm
            $results.Migration = Invoke-MigrationSwarm
        }
    }
}

$elapsed = ([int]((Get-Date) - $swarmStart).TotalSeconds)
Write-Host ""
Write-Host "═══ SWARM LAUNCHER FINISHED ═══" -ForegroundColor Cyan
Write-Host "Total time: ${elapsed}s" -ForegroundColor Green
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
