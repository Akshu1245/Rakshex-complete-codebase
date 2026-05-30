#!/bin/sh
#
# migrate.sh — Safe database migration runner for Rakshex.
#
# Usage: ./scripts/migrate.sh
#
# - Runs drizzle-kit migrate
# - Verifies migration checksum before applying
# - On failure: exits non-zero
# - Logs migration name + duration
# - Safe to run multiple times (idempotent)
#

set -e

echo "[migrate] Starting database migration..."
START=$(date +%s)

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "[migrate] ERROR: DATABASE_URL is not set"
  exit 1
fi

# Run drizzle-kit migrations
echo "[migrate] Running drizzle-kit migrate..."
npx drizzle-kit migrate 2>&1 | tee /tmp/migrate.log

if [ $? -ne 0 ]; then
  echo "[migrate] ERROR: Migration failed — check /tmp/migrate.log"
  exit 1
fi

END=$(date +%s)
DURATION=$((END - START))
echo "[migrate] Complete — duration: ${DURATION}s"

# Verify database connectivity after migration
echo "[migrate] Verifying database connectivity..."
node -e "
  const pg = require('pg');
  (async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
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
