#!/bin/bash
# ============================================================================
# Vanblog Dev Scripts — Shared Library
# Sourced by dev-up.sh, dev-verify.sh, and similar scripts.
# ============================================================================

# --- Color output ---
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export CYAN='\033[0;36m'
export NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }
header(){ echo -e "${YELLOW}--- $1 ---${NC}"; }

# Legacy aliases used by test/install-test.sh
red()   { echo -e "${RED}$1${NC}"; }
green() { echo -e "${GREEN}$1${NC}"; }
blue()  { echo -e "${CYAN}$1${NC}"; }

# Test assertions (pass/fail counters)
PASS=0
FAIL=0
assert_ok()   { PASS=$((PASS+1)); green "  ✓ $1"; }
assert_fail() { FAIL=$((FAIL+1)); red   "  ✗ $1 (${2:-})"; }

# --- Helpers ---

# Project root (parent of scripts/ dir)
project_root() {
  echo "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
}

# Build version for Docker (git describe or fallback timestamp)
build_version() {
  git describe --always --dirty --long 2>/dev/null || date -u +%Y%m%d%H%M%S
}

# Build the dev Docker image with BUILD_VERSION injected.
# Usage: build_dev_image <image_name>
build_dev_image() {
  local image="$1"
  local root; root="$(project_root)"
  info "Building --target dev as ${image} ..."
  (cd "$root" && docker build --target dev -t "$image" \
    --build-arg "BUILD_VERSION=$(build_version)" .) || { err "Docker build failed"; return 1; }
  ok "Image built: $image"
}

# Stop and remove a container by name (no error if missing).
# Usage: stop_container <container_name>
stop_container() {
  local name="$1"
  docker stop "$name" 2>/dev/null || true
  docker rm "$name" 2>/dev/null || true
}

# Dev containers mount the SAME named data volumes as the prod compose, so a
# reset must drop them too (not just the legacy repo dirs). Keep the names in
# one place — clean_data_dir and start_dev_container both derive from it so
# they cannot drift.
DEV_VOLUMES=(vanblog_dev_pb_data vanblog_dev_caddy_data vanblog_dev_themes_data vanblog_dev_pack_data)

# Remove local pb_data and caddy_data directories, plus the dev data volumes.
# Usage: clean_data_dir
clean_data_dir() {
  local root; root="$(project_root)"
  info "Removing old pb_data and caddy_data..."
  rm -rf "$root/pb_data" "$root/caddy_data" 2>/dev/null || true
  local v
  for v in "${DEV_VOLUMES[@]}"; do
    if ! docker volume rm "$v" >/dev/null 2>&1; then
      warn "Volume $v still in use (stale container?) — not removed"
    fi
  done
  ok "Data directories and dev volumes cleaned"
}

# Start a dev container with standard options. Dev is a prod substitute, so it
# mounts the SAME data volumes as the prod compose (pb_data / caddy_data /
# themes_data / pack_data) — no image symlinks, identical runtime layout.
# Usage: start_dev_container <image_name> <container_name> <host_port> [email]
start_dev_container() {
  local image="$1" name="$2" port="$3" email="${4:-test@example.com}"
  docker run -d \
    --name "$name" \
    -p "${port}:8080" \
    -e VANBLOG_HTTP_ONLY=1 \
    -e VANBLOG_EMAIL="$email" \
    -e VANBLOG_PACKS_DIR=/var/lib/vanblog/packs \
    -v "${DEV_VOLUMES[0]}:/pb_data" \
    -v "${DEV_VOLUMES[1]}:/data/caddy" \
    -v "${DEV_VOLUMES[2]}:/var/lib/vanblog/themes" \
    -v "${DEV_VOLUMES[3]}:/var/lib/vanblog/packs" \
    "$image"
  ok "Container started: $name"
  info "Waiting for initial bootstrap (Caddy + PocketBase + Astro)..."
  sleep 10
}

# Poll a URL until it returns success or timeout.
# Usage: wait_for_url <url> <label> [timeout_seconds]
wait_for_url() {
  local url="$1" label="$2" max="${3:-60}" i=0
  while [ $i -lt $max ]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      ok "$label is ready (took ${i}s)"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  err "$label did not become ready within ${max}s"
  return 1
}

# Check a single endpoint on the dev server.
# Usage: check_endpoint <path> <description> [expected_status]
check_endpoint() {
  local path="$1" desc="$2" expected="${3:-200}" port="${HOST_PORT:-8080}"
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${path}")
  if [ "$http_code" = "$expected" ]; then
    ok "$desc → $http_code"
  else
    warn "$desc returned $http_code (expected $expected)"
  fi
}

# Verify PB hooks are loaded in container logs.
# Usage: check_hooks_loaded <container_name>
check_hooks_loaded() {
  local name="$1"
  info "Verifying hooks loaded..."
  docker logs "$name" 2>&1 | grep "hook loaded" | head -5 || \
    warn "No 'hook loaded' messages found (may be non-fatal)"
}

# Print summary of URLs and credentials.
# Usage: print_summary <host_port> [email] [password]
print_summary() {
  local port="$1" email="${2:-admin@test.com}" pass="${3:-${SUPERUSER_PASSWORD:-password123}}"
  echo ""
  echo -e "${GREEN}============================================================${NC}"
  echo -e "${GREEN}       Dev environment is ready!                            ${NC}"
  echo -e "${GREEN}============================================================${NC}"
  echo ""
  echo -e "  ${CYAN}Blog:${NC}      http://localhost:${port}/"
  echo -e "  ${CYAN}Login:${NC}     http://localhost:${port}/login"
  echo -e "  ${CYAN}Admin:${NC}     http://localhost:${port}/admin/"
  echo -e "  ${CYAN}Setup:${NC}     http://localhost:${port}/setup"
  echo -e "  ${CYAN}PB Admin:${NC}  http://localhost:${port}/_/"
  echo ""
  echo -e "  ${CYAN}Superuser:${NC} ${email} / ${pass}"
  echo ""
  echo -e "  ${YELLOW}Commands:${NC}"
  echo -e "    Logs:  docker logs -f ${CONTAINER_NAME:-vanblog-dev}"
  echo -e "    Stop:  docker stop ${CONTAINER_NAME:-vanblog-dev}"
  echo -e "    Exec:  docker exec -it ${CONTAINER_NAME:-vanblog-dev} sh"
  echo ""
}
