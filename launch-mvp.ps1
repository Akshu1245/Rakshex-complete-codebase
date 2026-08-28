# RaksHex local launch helper (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "RaksHex Local Launch" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 24.x is required."
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm is required."
}

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($nodeMajor -ne 24) {
  throw "This repository declares Node 24.x; found Node $nodeMajor."
}

if (-not (Test-Path node_modules)) {
  pnpm install --frozen-lockfile
}

if (-not (Test-Path .env)) {
  if (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example. Set DATABASE_URL, REDIS_URL, JWT_SECRET, and RAKSHEX_VAULT_KEY before starting." -ForegroundColor Yellow
  } else {
    throw "Missing .env.example."
  }
}

Write-Host "Starting local PostgreSQL and Redis..." -ForegroundColor Green
pnpm db:up

Write-Host "Applying canonical migrations..." -ForegroundColor Green
pnpm db:migrate

Write-Host ""
Write-Host "Local prerequisites are ready." -ForegroundColor Green
Write-Host "Run: pnpm dev"
Write-Host "Then verify: pnpm smoke:test"
Write-Host ""
Write-Host "For staging/production deployment, do not use this helper." -ForegroundColor Yellow
Write-Host "Follow docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md and LAUNCH_CHECKLIST.md."
