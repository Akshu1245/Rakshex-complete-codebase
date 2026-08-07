#!/bin/sh
#
# migrate.sh — Safe database migration runner for Rakshex.
#
# Usage: ./scripts/migrate.sh
#
# Uses the authoritative Postgres migrator:
#   pnpm --filter @rakshex/database db:migrate
# (Do NOT use drizzle-kit migrate here — it tracks a different table.)
#

set -e

echo "[migrate] Starting database migration..."
START=$(date +%s)

if [ -z "$DATABASE_URL" ]; then
  echo "[migrate] ERROR: DATABASE_URL is not set"
  exit 1
fi

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[migrate] Running pnpm --filter @rakshex/database db:migrate..."
pnpm --filter @rakshex/database db:migrate 2>&1 | tee /tmp/migrate.log

END=$(date +%s)
DURATION=$((END - START))
echo "[migrate] Complete — duration: ${DURATION}s"

echo "[migrate] Verifying database connectivity..."
node -e "
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
  console.log('[migrate] Database connectivity verified');
})().catch((err) => {
  console.error('[migrate] ERROR: Could not connect after migration:', err.message);
  process.exit(1);
});
"

echo "[migrate] Done."
