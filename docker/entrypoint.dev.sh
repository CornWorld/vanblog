#!/bin/sh
set -e

# Dev entrypoint: PocketBase (API) + Theme Host (SSR frontend) + Caddy (HTTPS + routing)
#
# Caddy boots with bootstrap.json, then pb's OnBootstrap hook calls LoadConfig
# via admin API to inject full routes. Entrypoint is PID 1, Caddy runs in background.

PB_HTTP="127.0.0.1:8090"
PB_DATA="${VANBLOG_DATA_DIR:-/pb_data}"
RESTARTING_FLAG="/tmp/vanblog-restarting"
PB_PID_FILE="/tmp/vanblog-pb.pid"
export VANBLOG_ENTRYPOINT=1

# Go GC tuning: derive GOMEMLIMIT from the cgroup memory limit so the GC
# works harder BEFORE the kernel OOM-kills the process.
#   - cgroup v2: /sys/fs/cgroup/memory.max ("max" = unlimited)
#   - cgroup v1: /sys/fs/cgroup/memory/memory.limit_in_bytes (huge sentinel = unlimited)
# We take 80% of the limit: the rest covers Go runtime overhead (stacks,
# metadata), Caddy, and the Node theme host sharing the same cgroup.
# VANBLOG_GOMEMLIMIT explicitly set (e.g. "1500000000" or "off") wins.
CGROUP_MEM_LIMIT=""
if [ -r /sys/fs/cgroup/memory.max ]; then
  _v=$(cat /sys/fs/cgroup/memory.max 2>/dev/null)
  [ "$_v" = "max" ] || CGROUP_MEM_LIMIT="$_v"
fi
if [ -z "$CGROUP_MEM_LIMIT" ] && [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
  _v=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes 2>/dev/null)
  # v1 no-limit sentinel is near 2^63; anything >64GB means unlimited
  [ "$_v" -gt 68719476736 ] 2>/dev/null || CGROUP_MEM_LIMIT="$_v"
fi
if [ -n "$CGROUP_MEM_LIMIT" ]; then
  export GOMEMLIMIT="${VANBLOG_GOMEMLIMIT:-$((CGROUP_MEM_LIMIT * 80 / 100))}"
else
  # No cgroup limit: only export if the operator set one explicitly.
  [ -n "${VANBLOG_GOMEMLIMIT:-}" ] && export GOMEMLIMIT="$VANBLOG_GOMEMLIMIT"
fi
# GOGC=50 triggers GC at 1.5x live heap (default 100 = 2x) — more aggressive
# under burst traffic, keeping the heap from doubling before GC reacts.
export GOGC="${VANBLOG_GOGC:-50}"

# Clean stale flags from a previous run (e.g. container restarted without fresh /tmp)
rm -f "$RESTARTING_FLAG" 2>/dev/null || true

# --- VANBLOG_HTTP_ONLY: pick the TLS-less bootstrap config when set ---
BOOTSTRAP_JSON="/etc/caddy/bootstrap.json"
if [ "${VANBLOG_HTTP_ONLY}" = "1" ] || [ "${VANBLOG_HTTP_ONLY}" = "true" ]; then
  echo "[vanblog] HTTP_ONLY mode: external proxy terminates TLS"
  BOOTSTRAP_JSON="/etc/caddy/bootstrap-http-only.json"
fi

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
  kill $PB_PID $THEME_HOST_PID $CADDY_PID $PI_PROXY_PID 2>/dev/null || true
  wait $PB_PID $THEME_HOST_PID $CADDY_PID $PI_PROXY_PID 2>/dev/null || true
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

# 3. Start PocketBase (--hooksWatch for hot reload of JSVM hooks)
start_pocketbase() {
  echo "[vanblog] starting PocketBase..."
  # hooksPool: pre-warm enough goja Runtime instances to cover peak concurrency.
  # PB jsvm's pool overflows by creating one-off Runtimes when all slots are busy;
  # each Runtime is ~40-50MB and not returned to pool → heap leak under load.
  # Default 15 is too low for high-traffic sites. 64 covers most burst scenarios.
  HOOKS_POOL="${VANBLOG_HOOKS_POOL:-64}"
  PB_PACKS_FLAG=""
  if [ -n "$VANBLOG_PACKS_DIR" ]; then
    echo "[vanblog] local Pack overrides: $VANBLOG_PACKS_DIR"
    PB_PACKS_FLAG="--packsDir=$VANBLOG_PACKS_DIR"
  fi
  vanblog serve --http=$PB_HTTP --dir=$PB_DATA --hooksPool=$HOOKS_POOL --hooksWatch --coreSchemaPath=/core/models.js ${PB_PACKS_FLAG:+"$PB_PACKS_FLAG"} &
  PB_PID=$!
  echo "$PB_PID" > "$PB_PID_FILE"
  wait_for "http://127.0.0.1:8090/api/health" "PocketBase" 30 || return 1
}
start_pocketbase || exit 1

