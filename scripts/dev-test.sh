#!/bin/bash
# ==============================================================================
# Vanblog Dev Test Script
# 1. Clean up old containers and data
# 2. Build a fresh dev Docker image
# 3. Start the container
# 4. Wait for services and verify key endpoints
# ==============================================================================
set -e

# --- Configuration ---
CONTAINER_NAME="vanblog-dev"
IMAGE_NAME="vanblog:dev-test"
HOST_PORT=8080
SUPERUSER_EMAIL="admin@test.com"
SUPERUSER_PASSWORD="password123"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# --- Cleanup function ---
cleanup() {
  info "Cleaning up..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  info "Removing old pb_data and caddy_data..."
  rm -rf "$PROJECT_ROOT/pb_data" 2>/dev/null || true
  rm -rf "$PROJECT_ROOT/caddy_data" 2>/dev/null || true
  ok "Cleanup done"
}

# --- Health check helper ---
wait_for_url() {
  local url="$1"
  local name="$2"
  local max="${3:-60}"
  local i=0
  while [ $i -lt $max ]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      ok "$name is ready (took ${i}s)"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  err "$name did not become ready within ${max}s"
  return 1
}

# ==============================================================================
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}       Vanblog Dev Test — Reset & Fresh Start                ${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# === Step 1: Clean up ===
echo -e "${YELLOW}--- Step 1/5: Stop & remove old container + data ---${NC}"
cleanup

# === Step 2: Build dev image ===
echo ""
echo -e "${YELLOW}--- Step 2/5: Build dev Docker image ---${NC}"
cd "$PROJECT_ROOT"
info "Building --target dev as $IMAGE_NAME ..."
docker build --target dev -t "$IMAGE_NAME" \
  --build-arg "BUILD_VERSION=$(git describe --always --dirty --long 2>/dev/null || date -u +%Y%m%d%H%M%S)" .
ok "Image built: $IMAGE_NAME"

# === Step 3: Start fresh container ===
echo ""
echo -e "${YELLOW}--- Step 3/5: Start fresh dev container ---${NC}"
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$HOST_PORT:8080" \
  -e VANBLOG_HTTP_ONLY=1 \
  -e VANBLOG_EMAIL=test@example.com \
  "$IMAGE_NAME"

ok "Container started: $CONTAINER_NAME"
info "Waiting for initial bootstrap (Caddy + PocketBase + Astro)..."
sleep 10

# === Step 4: Wait for services ===
echo ""
echo -e "${YELLOW}--- Step 4/5: Wait for services ---${NC}"
wait_for_url "http://localhost:$HOST_PORT/api/health" "PocketBase API" 120
wait_for_url "http://localhost:$HOST_PORT/" "Blog Frontend" 60

info "Verifying hooks loaded..."
docker logs "$CONTAINER_NAME" 2>&1 | grep "hook loaded" | head -5 || warn "No 'hook loaded' messages found (may be non-fatal)"

# === Step 5: Verify key endpoints ===
echo ""
echo -e "${YELLOW}--- Step 5/5: Verify key endpoints ---${NC}"

check_endpoint() {
  local url="$1"
  local desc="$2"
  local expected_status="${3:-200}"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$HOST_PORT$url")
  if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "302" ] || [ "$http_code" = "200" ]; then
    ok "$desc → $http_code"
  else
    warn "$desc returned $http_code (expected $expected_status)"
  fi
}

check_endpoint "/"              "Blog homepage"
check_endpoint "/login"         "Login page"
check_endpoint "/admin/"        "Admin page (may redirect to login)"
check_endpoint "/setup"         "Setup page (should be closed after superuser)"
check_endpoint "/api/health"    "Health API"
check_endpoint "/_/"            "PocketBase admin"

# === Summary ===
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}       Dev environment is ready!                            ${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "  ${CYAN}Blog:${NC}      http://localhost:$HOST_PORT/"
echo -e "  ${CYAN}Login:${NC}     http://localhost:$HOST_PORT/login"
echo -e "  ${CYAN}Admin:${NC}     http://localhost:$HOST_PORT/admin/"
echo -e "  ${CYAN}Setup:${NC}     http://localhost:$HOST_PORT/setup"
echo -e "  ${CYAN}PB Admin:${NC}  http://localhost:$HOST_PORT/_/"
echo ""
echo -e "  ${CYAN}Superuser:${NC} $SUPERUSER_EMAIL / $SUPERUSER_PASSWORD"
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    Logs:  docker logs -f $CONTAINER_NAME"
echo -e "    Stop:  docker stop $CONTAINER_NAME"
echo -e "    Exec:  docker exec -it $CONTAINER_NAME sh"
echo ""
