#!/bin/sh
set -e

# Prod entrypoint: PocketBase (API) + Astro SSR server + Caddy (HTTPS + routing)
#
# Caddy boots with bootstrap.json, then pb's OnBootstrap hook calls LoadConfig
# via admin API to inject full routes. Entrypoint is PID 1, Caddy runs in background.

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"
ARTALK_PID=""
RESTARTING_FLAG="/tmp/vanblog-restarting"
PB_PID_FILE="/tmp/vanblog-pb.pid"

# Clean stale flags from a previous run (e.g. container restarted without fresh /tmp)
rm -f "$RESTARTING_FLAG" 2>/dev/null || true

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

# Shared static-dir config. Go's Caddy config builder (vault/internal/caddy)
# reads these to point file_server routes at the same dirs the theme host uses.
# Defaults match prod; operators may override with custom mount points.
export VANBLOG_THEMES_DIR="${VANBLOG_THEMES_DIR:-/var/lib/vanblog/themes}"
# Builtin themes stay read-only in the image at /build/themes; the user themes
# volume above is the writable overlay. Consumers merge both, user wins.
export VANBLOG_THEMES_BUILTIN_DIR="${VANBLOG_THEMES_BUILTIN_DIR:-/build/themes}"
export VANBLOG_ADMIN_DIST_DIR="${VANBLOG_ADMIN_DIST_DIR:-/build/app/dist}"
export VANBLOG_ENTRYPOINT=1

echo "[vanblog] starting in PROD mode"
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
  kill $PB_PID ${THEME_HOST_PID:-} $CADDY_PID ${ARTALK_PID:-} 2>/dev/null || true
  wait $PB_PID ${THEME_HOST_PID:-} $CADDY_PID ${ARTALK_PID:-} 2>/dev/null || true
}
trap cleanup EXIT INT TERM
trap supervised_restart_pb USR1

# === Caddy: bootstrap + admin API ===

# 1. Start Caddy with bootstrap.json (background, NOT exec)
echo "[vanblog] starting Caddy with bootstrap config ($BOOTSTRAP_JSON)..."
caddy run --config "$BOOTSTRAP_JSON" &
CADDY_PID=$!

# 2. Wait for Caddy admin API to be reachable
wait_for "http://127.0.0.1:2019/config/" "Caddy admin API" 30 || exit 1

# 3. Start PocketBase
start_pocketbase() {
  echo "[vanblog] starting PocketBase..."
  set -- --http="$PB_HTTP" --dir="$PB_DATA" --coreSchemaPath=/core/models.js
  if [ -n "$VANBLOG_PACKS_DIR" ]; then
    echo "[vanblog] local Pack overrides: $VANBLOG_PACKS_DIR"
    set -- "$@" --packsDir="$VANBLOG_PACKS_DIR"
  fi
  vanblog serve "$@" &
  PB_PID=$!
  echo "$PB_PID" > "$PB_PID_FILE"
  wait_for "http://127.0.0.1:8090/api/health" "PocketBase" 30 || return 1
}
start_pocketbase || exit 1

# 3.5. Start the bundled Artalk only when the persisted site provider is artalk.
# The prod image may not contain the binary; prod-artalk does.
if command -v artalk >/dev/null 2>&1; then
  COMMENTS_PROVIDER=$(wget -q -O - -T 2 "http://127.0.0.1:8090/api/vanblog/runtime/comments" 2>/dev/null || echo '{"provider":"disabled"}')
  case "$COMMENTS_PROVIDER" in
    *'"provider":"artalk"'*)
      echo "[vanblog] starting bundled Artalk (port 23366)..."
      ARTALK_DIR="/data/artalk"
      ARTALK_CONFIG="${ARTALK_DIR}/artalk.yml"
      mkdir -p "$ARTALK_DIR"
      if [ ! -f "$ARTALK_CONFIG" ]; then
        echo "[vanblog] Artalk config not found, generating default: $ARTALK_CONFIG"
        artalk gen config "$ARTALK_CONFIG"
      fi
      (cd "$ARTALK_DIR" && exec env ATK_HOST=127.0.0.1 ATK_PORT=23366 artalk -c "$ARTALK_CONFIG" server) &
      ARTALK_PID=$!
      wait_for "http://127.0.0.1:23366/" "Artalk" 30 || exit 1
      ;;
    *) echo "[vanblog] bundled Artalk is installed but disabled" ;;
  esac
fi

