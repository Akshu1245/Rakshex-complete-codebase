#!/usr/bin/env bash
# Two real backend processes sharing one throwaway local PostgreSQL: proves per-user / per-IP limits are global
# (shared counters) and that one user's exhaustion never blocks another. LOCAL THROWAWAY DB ONLY (drops $DB).
set -euo pipefail
PGP=${PGPORT:-55432}; DB=${PGDB:-rakshex_rl}
cd "$(dirname "$0")/../.."
[ -n "${VENV:-}" ] && . "$VENV/bin/activate"
export DATABASE_URL="postgresql+asyncpg://postgres@localhost:${PGP}/${DB}" REDIS_URL="${REDIS_URL:-}" ENV=development RL_ANON_PER_MIN=1000 RL_ANON_PER_HOUR=40
psql -h /tmp -p $PGP -U postgres -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
alembic upgrade head >/dev/null 2>&1
psql -h /tmp -p $PGP -U postgres -d $DB -qc "INSERT INTO users(id,email,username,password_hash,plan) VALUES (1,'a@x.test','a','x','free'),(2,'b@x.test','b','x','free')"
for p in 8101 8102; do uvicorn main:app --port $p --log-level warning >/tmp/rl_$p.log 2>&1 & done
trap 'kill $(jobs -p) 2>/dev/null' EXIT
for p in 8101 8102; do for i in $(seq 1 60); do curl -sf localhost:$p/health >/dev/null && break; sleep 1; done; done
[ -n "$REDIS_URL" ] && redis-cli -u "$REDIS_URL" flushdb >/dev/null
python scripts/multi_instance_rl/hammer.py
if [ "${OUTAGE:-0}" = 1 ] && [ -z "$REDIS_URL" ]; then
  echo "== live store outage: stop PostgreSQL under the running instances"
  pg_ctl -D /tmp/pgdata stop -m fast >/dev/null
  w=$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:8101/api/auth/login -H 'content-type: application/json' -d '{"email":"a@x.test","password":"x"}')
  r=$(curl -s -o /dev/null -w '%{http_code}' localhost:8102/api/changes/providers)
  [ "$w" = 503 ] && echo "  PASS login (write) fails closed during outage: $w" || echo "  FAIL login during outage: $w"
  [ "$r" = 200 ] && echo "  PASS read served with local fallback during outage: $r" || echo "  FAIL read during outage: $r"
  pg_ctl -D /tmp/pgdata -o "-p 55432 -k /tmp" -l /tmp/pg.log start >/dev/null
fi
