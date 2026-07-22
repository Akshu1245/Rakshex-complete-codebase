#Requires -Version 5.1
<#
.SYNOPSIS
    Safe database migration runner for Rakshex (Windows).
.DESCRIPTION
    Runs the authoritative Postgres migrator (`pnpm --filter @rakshex/database db:migrate`),
    verifies DATABASE_URL with `pg`, logs duration. Safe to run multiple times.
#>
$ErrorActionPreference = "Stop"

Write-Host "[migrate] Starting database migration..." -ForegroundColor Cyan
$start = Get-Date

if (-not $env:DATABASE_URL) {
    Write-Host "[migrate] ERROR: DATABASE_URL is not set" -ForegroundColor Red
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "[migrate] Running pnpm --filter @rakshex/database db:migrate..." -ForegroundColor Cyan
$logPath = "$env:TEMP\migrate-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

try {
    pnpm --filter @rakshex/database db:migrate 2>&1 | Tee-Object -FilePath $logPath
    if ($LASTEXITCODE -ne 0) {
        throw "db:migrate exited with code $LASTEXITCODE"
    }
} catch {
    Write-Host "[migrate] ERROR: Migration failed — check $logPath" -ForegroundColor Red
    exit 1
}

$duration = [math]::Round(((Get-Date) - $start).TotalSeconds)
Write-Host "[migrate] Complete — duration: ${duration}s" -ForegroundColor Green

Write-Host "[migrate] Verifying database connectivity..." -ForegroundColor Cyan
node -e @"
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
  console.log('[migrate] Database connectivity verified');
})().catch((err) => {
  console.error('[migrate] ERROR: Could not connect after migration:', err.message);
  process.exit(1);
});
"@

if ($LASTEXITCODE -ne 0) {
    exit 1
}

Write-Host "[migrate] Done." -ForegroundColor Green
