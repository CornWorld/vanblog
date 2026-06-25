#!/bin/sh
set -e

# Prod entrypoint: PocketBase (API) + Astro SSR server + Caddy (HTTPS + routing)
#
# pb_hooks is auto-discovered at <DataDir>/../pb_hooks (default /pb_hooks).

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"

echo "[vanblog] starting in PROD mode"
echo "[vanblog] pb data: $PB_DATA"

# 1. Start PocketBase (API + data layer)
vanblog serve \
  --http=$PB_HTTP \
  --dir=$PB_DATA &
PB_PID=$!

# 2. Start Astro SSR server (Node standalone)
echo "[vanblog] starting Astro SSR server..."
cd /app/dist
HOST=127.0.0.1 PORT=4321 node ./server/entry.mjs &
ASTRO_PID=$!

# Wait briefly for services to be ready
sleep 2

# 3. Start Caddy in foreground (handles HTTPS + reverse proxy)
echo "[vanblog] starting Caddy..."
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
