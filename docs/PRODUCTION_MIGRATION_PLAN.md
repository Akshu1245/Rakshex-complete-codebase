# Production migration plan: change alerts 003/004/005 (NOT executed)

Nobody has run this on production. The plan was checked against a throwaway local PostgreSQL 17 database with
`devpulse-backend/scripts/pg_alert_migration_check/run.sh`. That run covered 29 checks plus an abort case.
It tested migrate, rollback, re-upgrade, data preservation, isolation and idempotency.

## Revisions (all additive)
| rev | adds | destructive? |
|---|---|---|
| 003_change_alerts_ws | `change_alerts.workspace_id`, ack/resolve columns, `change_alert_audit` | no (new nullable columns; legacy rows stay, quarantined with workspace_id NULL) |
| 004_upstream_events | `upstream_change_events`, `workspace_api_subscriptions`, `change_alerts.event_id`, UNIQUE(event_id, workspace_id) | no |
| 005_role_check_rl | lowercases/trims `team_members.role`; CHECK role IN (owner,admin,member,viewer); `rate_limit_counters` | rewrites role case only. **Aborts with no changes** if any other role value exists |

Each revision checks whether its table or column already exists (`_has_table`), because the app's startup
`create_all()` can create the new tables before Alembic runs.

## Order
1. Freeze deploys. Take a backup or snapshot of the production DB and confirm it can be restored.
2. Pre-check roles (read-only):
   `SELECT role, count(*) FROM team_members GROUP BY role;`
   Any value outside owner/admin/member/viewer (after lowercasing) must be fixed by hand first. Otherwise 005 aborts.
3. Pre-check unique emails, row counts, and the current `alembic_version` (expect `002_onboarding_progress`).
4. `alembic upgrade 003_change_alerts_ws`, then `004_upstream_events`, then `005_role_check_rl`. Run them one at a time
   and check `alembic_version` after each.
5. Verify:
   - `GET /api/changes/alerts` with a valid token returns 200, not 503 (the schema guard).
   - Legacy alerts have workspace_id NULL and stay invisible.
   - `SELECT count(*) FROM rate_limit_counters` succeeds.
6. Optionally run `backfill_legacy_alerts_to_events_db()` (idempotent). It copies legacy alerts into the shared events
   table. It does not assign them to any workspace.
7. Set env vars on the backend container:
   - `PROXY_SIGNING_SECRET`: must match the dashboard's value. The dashboard proxy signs the client IP. Without it,
     every dashboard user shares the proxy's IP bucket for anonymous limits.
   - Or `TRUSTED_PROXY_CIDRS`: only real proxy ranges. Never `0.0.0.0/0`.
   - Optional: `RL_ANON_PER_MIN`, `RL_ANON_PER_HOUR`, `RL_WORKSPACE_PER_HOUR`.
8. Deploy backend code, then the dashboard (it needs the same `PROXY_SIGNING_SECRET`).
   If code ships before the migration, the guard returns 503 on alert endpoints. It does not corrupt data.

## Rollback
- Code only: redeploy the previous image. The new tables and columns are ignored by the old code.
- Schema:
  `alembic downgrade 004_upstream_events` (drops the CHECK and rate_limit_counters; the role lowercasing is NOT reverted),
  then `003_change_alerts_ws`, then `002_onboarding_progress`.
  Downgrading past 004/003 **drops** these tables and the data in them:
  - subscriptions
  - upstream events
  - the audit trail
  - workspace assignment and ack/resolve metadata
  Export those tables before downgrading. Legacy `change_alerts` rows and team members are kept (verified locally).
- Last resort: restore the backup from step 1.

## Known operational costs
- Rate-limit counters in PostgreSQL add one upsert per request, or two to three for workspace requests, on a small pool (cap 3).
  Expired rows are deleted on about 1% of requests. Load-test before launch, or set `REDIS_URL` if a free Redis becomes available.
