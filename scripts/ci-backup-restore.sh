#!/usr/bin/env bash
# CI smoke: dump current DB and restore into a throwaway database.
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-rakshex}"
DB_NAME="${DB_NAME:-rakshex_mig}"
export PGPASSWORD="${PGPASSWORD:-rakshex}"

TMPDIR="${TMPDIR:-/tmp}"
DUMP="${TMPDIR}/rakshex_ci_backup_$$.sql.gz"

echo "Creating dump of ${DB_NAME}..."
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl | gzip > "${DUMP}"

export DB_HOST DB_PORT DB_USER DB_PASSWORD="${PGPASSWORD}" ADMIN_DB=postgres
bash "$(dirname "$0")/test-restore.sh" "${DUMP}"
rm -f "${DUMP}"
echo "ci-backup-restore OK"
