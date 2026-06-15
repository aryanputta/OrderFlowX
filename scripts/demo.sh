#!/usr/bin/env bash
# One-command demo: build, start the server, and prove idempotency live.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
npm run build >/dev/null

node dist/src/index.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1

BODY='{"customerId":"demo","idempotencyKey":"demo-key-1","items":[{"sku":"SKU-PHONE","quantity":1}]}'

echo "health:    $(curl -s "localhost:$PORT/healthz")"
ID1=$(curl -s -X POST "localhost:$PORT/checkout" -d "$BODY" | node -pe 'JSON.parse(require("fs").readFileSync(0)).orderId')
ID2=$(curl -s -X POST "localhost:$PORT/checkout" -d "$BODY" | node -pe 'JSON.parse(require("fs").readFileSync(0)).orderId')
echo "checkout1: $ID1"
echo "checkout2: $ID2  (same key)"

if [ "$ID1" = "$ID2" ]; then
  echo "PASS: duplicate request returned the same order. No double side effect."
else
  echo "FAIL: duplicate request created a second order."
  exit 1
fi
