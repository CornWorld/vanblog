#!/bin/sh
set -e

# Prod entrypoint: PocketBase (API) + Astro SSR server + Caddy (HTTPS + routing)
#
# Process management:
#   - pb and Astro run as background processes
#   - Caddy runs in foreground (PID 1 substitute)
#   - trap ensures all children are killed on SIGTERM/SIGINT
#   - background monitor kills container if any child process exits

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"

# --- VANBLOG_EMAIL validation ---
if [ "${VANBLOG_EMAIL}" = "admin@example.com" ] || [ -z "${VANBLOG_EMAIL}" ]; then
  echo "[vanblog] WARNING: VANBLOG_EMAIL is not set (using default admin@example.com)."
  echo "[vanblog]          Let's Encrypt will send expiry warnings to this address."
  echo "[vanblog]          Set VANBLOG_EMAIL in docker-compose.yml or -e VANBLOG_EMAIL=you@example.com"
fi

echo "[vanblog] starting in PROD mode"
echo "[vanblog] pb data: $PB_DATA"

# --- Health check helper ---
# Polls an HTTP endpoint until it returns 200 or timeout
wait_for() {
  url="$1"
  name="$2"
  max="${3:-30}"
  i=0
  while [ $i -lt $max ]; do
    if wget -q -O /dev/null -T 1 "$url" 2>/dev/null; then
      echo "[vanblog] $name is ready (took ${i}s)"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "[vanblog] ERROR: $name did not become ready within ${max}s at $url"
  return 1
}

# --- Cleanup on exit ---
cleanup() {
  echo "[vanblog] shutting down..."
  kill "$MONITOR_PID" 2>/dev/null || true
  kill $PB_PID $ASTRO_PID 2>/dev/null || true
  wait $PB_PID $ASTRO_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 1. Start PocketBase (API + data layer)
echo "[vanblog] starting PocketBase..."
vanblog serve \
  --http=$PB_HTTP \
  --dir=$PB_DATA &
PB_PID=$!

# Wait for pb to be ready (migration + HTTP server)
wait_for "http://127.0.0.1:8090/api/health" "PocketBase" 30 || exit 1

# 2. Start Astro SSR server (Node standalone)
echo "[vanblog] starting Astro SSR server..."
cd /app/dist
HOST=127.0.0.1 PORT=4321 node ./server/entry.mjs &
ASTRO_PID=$!

# Wait for Astro to be ready
wait_for "http://127.0.0.1:4321/" "Astro SSR" 30 || exit 1

# 3. Background monitor: if any child crashes, kill the container
monitor_children() {
  while true; do
    if ! kill -0 $PB_PID 2>/dev/null; then
      echo "[vanblog] FATAL: PocketBase process died, exiting"
      exit 1
    fi
    if ! kill -0 $ASTRO_PID 2>/dev/null; then
      echo "[vanblog] FATAL: Astro process died, exiting"
      exit 1
    fi
    sleep 5
  done
}
monitor_children &
MONITOR_PID=$!

# 4. Start Caddy in foreground (handles HTTPS + reverse proxy)
# Caddy becomes the effective PID 1 process
echo "[vanblog] starting Caddy..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
