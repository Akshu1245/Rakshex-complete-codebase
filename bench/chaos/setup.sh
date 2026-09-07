#!/usr/bin/env bash
set -euo pipefail
TOXI_API="${TOXI_API:-http://127.0.0.1:8474}"

create_proxy() {
  local name="$1" listen="$2" upstream="$3"
  curl -fsS -X POST "$TOXI_API/proxies" \
    -H 'content-type: application/json' \
    -d "{\"name\":\"$name\",\"listen\":\"0.0.0.0:$listen\",\"upstream\":\"$upstream\",\"enabled\":true}" \
    >/dev/null
}

curl -fsS -X DELETE "$TOXI_API/proxies/postgres" >/dev/null 2>&1 || true
curl -fsS -X DELETE "$TOXI_API/proxies/redis" >/dev/null 2>&1 || true
create_proxy postgres 15432 postgres-chaos-target:5432
create_proxy redis 16379 redis-chaos-target:6379

echo "Postgres proxy: postgresql://rakshex:rakshex@127.0.0.1:15432/rakshex_chaos"
echo "Redis proxy:    redis://127.0.0.1:16379"
