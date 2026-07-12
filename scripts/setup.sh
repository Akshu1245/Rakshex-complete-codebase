#!/usr/bin/env bash
set -euo pipefail

# RaksHex One-Command Setup
# Installs dependencies, sets up the database, and seeds demo data.
# Prerequisites: Node.js 20+, pnpm, PostgreSQL (or Docker)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================"
echo "  RaksHex Development Setup"
echo "======================================"

# 1. Check prerequisites
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "ERROR: $1 is required but not installed."
    exit 1
  fi
}

check_cmd node
check_cmd pnpm

echo ""
echo "Step 1/5: Installing dependencies..."
cd "${PROJECT_ROOT}"
pnpm install --frozen-lockfile

echo ""
echo "Step 2/5: Setting up environment..."
if [ ! -f "${PROJECT_ROOT}/.env.local" ]; then
  if [ -f "${PROJECT_ROOT}/.env.example" ]; then
    cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env.local"
    echo "  Created .env.local from .env.example"
    echo "  IMPORTANT: Edit .env.local and fill in your secrets (DATABASE_URL, JWT_SECRET, etc.)"
  else
    echo "  .env.example not found. Please create .env.local manually."
  fi
else
  echo "  .env.local already exists. Skipping."
fi

echo ""
echo "Step 3/5: Running database migrations..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "  DATABASE_URL not set. Trying to load from .env.local..."
  if [ -f "${PROJECT_ROOT}/.env.local" ]; then
    export $(grep -v '^#' "${PROJECT_ROOT}/.env.local" | xargs 2>/dev/null || true)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "  WARNING: DATABASE_URL is not set. Skipping migrations."
  echo "  Set it and run: pnpm run migrate"
else
  pnpm exec tsx scripts/migrate.ts || pnpm exec drizzle-kit migrate
fi

echo ""
echo "Step 4/5: Seeding demo data..."
if [ -n "${DATABASE_URL:-}" ]; then
  bash "${SCRIPT_DIR}/seed.sh"
else
  echo "  Skipping seed (no DATABASE_URL). Run scripts/seed.sh after setting DATABASE_URL."
fi

echo ""
echo "Step 5/5: Building packages..."
pnpm run build

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your actual credentials"
echo "  2. Start dev server: pnpm run dev"
echo "  3. Visit http://localhost:3000"
echo ""
echo "Demo accounts (if seeded):"
echo "  admin@rakshex.in / admin12345"
echo "  demo@rakshex.in / demo12345"
echo ""
