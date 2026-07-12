#!/usr/bin/env bash
# PostgreSQL backup for Rakshex
# Usage: ./scripts/backup.sh [daily|monthly]
set -euo pipefail

BACKUP_TYPE="${1:-daily}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-./backups/${BACKUP_TYPE}}"
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-rakshex}"
DB_USER="${DB_USER:-rakshex}"
DB_PASS="${DB_PASSWORD:-${POSTGRES_PASSWORD:-rakshex}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
RETENTION_MONTHS="${BACKUP_RETENTION_MONTHS:-12}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting ${BACKUP_TYPE} backup of ${DB_NAME}@${DB_HOST}"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
export PGPASSWORD="${DB_PASS}"
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl \
  | gzip > "${BACKUP_FILE}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup created: ${BACKUP_FILE} ($(wc -c < "${BACKUP_FILE}") bytes)"

if [[ -n "${S3_BUCKET}" ]] && command -v aws >/dev/null 2>&1; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Uploading to s3://${S3_BUCKET}/${BACKUP_TYPE}/"
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/${BACKUP_TYPE}/"
fi

# Retention: only delete when directory is writable and retention is positive
if [[ "${BACKUP_TYPE}" == "daily" && "${RETENTION_DAYS}" -gt 0 ]]; then
  find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print -delete || {
    echo "WARN: retention cleanup failed; backups retained" >&2
  }
elif [[ "${BACKUP_TYPE}" == "monthly" && "${RETENTION_MONTHS}" -gt 0 ]]; then
  DAYS=$((RETENTION_MONTHS * 30))
  find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime "+${DAYS}" -print -delete || {
    echo "WARN: retention cleanup failed; backups retained" >&2
  }
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup process completed"
echo "${BACKUP_FILE}"
