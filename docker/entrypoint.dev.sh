#!/bin/sh
set -e

# Dev entrypoint: PocketBase (API) + Astro dev server + Caddy (HTTPS + routing)

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"

echo "[vanblog] starting in DEV mode"
echo "[vanblog] pb data: $PB_DATA"

# 1. Start PocketBase
vanblog serve \
  --http=$PB_HTTP \
  --dir=$PB_DATA \
  --hooksWatch &
PB_PID=$!

# 2. Start Astro dev server (HMR)
echo "[vanblog] starting Astro dev server..."
cd /app/src
pnpm --filter vanblog-app dev -- --host 127.0.0.1 --port 4321 &
ASTRO_PID=$!

# Wait briefly for services
sleep 3

# 3. Start Caddy in foreground
echo "[vanblog] starting Caddy..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
