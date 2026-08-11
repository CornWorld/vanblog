#!/usr/bin/env bash
# ============================================================================
# test-pi-pack.sh — End-to-end pi agent pack-creation test
# ============================================================================
#
# Overview:
#   1. Build the dev Docker image (if not already built)
#   2. Start a fresh container
#   3. Wait for all services to be ready
#   4. Run pi with a minimal prompt to create the pow-guard pack
#   5. Validate the result: pack files exist, hook API works, frontend injects
#
# Usage:
#   ./scripts/test-pi-pack.sh              # full test (builds if needed)
#   ./scripts/test-pi-pack.sh --no-build   # skip Docker build (image must exist)
#   ./scripts/test-pi-pack.sh --cleanup    # remove test container after run
#
# Prerequisites:
#   - Docker daemon running
#   - Vanblog repo at $PROJECT_ROOT (auto-detected)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_TAG="vanblog:dev-test"
CONTAINER_NAME="vanblog-pi-test-$$"
HTTP_PORT="${TEST_PORT:-8880}"
TEST_TIMEOUT=120   # seconds to wait for container readiness

# User packs live on a mounted volume (NOT in the builtin /packs dir).
# This mirrors how a real operator adds packs — pi writes here, never to builtin.
# The mount is a temp dir on the host, cleaned up after the test.
HOST_USER_PACKS="$(mktemp -d)"
CONTAINER_USER_PACKS="/workspace/user-packs"

# pi prompt — minimal, no project background, just the WHAT.
# Tells pi to create the pack in the user-packs dir (mounted volume).
read -r -d '' PI_PROMPT <<'EOF' || true
Create a new vanblog user pack called pow-guard inside /workspace/user-packs (NOT /workspace/packs — that is the builtin dir, do not touch it). The pack should inject a JavaScript file on all public pages that implements SHA-256 proof-of-work verification. The verification result must be cached in localStorage for 1 hour. The pack needs a PB hook with two endpoints: GET /api/vanblog/pow-guard/challenge (returns random challenge + difficulty) and POST /api/vanblog/pow-guard/verify (validates the nonce against SHA-256 hash with leading zeros, returns a stateless token). The frontend JS should show a full-screen overlay during verification and hide it once the token is cached. Create /workspace/user-packs/pow-guard/ with pack.json + hooks/ + frontend/.
EOF

# ── Color output ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
pass() { echo -e "${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $*"; }
step() { echo -e "\n${GREEN}── $* ──${NC}"; }

# ── Args ─────────────────────────────────────────────────────────
DO_BUILD=true
DO_CLEANUP=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=false ;;
    --cleanup)  DO_CLEANUP=true ;;
    --dry-run)  DRY_RUN=true ;;
    --help|-h)  echo "Usage: $0 [--no-build] [--cleanup] [--dry-run]"; exit 0 ;;
  esac
done

# ── Cleanup trap ─────────────────────────────────────────────────
cleanup() {
  if [ "$DO_CLEANUP" = true ] || [ "${1:-}" = "force" ]; then
    info "Cleaning up container $CONTAINER_NAME..."
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
    rm -rf "$HOST_USER_PACKS"
  else
    info "Container kept running: $CONTAINER_NAME"
    info "  docker exec -it $CONTAINER_NAME pi      # interact with pi"
    info "  docker rm -f $CONTAINER_NAME             # remove when done"
    info "  user-packs volume (host): $HOST_USER_PACKS"
    info "  rm -rf $HOST_USER_PACKS                   # remove volume when done"
  fi
}
trap 'cleanup force' EXIT

# ── Step 1: Build dev image ──────────────────────────────────────
step "Step 1: Build dev image"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping Docker build"
elif [ "$DO_BUILD" = true ]; then
  info "Building $IMAGE_TAG..."
  docker build --target dev -t "$IMAGE_TAG" "$PROJECT_ROOT" \
    || fail "Docker build failed"
  pass "Image built: $IMAGE_TAG"
else
  info "Skipping build (--no-build). Checking image..."
  docker image inspect "$IMAGE_TAG" >/dev/null 2>&1 \
    || fail "Image $IMAGE_TAG not found. Run without --no-build first."
  pass "Image exists: $IMAGE_TAG"
fi

# ── Step 2: Start container ─────────────────────────────────────
step "Step 2: Start container"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping container start"
else
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$HTTP_PORT:80" \
    -e VANBLOG_HTTP_ONLY=1 \
    -e VANBLOG_PACKS_DIR="$CONTAINER_USER_PACKS" \
    -v "$HOST_USER_PACKS:$CONTAINER_USER_PACKS" \
    "$IMAGE_TAG" \
    || fail "Failed to start container"
  pass "Container started: $CONTAINER_NAME (port $HTTP_PORT, user-packs volume: $HOST_USER_PACKS)"
fi

# ── Step 3: Wait for readiness ───────────────────────────────────
step "Step 3: Wait for readiness"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping readiness check"
else
  ATTEMPT=0
  while [ $ATTEMPT -lt $TEST_TIMEOUT ]; do
    if curl -sf -o /dev/null "http://127.0.0.1:$HTTP_PORT/api/health" 2>/dev/null; then
      pass "PocketBase ready (${ATTEMPT}s)"
      break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
  done
  if [ $ATTEMPT -ge $TEST_TIMEOUT ]; then
    fail "Container did not become ready within ${TEST_TIMEOUT}s"
  fi

  # Also verify pi is installed
  docker exec "$CONTAINER_NAME" which pi >/dev/null 2>&1 \
    || fail "pi not found in container"
  pass "pi binary present"
fi

