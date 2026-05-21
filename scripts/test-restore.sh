#!/bin/bash
# Test Restore Script - Verifies backup integrity
# Usage: ./test-restore.sh <backup-file>

set -e

BACKUP_FILE=$1
TEST_DB_NAME="rakshex_test_restore"
DB_HOST=${DB_HOST:-"db"}
DB_USER=${DB_USER:-"root"}
DB_PASS=${DB_PASSWORD:-"changeme_in_production"}

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

echo "[$(date)] Testing restore from: ${BACKUP_FILE}"

# Create test database
echo "Creating test database..."
mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} -e "CREATE DATABASE IF NOT EXISTS ${TEST_DB_NAME};"

# Restore backup
echo "Restoring backup..."
if [[ $BACKUP_FILE == *.gz ]]; then
    zcat ${BACKUP_FILE} | mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} ${TEST_DB_NAME}
else
    mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} ${TEST_DB_NAME} < ${BACKUP_FILE}
fi

# Verify tables exist
echo "Verifying database integrity..."
TABLES=$(mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} ${TEST_DB_NAME} -e "SHOW TABLES;" | tail -n +2)

if [ -z "$TABLES" ]; then
    echo "ERROR: No tables found in restored database!"
    exit 1
fi

echo "Found tables:"
echo "$TABLES"

# Row counts
echo ""
echo "Table row counts:"
for table in $TABLES; do
    COUNT=$(mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} ${TEST_DB_NAME} -e "SELECT COUNT(*) FROM ${table};" | tail -1)
    echo "  ${table}: ${COUNT} rows"
done

# Cleanup
echo ""
echo "Cleaning up test database..."
mysql -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} -e "DROP DATABASE ${TEST_DB_NAME};"

echo ""
echo "[$(date)] Restore test completed successfully!"
echo "Backup file is valid and can be used for recovery."
