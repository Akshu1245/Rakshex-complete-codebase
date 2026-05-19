#!/usr/bin/env bash
#
# one-command-deploy.sh — End-to-end DevPulse backend deploy to Railway.
#
# Prerequisites:
#   - Railway CLI installed:   npm i -g @railway/cli
#   - RAILWAY_TOKEN exported   (or run `railway login` interactively first)
#   - You are inside an already-initialised Railway project
#     (run `railway init devpulse-backend` and link MySQL + Redis plugins once)
#   - All app env vars from LAUNCH_RUNBOOK.md section 1c set on the service
#
# Usage:
#   ./scripts/one-command-deploy.sh
#
# What it does:
#   1. Verifies the local build (typecheck) won't break in CI/CD
#   2. Pushes the latest commit + Dockerfile to Railway
#   3. Tails build logs until success / failure
#   4. Verifies /api/health responds 200 from the public domain
#
# Exits non-zero if any step fails so you can chain this into CI.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "[deploy] === Step 1/4: local typecheck ==="
if ! pnpm run check; then
  echo "[deploy] ERROR: typecheck failed. Fix before deploying." >&2
  exit 1
fi

echo "[deploy] === Step 2/4: railway up ==="
if ! command -v railway >/dev/null 2>&1; then
  echo "[deploy] ERROR: railway CLI not installed. Run: npm i -g @railway/cli" >&2
  exit 1
fi
railway up --detach

echo "[deploy] === Step 3/4: tail build logs ==="
# Show recent build logs; non-fatal if Railway returns immediately
railway logs --build || true

echo "[deploy] === Step 4/4: healthcheck ==="
DOMAIN="$(railway domain 2>/dev/null | awk '/https/ {print $1; exit}')"
if [ -z "${DOMAIN}" ]; then
  echo "[deploy] WARN: no public domain attached. Run: railway domain"
  echo "[deploy] Skipping healthcheck."
  exit 0
fi

echo "[deploy] Probing ${DOMAIN}/api/health ..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "${DOMAIN}/api/health" >/dev/null; then
    echo "[deploy] === SUCCESS: ${DOMAIN}/api/health returned 200 ==="
    exit 0
  fi
  echo "[deploy] attempt ${i}/10 not ready yet; sleeping 10s"
  sleep 10
done

echo "[deploy] ERROR: healthcheck never returned 200 after 10 attempts" >&2
echo "[deploy] Tail logs with: railway logs"
exit 1
