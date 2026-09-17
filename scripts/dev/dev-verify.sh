#!/bin/bash
# ==============================================================================
# Vanblog Dev Test — Full end-to-end verification
# 1. Clean up old containers and data
# 2. Build a fresh dev Docker image
# 3. Start the container
# 4. Wait for services and verify key endpoints
# 5. E2E journey + browser journey
#
# Usage:
#   bash dev-verify.sh                 # run full verification on slot vanblog-dev
#   CONTAINER_NAME=foo HOST_PORT=8081 bash dev-verify.sh   # concurrent slot
#   bash dev-verify.sh --clean         # tear the slot down to zero residue
#
# Slots: the container name identifies a slot. A renamed slot gets its own
# data volumes and credential/assert temp paths, so multiple dev-verify
# instances can run concurrently. Same-slot operations (two verifies, or a
# verify and a --clean) are mutually exclusive via a lock.
# ==============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

# --- Configuration ---
CLEAN=0
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=1 ;;
    *) echo "未知参数: $arg(支持: --clean)"; exit 2 ;;
  esac
done
CONTAINER_NAME="${CONTAINER_NAME:-vanblog-dev}"
IMAGE_NAME="${IMAGE_NAME:-vanblog:dev-test}"
HOST_PORT="${HOST_PORT:-8080}"
# Volume suffix + E2E instance tag follow the container name: a renamed
# container gets its own data volumes and credential/assert temp paths, so a
# second dev-verify can run concurrently with the default one. The default
# name keeps the prod-compose volume names (empty suffix).
VOLUME_SUFFIX=""
if [ "$CONTAINER_NAME" != "vanblog-dev" ]; then VOLUME_SUFFIX="-${CONTAINER_NAME}"; fi
# 仅改名槽位导出 E2E_INSTANCE:journey/browser 用它给 /tmp 凭据与断言产物
# 加后缀。默认槽不导出(产物不带后缀),与下方 --clean 的 VOLUME_SUFFIX=""
# 清理路径保持同一套命名——否则默认槽的 --clean 永远扫不到自己的残留。
if [ "$CONTAINER_NAME" != "vanblog-dev" ]; then export E2E_INSTANCE="${CONTAINER_NAME}"; fi

# Same-slot operations (a verify run and a --clean, or two verifies) are
# mutually exclusive: both stomp the same container/volumes. mkdir is atomic
# on macOS/BSD too (no flock there); a stale lock from a dead holder is taken
# over via its pid.
LOCK_DIR="/tmp/vanblog-dev-verify${VOLUME_SUFFIX}.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  OLD_PID="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && ! kill -0 "$OLD_PID" 2>/dev/null; then
    rm -rf "$LOCK_DIR"
    mkdir "$LOCK_DIR"
  else
    echo "同槽操作互斥:$LOCK_DIR 已被 pid=$OLD_PID 持有(容器=$CONTAINER_NAME)。并发请换名并错开端口: CONTAINER_NAME=<name> HOST_PORT=<port> $0"
    exit 1
  fi
fi
# 记录持锁者 pid:崩溃(SIGKILL/断电)绕过 EXIT trap 时,下一次运行的
# stale-pid 接管逻辑据此判断锁已死并自动收编。
echo $$ > "$LOCK_DIR/pid"
SUPERUSER_EMAIL="${SUPERUSER_EMAIL:-admin@test.com}"
SUPERUSER_PASSWORD="${SUPERUSER_PASSWORD:-password123}"

# --- Phase timing: per-phase seconds printed live, appended to a JSONL ledger
# --- at exit (even on failure) so trends are comparable across runs.
TIMING_FILE="${TIMING_FILE:-${TMPDIR:-/tmp}/vanblog-dev-verify-timing${VOLUME_SUFFIX}.jsonl}"
RUN_T0=$(date +%s); PHASE_T0=$RUN_T0
PHASES=()
phase_done() {
  local name="$1" now; now=$(date +%s)
  PHASES+=("\"${name}\":$((now - PHASE_T0))")
  info "${name} 耗时 $((now - PHASE_T0))s"
  PHASE_T0=$now
}
write_timing() {
  local verdict="ok"; [ "${VERDICT:-}" = "fail" ] && verdict="fail" || true
  if [ "$CLEAN" != 1 ]; then
    printf '{"ts":"%s","slot":"%s","verdict":"%s","total":%d,"phases":{%s}}\n' \
      "$(date -u +%FT%TZ)" "$CONTAINER_NAME" "$verdict" "$(( $(date +%s) - RUN_T0 ))" \
      "$(printf '%s,' "${PHASES[@]}" | sed 's/,$//')" >> "$TIMING_FILE"
fi
}
trap 'VERDICT="${VERDICT:-fail}"; write_timing; rm -rf "$LOCK_DIR" 2>/dev/null' EXIT

