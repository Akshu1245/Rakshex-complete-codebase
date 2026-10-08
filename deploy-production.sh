#!/usr/bin/env bash
set -e

echo "=========================================="
echo "   Deploying Rakshex to rakshex.in        "
echo "=========================================="

# Never initialize a production secrets file with sample credentials.
if [ ! -f .env.production ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] Supply a real .env.production and export DATABASE_URL before deploying." >&2
  exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL must be exported for migrations; refusing placeholder credentials." >&2
  exit 1
fi

echo "[1/4] Running Database Migrations..."
pnpm db:migrate

echo "[2/4] Building & Launching Production Services via Docker..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "[3/4] Checking Health..."
sleep 5
curl --fail --show-error --silent --max-time 15 http://localhost:3000/api/health

echo "=========================================="
echo " Rakshex deployment health check passed!"
echo " Web: https://www.rakshex.in"
echo " API: https://api.rakshex.in"
echo "=========================================="
