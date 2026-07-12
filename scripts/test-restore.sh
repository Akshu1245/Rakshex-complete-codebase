#!/usr/bin/env bash
# Verify a PostgreSQL backup can be restored.
# Usage: ./scripts/test-restore.sh <backup.sql.gz|backup.sql>
set -euo pipefail

BACKUP_FILE="${1:-}"
TEST_DB_NAME="${TEST_DB_NAME:-rakshex_test_restore}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-rakshex}"
DB_PASS="${DB_PASSWORD:-${POSTGRES_PASSWORD:-rakshex}}"
# Admin DB used to CREATE/DROP databases
ADMIN_DB="${ADMIN_DB:-postgres}"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup-file>" >&2
  exit 1
fi

export PGPASSWORD="${DB_PASS}"
PSQL=(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -v ON_ERROR_STOP=1)

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Testing restore from: ${BACKUP_FILE}"

echo "Dropping test database if exists..."
"${PSQL[@]}" -d "${ADMIN_DB}" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
"${PSQL[@]}" -d "${ADMIN_DB}" -c "CREATE DATABASE ${TEST_DB_NAME};"

echo "Restoring backup..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gunzip -c "${BACKUP_FILE}" | "${PSQL[@]}" -d "${TEST_DB_NAME}"
else
  "${PSQL[@]}" -d "${TEST_DB_NAME}" < "${BACKUP_FILE}"
fi

echo "Verifying tables..."
TABLE_COUNT="$("${PSQL[@]}" -d "${TEST_DB_NAME}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")"
if [[ -z "${TABLE_COUNT}" || "${TABLE_COUNT}" -lt 1 ]]; then
  echo "ERROR: No public tables found in restored database" >&2
  "${PSQL[@]}" -d "${ADMIN_DB}" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"
  exit 1
fi

echo "Found ${TABLE_COUNT} public table(s)"
"${PSQL[@]}" -d "${TEST_DB_NAME}" -c "\dt"

echo "Cleaning up..."
"${PSQL[@]}" -d "${ADMIN_DB}" -c "DROP DATABASE IF EXISTS ${TEST_DB_NAME};"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restore test completed successfully"