# === --clean: tear the slot down to zero residue, then exit ===
# Removes the container, this slot's four volumes, and its credential/assert
# temp files. Holds the same slot lock as a running verify, so it can never
# race a live run — it either takes over a stale lock or refuses while the
# holder is alive.
if [ "$CLEAN" = 1 ]; then
  header "Clean slot: $CONTAINER_NAME"
  stop_container "$CONTAINER_NAME"
  for v in $(dev_volumes "$VOLUME_SUFFIX"); do
    if docker volume rm "$v" >/dev/null 2>&1; then
      echo "  removed volume: $v"
    fi
  done
  for email in "$SUPERUSER_EMAIL" "e2e@vanblog.local"; do
    f="/tmp/vanblog-e2e-admin-${email}${VOLUME_SUFFIX}.env"
    [ -f "$f" ] && { rm -f "$f"; echo "  removed credential: $f"; }
  done
  for f in "/tmp/vb-e2e${VOLUME_SUFFIX}.png" "/tmp/vb-e2e-dl${VOLUME_SUFFIX}.png" \
           "/tmp/vb-e2e-patch${VOLUME_SUFFIX}.json" "/tmp/vb-e2e-palette${VOLUME_SUFFIX}.css"; do
    [ -f "$f" ] && { rm -f "$f"; echo "  removed artifact: $f"; }
  done
  ok "槽 $CONTAINER_NAME 已清零(容器/卷/凭据/断言产物)"
  exit 0
fi

# === Step 1: Clean up ===
header "Step 1/7: Stop & remove old container + data"
clean_data_dir "$VOLUME_SUFFIX"; phase_done cleanup

# === Step 2: Build dev image ===
echo ""
header "Step 2/7: Build dev Docker image"
build_dev_image "$IMAGE_NAME"; phase_done build

# === Step 3: Start fresh container ===
echo ""
header "Step 3/7: Start fresh dev container"
start_dev_container "$IMAGE_NAME" "$CONTAINER_NAME" "$HOST_PORT" "$SUPERUSER_EMAIL" "$VOLUME_SUFFIX"

# === Step 4: Wait for services ===
echo ""
header "Step 4/7: Wait for services"
wait_for_url "http://localhost:${HOST_PORT}/api/health" "PocketBase API" 120
wait_for_url "http://localhost:${HOST_PORT}/" "Blog Frontend" 60
check_hooks_loaded "$CONTAINER_NAME"; phase_done start_and_wait

# === Step 5: Verify key endpoints ===
echo ""
header "Step 5/7: Verify key endpoints"
check_endpoint "/"              "Blog homepage"
check_endpoint "/login"         "Login page"
check_endpoint "/admin/"        "Admin page (may redirect to login)"
check_endpoint "/setup"         "Setup page (should be closed after superuser)"
check_endpoint "/api/health"    "Health API"
check_endpoint "/_/"            "PocketBase admin"

# === Step 6: E2E journey ===
echo ""
header "Step 6/7: E2E journey (theme/unlock/feed/visibility/freshness)"
E2E_ADMIN_EMAIL="$SUPERUSER_EMAIL" bash "$SCRIPT_DIR/../test/e2e-journey.sh" "http://localhost:${HOST_PORT}"; phase_done journey

if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] || command -v google-chrome >/dev/null 2>&1 || command -v google-chrome-stable >/dev/null 2>&1; then
  E2E_ADMIN_EMAIL="$SUPERUSER_EMAIL" node "$SCRIPT_DIR/../test/e2e-browser.mjs" "http://localhost:${HOST_PORT}"
  phase_done browser
else
  echo "[SKIP] 未检测到系统 Chrome——浏览器旅程只在 CI/有 Chrome 的机器上跑"
fi

# === Summary ===
VERDICT=ok
print_summary "$HOST_PORT" "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD"
