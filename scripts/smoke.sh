#!/usr/bin/env bash
# Minimal connector smoke test: initialize + tools/list + call ping.
#
# Usage:
#   scripts/smoke.sh local                       # http://localhost:8787, dev bearer from .dev.vars AUTH_KEYS
#   scripts/smoke.sh <base_url> <bearer_token>   # any deployed target
#
# Local prereqs: `npm run dev` running in another shell, and AUTH_KEYS set in .dev.vars.
set -euo pipefail

TARGET="${1:-local}"
if [[ "$TARGET" == "local" ]]; then
  BASE="http://localhost:8787"
  TOKEN="$(awk -F= '/^AUTH_KEYS=/ {sub(/^AUTH_KEYS=/,""); gsub(/"/,""); print; exit}' .dev.vars 2>/dev/null | cut -d, -f1)"
  ENDPOINT="$BASE/mcp"
else
  BASE="$TARGET"
  TOKEN="${2:?pass a bearer token as the 2nd arg}"
  ENDPOINT="$BASE/mcp"
fi

if [[ -z "${TOKEN:-}" ]]; then
  echo "No token found. Set AUTH_KEYS in .dev.vars (local) or pass one as arg 2." >&2
  exit 1
fi

hdr=(-H "Authorization: Bearer ${TOKEN}"
     -H "Accept: application/json, text/event-stream"
     -H "Content-Type: application/json")

echo "== /health =="
curl -sS "$BASE/health"; echo

echo "== tools/list =="
curl -sS -X POST "$ENDPOINT" "${hdr[@]}" \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'; echo

echo "== tools/call ping =="
curl -sS -X POST "$ENDPOINT" "${hdr[@]}" \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ping","arguments":{"message":"hello"}}}'; echo
