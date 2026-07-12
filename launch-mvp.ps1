# DevPulse MVP Launch Helper (PowerShell)
Write-Host "DevPulse MVP Launch" -ForegroundColor Cyan

if (-not (Test-Path node_modules)) {
  pnpm install
}

if (-not (Test-Path .env)) {
  if (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Host "Created .env from .env.example — edit DATABASE_URL and JWT_SECRET before starting." -ForegroundColor Yellow
  } else {
    Write-Host "Missing .env.example — create .env manually." -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Local dev:" -ForegroundColor Green
Write-Host "  1. docker compose up -d"
Write-Host "  2. pnpm run db:migrate"
Write-Host "  3. pnpm run dev"
Write-Host ""
Write-Host "Production:" -ForegroundColor Green
Write-Host "  Backend:  node dist/server/_core/index.js"
Write-Host "  Frontend: cd devpulse-frontend; pnpm build; pnpm start"
Write-Host "  Compose:  docker compose -f docker-compose.prod.yml up -d"
