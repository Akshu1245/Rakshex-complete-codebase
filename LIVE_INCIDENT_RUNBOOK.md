# DevPulse Live Incident Runbook

> What to do when things break.
> Date: 2026-05-17

---

## SEVERITY DEFINITIONS

| Level | Criteria               | Response Time | Channel          |
| ----- | ---------------------- | ------------- | ---------------- |
| SEV1  | Full outage, all users | 5 min         | Page on-call     |
| SEV2  | Major degradation      | 15 min        | Slack #incidents |
| SEV3  | Minor issue            | 1 hour        | Ticket           |
| SEV4  | Cosmetic               | 24 hours      | Backlog          |

---

## RUNBOOKS

### API Down

1. Check status page: status.devpulse.in
2. Verify LB health: `kubectl get pods`
3. Check DB connections: `pg_stat_activity`
4. Rollback if recent deploy: `kubectl rollout undo`
5. If provider outage: switch region
6. Communicate: post to status page

### Scan Queue Backed Up

1. Check Redis queue length: `LLEN bull:scan`
2. Check worker CPU/memory
3. Scale workers: `kubectl scale deployment scan-worker --replicas=X`
4. Alert if > 1000 pending for > 10 min

### DB Overload

1. Check `pg_stat_activity` for slow queries
2. Kill long-running queries > 30s
3. Enable read replica for queries
4. Scale DB if CPU > 80% for > 5 min

---

## ESCALATION

| Step | Who              | When             |
| ---- | ---------------- | ---------------- |
| 1    | On-call engineer | Immediately      |
| 2    | SRE lead         | SEV1 or > 30 min |
| 3    | CTO/founder      | SEV1 or > 1 hour |
| 4    | All-hands        | SEV1 + data loss |

---

_Owned by SRE. Practice monthly._
