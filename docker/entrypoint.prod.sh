#!/bin/sh
set -e

# Prod entrypoint: PocketBase (API) + Astro SSR server + Caddy (HTTPS + routing)
#
# Supports two modes via VANBLOG_CADDY_MODE env:
#   - json (default): Caddy boots with bootstrap.json, then pb's OnBootstrap hook
#                     calls LoadConfig via admin API to inject full routes.
#                     Entrypoint is PID 1, Caddy runs in background.
#   - legacy         : Caddyfile-based, Caddy is exec'd as PID 1 (old behavior).
#                     Fallback escape hatch for operators.

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"

# --- VANBLOG_CADDY_MODE: legacy (Caddyfile) or json (default, bootstrap + admin API) ---
CADDY_MODE="${VANBLOG_CADDY_MODE:-json}"

# --- VANBLOG_HTTP_ONLY: pick the TLS-less bootstrap config when set ---
# Operators terminate TLS at an external reverse proxy and forward plain
# HTTP to this container. Caddy still runs (for routing + SSRF safety) but
# listens only on :80.
BOOTSTRAP_JSON="/etc/caddy/bootstrap.json"
if [ "${VANBLOG_HTTP_ONLY}" = "1" ] || [ "${VANBLOG_HTTP_ONLY}" = "true" ]; then
  echo "[vanblog] HTTP_ONLY mode: external proxy terminates TLS"
  BOOTSTRAP_JSON="/etc/caddy/bootstrap-http-only.json"
fi

# --- VANBLOG_EMAIL validation ---
if [ "${VANBLOG_EMAIL}" = "admin@example.com" ] || [ -z "${VANBLOG_EMAIL}" ]; then
  echo "[vanblog] WARNING: VANBLOG_EMAIL is not set (using default admin@example.com)."
  echo "[vanblog]          Let's Encrypt will send expiry warnings to this address."
  echo "[vanblog]          Set VANBLOG_EMAIL in docker-compose.yml or -e VANBLOG_EMAIL=you@example.com"
fi

echo "[vanblog] starting in PROD mode (caddy mode: $CADDY_MODE)"
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
  kill $PB_PID $ASTRO_PID $CADDY_PID 2>/dev/null || true
  wait $PB_PID $ASTRO_PID $CADDY_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# === LEGACY MODE: Caddyfile-based, old startup sequence ===
if [ "$CADDY_MODE" = "legacy" ]; then
  echo "[vanblog] LEGACY caddy mode: using Caddyfile, Caddy is PID 1"

  # 1. Start PocketBase
  echo "[vanblog] starting PocketBase..."
  vanblog serve --http=$PB_HTTP --dir=$PB_DATA &
  PB_PID=$!
  wait_for "http://127.0.0.1:8090/api/health" "PocketBase" 30 || exit 1

  # 2. Start Astro SSR server
  echo "[vanblog] starting Astro SSR server..."
  cd /app/dist
  HOST=127.0.0.1 PORT=4321 node ./server/entry.mjs &
  ASTRO_PID=$!
  wait_for "http://127.0.0.1:4321/" "Astro SSR" 30 || exit 1

  # 3. Background monitor
  monitor_children() {
    while true; do
      if ! kill -0 $PB_PID 2>/dev/null; then echo "[vanblog] FATAL: PocketBase died"; exit 1; fi
      if ! kill -0 $ASTRO_PID 2>/dev/null; then echo "[vanblog] FATAL: Astro died"; exit 1; fi
      sleep 5
    done
  }
  monitor_children &
  MONITOR_PID=$!

  echo "[vanblog] starting Caddy (legacy Caddyfile)..."
  exec caddy run --config /etc/caddy/Caddyfile.legacy --adapter caddyfile
fi

# === JSON MODE (default): bootstrap + admin API ===
echo "[vanblog] JSON caddy mode: bootstrap then admin API"

# 1. Start Caddy with bootstrap.json (background, NOT exec)
echo "[vanblog] starting Caddy with bootstrap config ($BOOTSTRAP_JSON)..."
caddy run --config "$BOOTSTRAP_JSON" &
CADDY_PID=$!

# 2. Wait for Caddy admin API to be reachable
wait_for "http://127.0.0.1:2019/config/" "Caddy admin API" 30 || exit 1

# 3. Start PocketBase
echo "[vanblog] starting PocketBase..."
vanblog serve --http=$PB_HTTP --dir=$PB_DATA &
PB_PID=$!
wait_for "http://127.0.0.1:8090/api/health" "PocketBase" 30 || exit 1

# 4. Start Astro SSR server
echo "[vanblog] starting Astro SSR server..."
cd /app/dist
HOST=127.0.0.1 PORT=4321 node ./server/entry.mjs &
ASTRO_PID=$!
wait_for "http://127.0.0.1:4321/" "Astro SSR" 30 || exit 1

# 5. Background monitor: if any child crashes, kill the container
monitor_children() {
  while true; do
    if ! kill -0 $CADDY_PID 2>/dev/null; then echo "[vanblog] FATAL: Caddy died"; exit 1; fi
    if ! kill -0 $PB_PID 2>/dev/null; then echo "[vanblog] FATAL: PocketBase died"; exit 1; fi
    if ! kill -0 $ASTRO_PID 2>/dev/null; then echo "[vanblog] FATAL: Astro died"; exit 1; fi
    sleep 5
  done
}
monitor_children &
MONITOR_PID=$!

# 6. Wait for Caddy process (Caddy is no longer PID 1, entrypoint is).
# pb's OnBootstrap hook will call LoadConfig to inject full routes.
echo "[vanblog] all services up, caddy bootstrap will be replaced by pb OnBootstrap hook"
echo "[vanblog] container is in foreground wait mode"
wait $CADDY_PID
