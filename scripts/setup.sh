#!/usr/bin/env bash
set -euo pipefail

# RaksHex development setup.
# Prerequisites: Node.js 24.x, pnpm, Docker.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 is required but not installed." >&2
    exit 1
  fi
}

require_cmd node
require_cmd pnpm
require_cmd docker

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" != "24" ]; then
  echo "ERROR: this repository declares Node 24.x; found Node ${NODE_MAJOR}." >&2
  exit 1
fi

echo "== RaksHex development setup =="

echo "[1/5] Installing dependencies"
pnpm install --frozen-lockfile

echo "[2/5] Preparing local environment"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review local placeholders before continuing."
fi

# Load simple KEY=VALUE entries from the local development template so the
# canonical migration command sees DATABASE_URL. Do not use this helper for
# production secrets or production deployment.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "ERROR: scripts/setup.sh is a local-development helper and refuses NODE_ENV=production." >&2
  exit 1
fi

echo "[3/5] Starting PostgreSQL and Redis"
pnpm db:up

echo "[4/5] Applying canonical migrations"
pnpm db:migrate

echo "[5/5] Building repository packages/apps"
pnpm build

echo
echo "Setup complete."
echo "Start the app with: pnpm dev"
echo "Verify the API with: API_URL=http://127.0.0.1:3000 pnpm smoke:test"
echo
echo "Optional synthetic local seed: bash scripts/seed.sh"
echo "Production: follow docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md instead."
