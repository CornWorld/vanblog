#!/bin/sh
set -e

# Dev entrypoint: PocketBase (API) + Astro dev server + Caddy (HTTPS + routing)

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"

echo "[vanblog] starting in DEV mode"
echo "[vanblog] pb data: $PB_DATA"

# --- Health check helper ---
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

# 1. Start PocketBase
echo "[vanblog] starting PocketBase..."
vanblog serve \
  --http=$PB_HTTP \
  --dir=$PB_DATA \
  --hooksWatch &
PB_PID=$!

wait_for "http://127.0.0.1:8090/api/health" "PocketBase" 30 || exit 1

# 2. Start Astro dev server (HMR)
echo "[vanblog] starting Astro dev server..."
cd /app/src
pnpm --filter vanblog-app dev -- --host 127.0.0.1 --port 4321 &
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

# 4. Start Caddy in foreground
echo "[vanblog] starting Caddy..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
