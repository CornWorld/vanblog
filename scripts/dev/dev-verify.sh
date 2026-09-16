#!/bin/bash
# ==============================================================================
# Vanblog Dev Test — Full end-to-end verification
# 1. Clean up old containers and data
# 2. Build a fresh dev Docker image
# 3. Start the container
# 4. Wait for services and verify key endpoints
# ==============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

# --- Configuration ---
CONTAINER_NAME="${CONTAINER_NAME:-vanblog-dev}"
IMAGE_NAME="${IMAGE_NAME:-vanblog:dev-test}"
HOST_PORT="${HOST_PORT:-8080}"
# Volume suffix + E2E instance tag follow the container name: a renamed
# container gets its own data volumes and credential/assert temp paths, so a
# second dev-verify can run concurrently with the default one. The default
# name keeps the prod-compose volume names (empty suffix).
VOLUME_SUFFIX=""
if [ "$CONTAINER_NAME" != "vanblog-dev" ]; then VOLUME_SUFFIX="-${CONTAINER_NAME}"; fi
export E2E_INSTANCE="${CONTAINER_NAME}"

# Same default slot must not run twice (both would stomp the same container).
# mkdir is atomic on macOS/BSD too (no flock there); a stale lock from a dead
# holder is taken over via its pid.
LOCK_DIR="/tmp/vanblog-dev-verify${VOLUME_SUFFIX}.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  OLD_PID="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && ! kill -0 "$OLD_PID" 2>/dev/null; then
    rm -rf "$LOCK_DIR"
    mkdir "$LOCK_DIR"
  else
    echo "dev-verify 已有同槽实例在跑(容器=$CONTAINER_NAME)。并发请换名: CONTAINER_NAME=<name> $0"
    exit 1
  fi
fi
echo $$ > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR" 2>/dev/null' EXIT
SUPERUSER_EMAIL="${SUPERUSER_EMAIL:-admin@test.com}"
SUPERUSER_PASSWORD="${SUPERUSER_PASSWORD:-password123}"

# === Step 1: Clean up ===
header "Step 1/7: Stop & remove old container + data"
clean_data_dir "$VOLUME_SUFFIX"
header "Step 2/7: Build dev image"

# === Step 2: Build dev image ===
echo ""
header "Step 2/7: Build dev Docker image"
build_dev_image "$IMAGE_NAME"

# === Step 3: Start fresh container ===
echo ""
header "Step 3/7: Start fresh dev container"
start_dev_container "$IMAGE_NAME" "$CONTAINER_NAME" "$HOST_PORT" "$SUPERUSER_EMAIL" "$VOLUME_SUFFIX"

# === Step 4: Wait for services ===
echo ""
header "Step 4/7: Wait for services"
wait_for_url "http://localhost:${HOST_PORT}/api/health" "PocketBase API" 120
wait_for_url "http://localhost:${HOST_PORT}/" "Blog Frontend" 60
check_hooks_loaded "$CONTAINER_NAME"

# === Step 5: Verify key endpoints ===
echo ""
header "Step 5/7: Verify key endpoints"
check_endpoint "/"              "Blog homepage"
check_endpoint "/login"         "Login page"
check_endpoint "/admin/"        "Admin page (may redirect to login)"
check_endpoint "/setup"         "Setup page (should be closed after superuser)"
check_endpoint "/api/health"    "Health API"
check_endpoint "/_/"            "PocketBase admin"

header "Step 6/7: E2E journey (theme/unlock/feed/visibility/freshness)"
echo ""
E2E_ADMIN_EMAIL="$SUPERUSER_EMAIL" bash "$SCRIPT_DIR/../test/e2e-journey.sh" "http://localhost:${HOST_PORT}"

# === Step 7: Browser journey (real Chrome) ===
echo ""
header "Step 7/7: Browser journey (dark mode / clickability / editor UI)"
# 需要系统 Chrome;缺失时跳过并提示(本地无 Chrome 的环境只跑 HTTP 断言面)
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] || command -v google-chrome >/dev/null 2>&1 || command -v google-chrome-stable >/dev/null 2>&1; then
  E2E_ADMIN_EMAIL="$SUPERUSER_EMAIL" node "$SCRIPT_DIR/../test/e2e-browser.mjs" "http://localhost:${HOST_PORT}"
else
  echo "[SKIP] 未检测到系统 Chrome——浏览器旅程只在 CI/有 Chrome 的机器上跑"
fi

# === Summary ===
print_summary "$HOST_PORT" "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD"
