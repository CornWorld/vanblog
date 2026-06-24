#!/bin/sh
set -e

# Dev entrypoint: Caddy (HTTPS + routes) + PocketBase (API) + Astro dev server

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"
PB_HOOKS="${VANBLOG_HOOKS_DIR:-/pb_hooks}"
ASTRO_DIR="/app/src"

echo "[vanblog] starting in DEV mode"
echo "[vanblog] pb data: $PB_DATA"
echo "[vanblog] pb hooks: $PB_HOOKS"
echo "[vanblog] astro source: $ASTRO_DIR"

# Start PocketBase
vanblog serve \
  --http=$PB_HTTP \
  --dir=$PB_DATA \
  --hooksDir=$PB_HOOKS &

# Start Astro dev server
cd $ASTRO_DIR
npm run dev -- --host 127.0.0.1 --port 4321 &

# Wait briefly for services
sleep 2

# Start Caddy in foreground
echo "[vanblog] starting Caddy..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
