#!/bin/sh
set -e

# Prod entrypoint: Caddy (HTTPS + routes) + PocketBase (API)
# No Node runtime needed — Astro output is static files.

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"
PB_HOOKS="${VANBLOG_HOOKS_DIR:-/pb_hooks}"

echo "[vanblog] starting in PROD mode"
echo "[vanblog] pb data: $PB_DATA"
echo "[vanblog] pb hooks: $PB_HOOKS"

# Start PocketBase in background
vanblog serve \
  --http=$PB_HTTP \
  --dir=$PB_DATA \
  --hooksDir=$PB_HOOKS &

PB_PID=$!

# Wait briefly for pb to be ready
sleep 1

# Start Caddy in foreground (handles HTTPS + reverse proxy to pb)
echo "[vanblog] starting Caddy..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
