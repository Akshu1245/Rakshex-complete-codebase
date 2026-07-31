#!/usr/bin/env bash
set -e

echo "=========================================="
echo "   Deploying Rakshex to rakshex.in        "
echo "=========================================="

if [ ! -f .env.production ]; then
  echo "[!] Creating .env.production from defaults..."
  cp .env.example .env.production 2>/dev/null || true
fi

echo "[1/4] Running Database Migrations..."
DATABASE_URL="${DATABASE_URL:-postgresql://rakshex:password@localhost:5432/rakshex}" pnpm db:migrate || true

echo "[2/4] Building & Launching Production Services via Docker..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "[3/4] Checking Health..."
sleep 5
curl -s http://localhost:3000/api/health || echo "[!] Health check pending startup"

echo "=========================================="
echo " Rakshex Deployment Initiated!"
echo " Web: https://www.rakshex.in"
echo " API: https://api.rakshex.in"
echo "=========================================="
