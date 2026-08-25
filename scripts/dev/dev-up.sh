#!/bin/bash
# ==============================================================================
# Vanblog Dev Reset — Quick rebuild + health check (no endpoint verification)
# 1. Clean up old container and data
# 2. Build a fresh dev Docker image
# 3. Start the container
# 4. Create superuser
# 5. Health check
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

# --- Configuration ---
CONTAINER_NAME="${CONTAINER_NAME:-vanblog-dev}"
IMAGE_NAME="${IMAGE_NAME:-vanblog:dev-test}"
HOST_PORT="${HOST_PORT:-8080}"
SUPERUSER_EMAIL="${SUPERUSER_EMAIL:-admin@test.com}"
SUPERUSER_PASSWORD="${SUPERUSER_PASSWORD:-password123}"

# === Step 1: Clean up ===
header "Step 1: Stop & remove old container"
stop_container "$CONTAINER_NAME"
clean_data_dir

# === Step 2: Build dev image ===
echo ""
header "Step 2: Build dev image"
build_dev_image "$IMAGE_NAME"

# === Step 3: Start fresh container ===
echo ""
header "Step 3: Start fresh container"
start_dev_container "$IMAGE_NAME" "$CONTAINER_NAME" "$HOST_PORT"

# === Step 4: Create superuser ===
echo ""
header "Step 4: Create superuser"
docker exec "$CONTAINER_NAME" vanblog superuser upsert "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" --dir=/pb_data 2>&1 | tail -1

# === Step 5: Health check ===
echo ""
header "Step 5: Health check"
HEALTH=$(curl -sf "http://localhost:${HOST_PORT}/api/health")
echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print('health:', d.get('message','FAIL'))" 2>/dev/null || echo "health: raw=$HEALTH"

# === Step 6: Verify hooks loaded ===
echo ""
check_hooks_loaded "$CONTAINER_NAME"

# === Ready ===
echo ""
echo -e "${GREEN}=== Ready ===${NC}"
echo "Blog:      http://localhost:${HOST_PORT}/"
echo "Setup:     http://localhost:${HOST_PORT}/setup"
echo "Bookmarks: http://localhost:${HOST_PORT}/p/bookmarks"
echo "PB Admin:  http://localhost:${HOST_PORT}/_/"
echo ""
echo "Superuser: admin@test.com / password123"
echo ""
echo "Logs: docker logs -f $CONTAINER_NAME"
echo "Stop: docker stop $CONTAINER_NAME"
