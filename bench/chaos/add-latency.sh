#!/usr/bin/env bash
set -euo pipefail
TOXI_API="${TOXI_API:-http://127.0.0.1:8474}"
TARGET="${1:-postgres}"
LATENCY_MS="${2:-1000}"
JITTER_MS="${3:-100}"
curl -fsS -X POST "$TOXI_API/proxies/$TARGET/toxics" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"latency\",\"type\":\"latency\",\"stream\":\"downstream\",\"toxicity\":1,\"attributes\":{\"latency\":$LATENCY_MS,\"jitter\":$JITTER_MS}}" \
  >/dev/null
echo "Injected ${LATENCY_MS}ms (+/- ${JITTER_MS}ms) latency into $TARGET"
