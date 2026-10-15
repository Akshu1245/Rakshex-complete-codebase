#!/usr/bin/env bash
# Real PostgreSQL migration + isolation verification. Local throwaway cluster only.
set -euo pipefail
# THROWAWAY local database only: this script DROPS and recreates $DB.
PGH=${PGHOST:-/tmp}; PGP=${PGPORT:-55432}; DB=${PGDB:-rakshex_mig}
export DATABASE_URL="postgresql+asyncpg://postgres@localhost:${PGP}/${DB}"
cd "$(dirname "$0")/../.."
[ -n "${VENV:-}" ] && . "$VENV/bin/activate"
q(){ psql -h $PGH -p $PGP -U postgres -d $DB -tAc "$1"; }
psql -h $PGH -p $PGP -U postgres -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
echo "== 1. migrate to 002 (pre-change schema) and seed legacy data"
alembic upgrade 002_onboarding_progress 2>&1 | grep -v '^INFO' || true
q "INSERT INTO users(id,email,username,password_hash) VALUES (1,'o@x.test','o','x'),(2,'m@x.test','m','x'),(3,'z@x.test','z','x')" >/dev/null
q "INSERT INTO teams(id,name,owner_id) VALUES ('wsA','A',1),('wsB','B',3)" >/dev/null
q "INSERT INTO team_members(team_id,user_id,role,accepted) VALUES ('wsA',1,'owner',true),('wsA',2,'member',true),('wsB',3,'owner',true)" >/dev/null
q "INSERT INTO change_alerts(id,api_name,severity,summary,acknowledged) VALUES (101,'GitHub','critical','legacy-1',false),(102,'Reddit','warning','legacy-2',true)" >/dev/null
q "SELECT 'legacy rows: '||count(*) FROM change_alerts"
echo "== 2. app started BEFORE migration (create_all runs, guard must refuse alert endpoints)"
python scripts/pg_alert_migration_check/pg_app_checks.py premigration
echo "== 3. alembic upgrade head (on top of create_all-created empty tables)"
alembic upgrade head 2>&1 | grep -v '^INFO' || true
q "SELECT 'version: '||version_num FROM alembic_version"
q "SELECT 'legacy after up: '||string_agg(id||':'||summary||':ws='||coalesce(workspace_id,'NULL')||':ack='||acknowledged, ', ' ORDER BY id) FROM change_alerts"
q "SELECT 'constraints: '||string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid='change_alerts'::regclass"
echo "== 4. app checks after migration (isolation, roles, fan-out, dedupe, backfill)"
python scripts/pg_alert_migration_check/pg_app_checks.py postmigration
q "SELECT 'audit rows: '||count(*) FROM change_alert_audit"
q "SELECT 'quarantined (ws NULL): '||count(*) FROM change_alerts WHERE workspace_id IS NULL"
echo "== 5. downgrade to 002"
alembic downgrade 002_onboarding_progress 2>&1 | grep -v '^INFO' || true
q "SELECT 'cols after down: '||string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name='change_alerts'"
q "SELECT 'tables gone: '||(SELECT count(*) FROM information_schema.tables WHERE table_name IN ('change_alert_audit','upstream_change_events','workspace_api_subscriptions'))"
q "SELECT 'legacy after down: '||string_agg(id||':'||summary, ', ' ORDER BY id) FROM change_alerts WHERE id IN (101,102)"
echo "== 6. upgrade head again"
alembic upgrade head 2>&1 | grep -v '^INFO' || true
q "SELECT 'version: '||version_num FROM alembic_version"
q "SELECT 'legacy after re-up: '||string_agg(id||':'||summary||':ws='||coalesce(workspace_id,'NULL'), ', ' ORDER BY id) FROM change_alerts WHERE id IN (101,102)"
python scripts/pg_alert_migration_check/pg_app_checks.py guardonly
echo "PG MIGRATION TEST COMPLETE"
