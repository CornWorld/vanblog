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
SUPERUSER_EMAIL="${SUPERUSER_EMAIL:-admin@test.com}"
SUPERUSER_PASSWORD="${SUPERUSER_PASSWORD:-password123}"

# === Step 1: Clean up ===
header "Step 1/6: Stop & remove old container + data"
stop_container "$CONTAINER_NAME"
clean_data_dir

# === Step 2: Build dev image ===
echo ""
header "Step 2/6: Build dev Docker image"
build_dev_image "$IMAGE_NAME"

# === Step 3: Start fresh container ===
echo ""
header "Step 3/6: Start fresh dev container"
start_dev_container "$IMAGE_NAME" "$CONTAINER_NAME" "$HOST_PORT" "$SUPERUSER_EMAIL"

# === Step 4: Wait for services ===
echo ""
header "Step 4/6: Wait for services"
wait_for_url "http://localhost:${HOST_PORT}/api/health" "PocketBase API" 120
wait_for_url "http://localhost:${HOST_PORT}/" "Blog Frontend" 60
check_hooks_loaded "$CONTAINER_NAME"

# === Step 5: Verify key endpoints ===
echo ""
header "Step 5/6: Verify key endpoints"
check_endpoint "/"              "Blog homepage"
check_endpoint "/login"         "Login page"
check_endpoint "/admin/"        "Admin page (may redirect to login)"
check_endpoint "/setup"         "Setup page (should be closed after superuser)"
check_endpoint "/api/health"    "Health API"
check_endpoint "/_/"            "PocketBase admin"

# === Step 6: E2E journey (macro assertions) ===
echo ""
header "Step 6/6: E2E journey (theme/unlock/feed/visibility/freshness)"
E2E_ADMIN_EMAIL="$SUPERUSER_EMAIL" bash "$SCRIPT_DIR/../test/e2e-journey.sh" "http://localhost:${HOST_PORT}"

# === Summary ===
print_summary "$HOST_PORT" "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD"