# ── Step 4: Run pi agent to create pack in user-packs volume ─────
step "Step 4: Run pi agent to create pack"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping pi creation"
elif docker exec "$CONTAINER_NAME" test -f "$CONTAINER_USER_PACKS/pow-guard/pack.json" 2>/dev/null; then
  info "pow-guard already present in user-packs volume — skipping pi creation"
else
  info "Giving pi the prompt..."
  info "Prompt: $(echo "$PI_PROMPT" | head -1)..."
  # Run pi against the workspace (cwd=/workspace). It reads the vanblog skill
  # and writes the pack to the mounted user-packs volume.
  if docker exec -i -w /workspace "$CONTAINER_NAME" \
    pi -p "$PI_PROMPT" --approve 2>&1; then
    pass "pi completed successfully"
  else
    fail "pi exited with error. See logs above."
  fi
fi

# ── Step 5: Validate pack structure (in user-packs volume) ───────
step "Step 5: Validate pack structure"
validate() {
  local file="$1" desc="$2"
  if docker exec "$CONTAINER_NAME" test -f "$file" 2>/dev/null; then
    pass "$desc exists: $file"
  else
    fail "$desc MISSING: $file"
  fi
}
validate "$CONTAINER_USER_PACKS/pow-guard/pack.json"                   "pack manifest"
validate "$CONTAINER_USER_PACKS/pow-guard/hooks/pow-guard.pb.js"       "PB hook"
validate "$CONTAINER_USER_PACKS/pow-guard/frontend/pow-guard.js"       "frontend script"

# ── Step 5.5: Verify it did NOT land in builtin /packs ───────────
step "Step 5.5: Verify NOT in builtin"
if docker exec "$CONTAINER_NAME" test -f /workspace/packs/pow-guard/pack.json 2>/dev/null; then
  fail "pow-guard wrongly created in builtin /workspace/packs — pi ignored the user-packs dir"
else
  pass "builtin /workspace/packs untouched (no pow-guard there)"
fi

# ── Step 6: Validate pack.json contents ──────────────────────────
step "Step 6: Validate pack.json"
PACK_JSON=$(docker exec "$CONTAINER_NAME" cat "$CONTAINER_USER_PACKS/pow-guard/pack.json" 2>/dev/null || echo "{}")
echo "$PACK_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('name')=='pow-guard', f'name mismatch: {d.get(\"name\")}'
assert d.get('version'), 'version missing'
frontend=d.get('frontend',{})
assert frontend.get('scope')=='public', f'scope mismatch: {frontend.get(\"scope\")}'
assert 'pow-guard.js' in frontend.get('scripts',[]), 'frontend script missing'
print('pack.json valid')
" || fail "pack.json validation failed"
pass "pack.json valid"

# ── Step 7: Validate hook endpoint (API test) ────────────────────
step "Step 7: Validate challenge endpoint"
CHALLENGE_RESP=$(curl -sf "http://127.0.0.1:$HTTP_PORT/api/vanblog/pow-guard/challenge" 2>/dev/null || echo "")
if echo "$CHALLENGE_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert 'challenge' in d, 'challenge missing'
assert isinstance(d.get('difficulty'),int), 'difficulty missing/not int'
assert len(d['challenge']) > 0, 'challenge empty'
print('challenge OK')
" 2>/dev/null; then
  pass "challenge endpoint returns valid response"
else
  fail "challenge endpoint failed. Response: ${CHALLENGE_RESP:0:200}"
fi

# ── Step 8: Validate verify flow end-to-end ──────────────────────
step "Step 8: Validate full PoW flow"
CHALLENGE=$(echo "$CHALLENGE_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge'])")
DIFFICULTY=$(echo "$CHALLENGE_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['difficulty'])")

# Compute PoW locally
info "Solving PoW with difficulty=$DIFFICULTY..."
POW_RESULT=$(python3 -c "
import hashlib, sys
challenge = sys.argv[1]
difficulty = int(sys.argv[2])
prefix = '0' * difficulty
nonce = 0
while True:
    h = hashlib.sha256(f'{challenge}{nonce}'.encode()).hexdigest()
    if h.startswith(prefix):
        print(nonce)
        break
    nonce += 1
" "$CHALLENGE" "$DIFFICULTY")

VERIFY_RESP=$(curl -sf -X POST "http://127.0.0.1:$HTTP_PORT/api/vanblog/pow-guard/verify" \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"$CHALLENGE\",\"nonce\":$POW_RESULT,\"difficulty\":$DIFFICULTY}" 2>/dev/null)

if echo "$VERIFY_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert 'token' in d, 'token missing'
assert d.get('expiresAt',0) > 0, 'expiresAt invalid'
print('verify OK')
" 2>/dev/null; then
  pass "verify endpoint returns valid token (PoW solved in nonce=$POW_RESULT)"
else
  fail "verify endpoint failed. Response: ${VERIFY_RESP:0:200}"
fi

# ── Step 9: Validate frontend loads on public pages ──────────────
step "Step 9: Validate frontend script injection"
HTML=$(curl -sf "http://127.0.0.1:$HTTP_PORT/" 2>/dev/null || echo "")
if echo "$HTML" | grep -q "pow-guard.js"; then
  pass "pow-guard.js injected in page HTML"
else
  fail "pow-guard.js NOT found in page HTML. Check frontend scope and pack loading."
fi

# ── Done ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}ALL TESTS PASSED${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
info "Container: $CONTAINER_NAME (port $HTTP_PORT)"
info "  docker exec -it $CONTAINER_NAME pi   # open pi agent"
info "  docker logs $CONTAINER_NAME          # view logs"
info "  docker rm -f $CONTAINER_NAME         # cleanup"
echo ""
