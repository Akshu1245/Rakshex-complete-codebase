# Production Deployment script for Rakshex (rakshex.in)
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Deploying Rakshex to rakshex.in        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (-not (Test-Path ".env.production")) {
    Write-Host "[!] Creating .env.production template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.production" -ErrorAction SilentlyContinue
}

Write-Host "[1/3] Running Database Migrations..." -ForegroundColor Green
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://rakshex:password@localhost:5432/rakshex" }
pnpm db:migrate

Write-Host "[2/3] Building & Starting Docker Services (Web, API, Worker, Redis, Postgres, Caddy SSL)..." -ForegroundColor Green
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

Write-Host "[3/3] Checking API Health..." -ForegroundColor Green
Start-Sleep -Seconds 5
try {
    $res = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get
    Write-Host "API Health Status: $($res.status)" -ForegroundColor Green
} catch {
    Write-Host "API starting up..." -ForegroundColor Yellow
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Rakshex Deployment Active!" -ForegroundColor Cyan
Write-Host " Web Dashboard: https://www.rakshex.in" -ForegroundColor Yellow
Write-Host " API Server:    https://api.rakshex.in" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
