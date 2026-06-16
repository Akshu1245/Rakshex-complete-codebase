#Requires -Version 5.1
<#
.SYNOPSIS
    Safe database migration runner for DevPulse (Windows).
.DESCRIPTION
    Runs drizzle-kit migrate, verifies DATABASE_URL, logs duration.
    Safe to run multiple times (idempotent).
#>
$ErrorActionPreference = "Stop"

Write-Host "[migrate] Starting database migration..." -ForegroundColor Cyan
$start = Get-Date

if (-not $env:DATABASE_URL) {
    Write-Host "[migrate] ERROR: DATABASE_URL is not set" -ForegroundColor Red
    exit 1
}

Write-Host "[migrate] Running drizzle-kit migrate..." -ForegroundColor Cyan
$logPath = "$env:TEMP\migrate-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

try {
    npx drizzle-kit migrate 2>&1 | Tee-Object -FilePath $logPath
    if ($LASTEXITCODE -ne 0) {
        throw "drizzle-kit migrate exited with code $LASTEXITCODE"
    }
} catch {
    Write-Host "[migrate] ERROR: Migration failed — check $logPath" -ForegroundColor Red
    exit 1
}

$duration = [math]::Round(((Get-Date) - $start).TotalSeconds)
Write-Host "[migrate] Complete — duration: ${duration}s" -ForegroundColor Green

# Verify connectivity with a simple ping via node
Write-Host "[migrate] Verifying database connectivity..." -ForegroundColor Cyan
node -e @"
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  await conn.ping();
  await conn.end();
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
