#Requires -Version 5.1
<#
.SYNOPSIS
  RaksHex health-check helper for a running deployment.
.DESCRIPTION
  Performs read-only HTTP health checks. It does not auto-restart services,
  mutate the repository, or invoke autonomous agents. Set API_URL to the API
  origin; defaults to http://127.0.0.1:3000 for local development.
#>

param(
    [string]$ApiUrl = $(if ($env:API_URL) { $env:API_URL } else { "http://127.0.0.1:3000" }),
    [switch]$CheckLocalCompose
)

$ErrorActionPreference = "Stop"
$base = $ApiUrl.TrimEnd("/")
$failures = @()

function Test-Endpoint {
    param([string]$Path)
    $uri = "$base$Path"
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $uri -TimeoutSec 10
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            $script:failures += "$Path returned HTTP $($response.StatusCode)"
            Write-Host "FAIL $Path -> HTTP $($response.StatusCode)" -ForegroundColor Red
            return
        }
        Write-Host "PASS $Path -> HTTP $($response.StatusCode)" -ForegroundColor Green
    }
    catch {
        $script:failures += "$Path unreachable: $($_.Exception.Message)"
        Write-Host "FAIL $Path -> $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "RaksHex health check: $base" -ForegroundColor Cyan
Test-Endpoint "/api/health"
Test-Endpoint "/api/health/ready"

if ($CheckLocalCompose) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $failures += "docker is unavailable for -CheckLocalCompose"
    }
    else {
        Write-Host ""
        Write-Host "Local Compose status:" -ForegroundColor Cyan
        docker compose ps
        if ($LASTEXITCODE -ne 0) {
            $failures += "docker compose ps failed"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Health check failed:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "  - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "RaksHex health check passed." -ForegroundColor Green
exit 0