# 4. Start Theme Host (replaces direct Astro SSR)
DEFAULT_THEME=$(cat /etc/vanblog/default-theme 2>/dev/null || echo "vanblog")
echo "[vanblog] starting theme host (default theme: ${DEFAULT_THEME})"
VANBLOG_THEMES_DIR=/var/lib/vanblog/themes \
VANBLOG_DEFAULT_THEME=${DEFAULT_THEME} \
VANBLOG_ADMIN_DIST_DIR=/build/app/dist \
PB_URL=http://127.0.0.1:8090 \
  node /app/theme-host.mjs &
THEME_HOST_PID=$!
wait_for "http://127.0.0.1:4321/__theme_host_health" "Theme Host" 30 || exit 1

# --- Supervised PocketBase restart (triggered by SIGUSR1) ---
# Allows an admin API endpoint (POST /api/vanblog/system/restart) to request
# a PocketBase restart so newly-added Pack hooks are loaded. The RESTARTING
# flag suspends monitor_children's PB liveness check for the duration.
supervised_restart_pb() {
  if [ -f "$RESTARTING_FLAG" ]; then
    echo "[vanblog] restart already in progress, ignoring"
    return 0
  fi
  echo "[vanblog] supervised PocketBase restart initiated (SIGUSR1)"
  touch "$RESTARTING_FLAG"

  # Graceful stop: SIGTERM, wait up to 15s, then SIGKILL
  kill -TERM "$PB_PID" 2>/dev/null || true
  for i in $(seq 1 15); do
    kill -0 "$PB_PID" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$PB_PID" 2>/dev/null; then
    echo "[vanblog] PocketBase did not exit gracefully, force killing"
    kill -KILL "$PB_PID" 2>/dev/null || true
    wait "$PB_PID" 2>/dev/null || true
  fi

  # Restart PocketBase with the same command
  echo "[vanblog] restarting PocketBase..."
  start_pocketbase || {
    echo "[vanblog] FATAL: PocketBase failed to restart"
    rm -f "$RESTARTING_FLAG"
    exit 1
  }

  rm -f "$RESTARTING_FLAG" 2>/dev/null || true
  echo "[vanblog] PocketBase restarted successfully (PID $PB_PID)"
  # Cooldown: absorb queued SIGUSR1 that arrived during restart.
  # POSIX shells queue signals during trap execution; without this sleep,
  # a queued signal would trigger an immediate second restart.
  sleep 5
}

# 5. Background monitor: if any child crashes, kill the container
monitor_children() {
  while true; do
    if ! kill -0 $CADDY_PID 2>/dev/null; then echo "[vanblog] FATAL: Caddy died"; exit 1; fi
    # Read current PB PID from file (updated by start_pocketbase on restart).
    # File-based IPC works across forked subshells; shell variables do not.
    if [ ! -f "$RESTARTING_FLAG" ]; then
      CURRENT_PB_PID=$(cat "$PB_PID_FILE" 2>/dev/null || echo "$PB_PID")
      if ! kill -0 "$CURRENT_PB_PID" 2>/dev/null; then echo "[vanblog] FATAL: PocketBase died"; exit 1; fi
    fi
    if ! kill -0 $THEME_HOST_PID 2>/dev/null; then echo "[vanblog] FATAL: Theme Host died"; exit 1; fi
    if [ -n "$ARTALK_PID" ] && ! kill -0 $ARTALK_PID 2>/dev/null; then echo "[vanblog] FATAL: Artalk died"; exit 1; fi
    sleep 5
  done
}
monitor_children &
MONITOR_PID=$!

# 6. Wait for Caddy process (Caddy is no longer PID 1, entrypoint is).
# pb's OnBootstrap hook will call LoadConfig to inject full routes.
echo "[vanblog] all services up, caddy bootstrap will be replaced by pb OnBootstrap hook"
echo "[vanblog] container is in foreground wait mode"
# Loop: SIGUSR1 (supervised restart) interrupts wait; resume waiting unless
# Caddy actually exited.
while true; do
  wait $CADDY_PID 2>/dev/null || exit_code=$?
  exit_code=${exit_code:-0}
  if [ $exit_code -lt 128 ]; then
    echo "[vanblog] Caddy exited (code $exit_code), shutting down"
    break
  fi
  exit_code=0
  kill -0 $CADDY_PID 2>/dev/null || { echo "[vanblog] Caddy exited during restart, shutting down"; break; }
done
