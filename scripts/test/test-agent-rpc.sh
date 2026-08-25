#!/usr/bin/env bash
# Smoke test for the current Go -> pi native RPC -> SSE path.
# Requires a running dev container and an admin bearer token:
#   VANBLOG_AGENT_URL=http://127.0.0.1:8880 \
#   VANBLOG_ADMIN_TOKEN=... \
#   ./scripts/test/test-agent-rpc.sh
set -euo pipefail

BASE_URL="${VANBLOG_AGENT_URL:-http://127.0.0.1:8880}"
TOKEN="${VANBLOG_ADMIN_TOKEN:-}"
TIMEOUT="${VANBLOG_AGENT_TIMEOUT:-120}"

if [[ -z "$TOKEN" ]]; then
  echo "VANBLOG_ADMIN_TOKEN is required" >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

request() {
  local message="$1" session_id="${2:-}" output="$TMP_DIR/response"
  local payload
  payload="$(python3 -c 'import json,sys; print(json.dumps({"message":sys.argv[1], **({"sessionId":sys.argv[2]} if sys.argv[2] else {})}))' "$message" "$session_id")"
  curl --fail-with-body --silent --show-error --max-time "$TIMEOUT" \
    -D "$TMP_DIR/headers" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$payload" "$BASE_URL/api/vanblog/agent/chat" > "$output"
  if ! grep -q '^data: ' "$output"; then
    echo "SSE response did not contain data events" >&2
    cat "$output" >&2
    exit 1
  fi
  if ! grep -q 'agent_settled' "$output"; then
    echo "SSE response did not settle" >&2
    cat "$output" >&2
    exit 1
  fi
  sed -n 's/^X-Agent-Session-ID: //Ip' "$TMP_DIR/headers" | tr -d '\r' | tail -1
}

first_session="$(request 'Reply with exactly: session-one')"
[[ -n "$first_session" ]] || { echo "missing session id" >&2; exit 1; }
echo "created session: $first_session"

second_session="$(request 'Reply with exactly: session-two' "$first_session")"
[[ "$second_session" == "$first_session" ]] || {
  echo "session was not reused: $second_session != $first_session" >&2
  exit 1
}
echo "reused session: $second_session"

# A second request with the same sessionId is intentionally sent only after the
# first stream settles. The Go manager rejects overlapping prompts with 409;
# a timing-sensitive overlap test belongs in an integration harness that can
# hold a deterministic fake pi process open.