# 3.5. Write agent.env — credentials/navigation for AI agents (Pi/Claude/Cursor).
# Agents source /etc/vanblog/agent.env to call pb REST API via @vanblog/sdk.
# Admin password is NOT embedded here; agents obtain a token via:
#   POST /api/collections/users/auth-with-password {email,password}
# using VANBLOG_EMAIL (set in docker-compose) + the password the operator chose
# during first-run setup. See AGENTS.md (§环境) for the fallback flow.
mkdir -p /etc/vanblog
# Recognise the compose placeholder so we don't write a misleading email.
AGENT_EMAIL="${VANBLOG_EMAIL:-}"
[ "$AGENT_EMAIL" = "admin@example.com" ] && AGENT_EMAIL=""
cat > /etc/vanblog/agent.env <<EOF
# Vanblog agent environment — generated by entrypoint.dev.sh at container start.
# Source this file (\`. /etc/vanblog/agent.env\`) to get SDK-ready env vars.
export PB_URL=http://127.0.0.1:8090
export ASTRO_URL=http://127.0.0.1:4321
export VANBLOG_MODE=dev
export VANBLOG_EMAIL=$AGENT_EMAIL
# Admin password: NOT stored here. Run first-run setup if VANBLOG_EMAIL is empty
# (check via: curl -s http://127.0.0.1:8090/api/vanblog/setup/status).
EOF
chmod 600 /etc/vanblog/agent.env
echo "[vanblog] agent.env written to /etc/vanblog/agent.env (see AGENTS.md §环境)"

# 3.6. Initialize pi coding agent config — resolve live Zen free model + write trust.
# Fail-open: if init-pi-config fails (network down), pi still starts with
# the hardcoded fallback model from .pi/settings.json.
# VANBLOG_WORKSPACE pins the workspace root for source-less container runs
# (init-pi-config falls back to deriving the repo root from its own path).
echo "[vanblog] initializing pi agent config..."
export VANBLOG_WORKSPACE=/workspace
node /workspace/scripts/runtime/init-pi-config.mjs || echo "[vanblog] pi config init skipped (will use fallback)"

# 3.7. Start the Zen auth-stripping proxy used by pi's OpenCode Zen provider.
# The Go agent manager starts one native pi RPC process per persisted session.
echo "[vanblog] starting pi model proxy..."
node /workspace/scripts/runtime/pi-zen-proxy.mjs &
PI_PROXY_PID=$!

# 4. Start Theme Host (loads active theme's SSR handler, routes /admin to app)
DEFAULT_THEME=$(cat /etc/vanblog/default-theme 2>/dev/null || echo "vanblog")
echo "[vanblog] starting theme host (default theme: ${DEFAULT_THEME})"
VANBLOG_THEMES_DIR=/var/lib/vanblog/themes \
VANBLOG_THEMES_BUILTIN_DIR=/build/themes \
VANBLOG_DEFAULT_THEME=${DEFAULT_THEME} \
VANBLOG_ADMIN_DIST_DIR=/build/app/dist \
PB_URL=http://127.0.0.1:8090 \
  node /workspace/app/src/theme-host/index.mjs &
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
    if ! kill -0 $PI_PROXY_PID 2>/dev/null; then echo "[vanblog] FATAL: pi model proxy died"; exit 1; fi
    sleep 5
  done
}
monitor_children &
MONITOR_PID=$!

# 6. Wait for Caddy process (Caddy is no longer PID 1, entrypoint is).
# pb's OnBootstrap hook will call LoadConfig to inject full routes (dev variant).
echo "[vanblog] all services up, caddy bootstrap will be replaced by pb OnBootstrap hook"
echo "[vanblog] container is in foreground wait mode"
# Loop: SIGUSR1 (supervised restart) interrupts wait; resume waiting unless
# Caddy actually exited.
while true; do
  wait $CADDY_PID 2>/dev/null || exit_code=$?
  exit_code=${exit_code:-0}
  # If Caddy exited normally (exit code 0) or with a non-signal error,
  # the container should shut down. A signal interruption (exit code 128+N)
  # means a trap handler ran (e.g. supervised_restart_pb); keep waiting.
  if [ $exit_code -lt 128 ]; then
    echo "[vanblog] Caddy exited (code $exit_code), shutting down"
    break
  fi
  exit_code=0
  # Re-check Caddy is still alive before waiting again
  kill -0 $CADDY_PID 2>/dev/null || { echo "[vanblog] Caddy exited during restart, shutting down"; break; }
done
