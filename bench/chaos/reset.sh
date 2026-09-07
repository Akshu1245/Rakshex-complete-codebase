#!/usr/bin/env bash
set -euo pipefail
TOXI_API="${TOXI_API:-http://127.0.0.1:8474}"
for proxy in postgres redis; do
  for toxic in latency cut; do
    curl -fsS -X DELETE "$TOXI_API/proxies/$proxy/toxics/$toxic" >/dev/null 2>&1 || true
  done
done
echo "RaksHexBench chaos toxics cleared"
