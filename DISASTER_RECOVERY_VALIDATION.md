# Rakshex Disaster Recovery Validation

> Test your backups before you need them.
> Date: 2026-05-17

---

## VALIDATION SCHEDULE

| Test                         | Frequency | Last Run | Status |
| ---------------------------- | --------- | -------- | ------ |
| Database restore from backup | Monthly   | \_\_\_   | \_\_\_ |
| Redis failover               | Quarterly | \_\_\_   | \_\_\_ |
| Full region failover         | Quarterly | \_\_\_   | \_\_\_ |
| Backup integrity check       | Weekly    | \_\_\_   | \_\_\_ |
| RTO/RPO measurement          | Per test  | \_\_\_   | \_\_\_ |

---

## TEST 1: DATABASE RESTORE

### Procedure

```
1. Create fresh test environment
2. Restore from latest automated backup
3. Verify data completeness:
   - User count matches
   - Scan records intact
   - Finding statuses preserved
   - Billing data accurate
4. Run smoke tests:
   - Login works
   - Scans execute
   - Dashboard loads
5. Measure RTO: ___ minutes
6. Measure RPO: ___ minutes of data loss
```

### Results Log

| Date   | Backup Age   | Restore Time | Data Verified | RTO    | RPO    |
| ------ | ------------ | ------------ | ------------- | ------ | ------ |
| \_\_\_ | \_\_\_ hours | \_\_\_ min   | ✅/❌         | \_\_\_ | \_\_\_ |

---

## TEST 2: REDIS FAILOVER

### Procedure

```
1. Identify current Redis primary
2. Simulate failure (stop container)
3. Verify Sentinel promotes replica
4. Check application reconnects
5. Verify no data loss (session cache)
6. Measure failover time: ___ seconds
```

### Results Log

| Date   | Failover Time | Data Loss   | App Recovery |
| ------ | ------------- | ----------- | ------------ |
| \_\_\_ | \_\_\_ sec    | None/\_\_\_ | \_\_\_ sec   |

---

## TEST 3: FULL REGION FAILOVER

### Procedure

```
1. Switch DNS to standby region
2. Verify traffic routes correctly
3. Check database replication lag
4. Verify application functionality
5. Measure total downtime: ___ minutes
6. Measure data loss: ___ minutes
7. Switch back to primary
8. Verify primary catches up
```

### Results Log

| Date   | Downtime   | Data Loss  | Recovery Issues |
| ------ | ---------- | ---------- | --------------- |
| \_\_\_ | \_\_\_ min | \_\_\_ min | \_\_\_          |

---

## BACKUP VALIDATION

### Automated Checks

```bash
# Daily backup integrity script
#!/bin/bash
BACKUP_FILE=$(aws s3 ls s3://rakshex-backups/ | tail -1)
aws s3 cp s3://rakshex-backups/$BACKUP_FILE /tmp/test-restore.sql
mysql --dry-run < /tmp/test-restore.sql
if [ $? -eq 0 ]; then
  echo "✅ Backup integrity verified"
else
  echo "❌ Backup integrity failed"
  # Alert PagerDuty
fi
```

### Backup Coverage

| Data Type | Backup Method         | Frequency  | Retention | Verified |
| --------- | --------------------- | ---------- | --------- | -------- |
| MySQL     | Automated snapshot    | Daily      | 30 days   | \_\_\_   |
| Redis     | AOF + RDB             | Every hour | 7 days    | \_\_\_   |
| S3 assets | Versioning            | Continuous | 90 days   | \_\_\_   |
| Config    | Git + parameter store | On change  | Forever   | \_\_\_   |

---

## LESSONS FROM PAST TESTS

| Date   | Test   | What Broke | Fix Applied |
| ------ | ------ | ---------- | ----------- |
| \_\_\_ | \_\_\_ | \_\_\_     | \_\_\_      |

---

_Validation maintained by SRE team._
_Tests run on schedule. Results reviewed monthly._
