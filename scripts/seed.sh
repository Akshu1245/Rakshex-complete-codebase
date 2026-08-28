#!/usr/bin/env bash
set -euo pipefail

# Thin wrapper around the canonical synthetic local-development seed.
# This file intentionally contains no hard-coded demo credentials.

cd "$(dirname "$0")/.."

if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "ERROR: synthetic seeding is disabled when NODE_ENV=production." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required. Configure the local PostgreSQL URL first." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" != "24" ]; then
  echo "ERROR: this repository declares Node 24.x; found Node ${NODE_MAJOR}." >&2
  exit 1
fi

echo "Seeding synthetic local-development data through @rakshex/database..."
pnpm db:seed
