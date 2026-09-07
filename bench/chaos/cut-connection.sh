#!/usr/bin/env bash
set -euo pipefail
TOXI_API="${TOXI_API:-http://127.0.0.1:8474}"
TARGET="${1:-redis}"
curl -fsS -X POST "$TOXI_API/proxies/$TARGET/toxics" \
  -H 'content-type: application/json' \
  -d '{"name":"cut","type":"timeout","stream":"downstream","toxicity":1,"attributes":{"timeout":0}}' \
  >/dev/null
echo "Cut downstream traffic for $TARGET"
