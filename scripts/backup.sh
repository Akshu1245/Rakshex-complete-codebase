#!/bin/bash
# Database Backup Script for Rakshex
# Usage: ./backup.sh [daily|monthly]

set -e

BACKUP_TYPE=${1:-daily}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/${BACKUP_TYPE}"
S3_BUCKET=${S3_BACKUP_BUCKET:-"rakshex-backups"}
DB_HOST=${DB_HOST:-"db"}
DB_NAME=${DB_NAME:-"rakshex_db"}
DB_USER=${DB_USER:-"root"}
DB_PASS=${DB_PASSWORD:-"changeme_in_production"}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
RETENTION_MONTHS=${BACKUP_RETENTION_MONTHS:-12}

mkdir -p ${BACKUP_DIR}

echo "[$(date)] Starting ${BACKUP_TYPE} backup..."

# Create MySQL dump
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${BACKUP_TYPE}_${TIMESTAMP}.sql.gz"
mysqldump -h ${DB_HOST} -u ${DB_USER} -p${DB_PASS} ${DB_NAME} | gzip > ${BACKUP_FILE}

echo "[$(date)] Backup created: ${BACKUP_FILE}"

# Upload to S3
if command -v aws &> /dev/null; then
    echo "[$(date)] Uploading to S3..."
    aws s3 cp ${BACKUP_FILE} s3://${S3_BUCKET}/${BACKUP_TYPE}/
    echo "[$(date)] Upload complete"
    
    # Remove local file after successful upload
    rm ${BACKUP_FILE}
else
    echo "[$(date)] AWS CLI not available, keeping local backup"
fi

# Cleanup old backups
if [ "${BACKUP_TYPE}" = "daily" ]; then
    echo "[$(date)] Cleaning up daily backups older than ${RETENTION_DAYS} days..."
    find ${BACKUP_DIR} -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
    
    if command -v aws &> /dev/null; then
        aws s3 ls s3://${S3_BUCKET}/daily/ | \
        awk '{print $4}' | \
        while read file; do
            file_date=$(echo $file | grep -oP '\d{8}_\d{6}' || echo "")
            if [ ! -z "$file_date" ]; then
                file_epoch=$(date -d "${file_date:0:8} ${file_date:9:2}:${file_date:11:2}:${file_date:13:2}" +%s 2>/dev/null || echo 0)
                cutoff_epoch=$(date -d "${RETENTION_DAYS} days ago" +%s)
                if [ $file_epoch -lt $cutoff_epoch ]; then
                    aws s3 rm s3://${S3_BUCKET}/daily/$file
                fi
            fi
        done
    fi
elif [ "${BACKUP_TYPE}" = "monthly" ]; then
    echo "[$(date)] Cleaning up monthly backups older than ${RETENTION_MONTHS} months..."
    find ${BACKUP_DIR} -name "*.sql.gz" -mtime +$((RETENTION_MONTHS * 30)) -delete 2>/dev/null || true
fi

echo "[$(date)] Backup process completed"
