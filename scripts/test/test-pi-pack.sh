#!/usr/bin/env bash
# ============================================================================
# test-pi-pack.sh — End-to-end pi agent pack-creation test with artifact archive
# ============================================================================
#
# Overview:
#   1. Build the dev Docker image (if not already built)
#   2. Start a fresh container
#   3. Wait for all services to be ready
#   4. Run pi with a minimal prompt to create the pow-guard pack
#   5. Archive artifacts to .snow/artifacts/<run-id>/
#   6. Run the independent evaluator (evaluate-agent-pack.mjs)
#   7. Report results
#
# Usage:
#   ./scripts/test/test-pi-pack.sh                        # full test (builds if needed)
#   ./scripts/test/test-pi-pack.sh --no-build              # skip Docker build
#   ./scripts/test/test-pi-pack.sh --cleanup               # remove container after run
#   ./scripts/test/test-pi-pack.sh --keep-evidence         # keep container + temp dirs
#   ./scripts/test/test-pi-pack.sh --debug                 # alias for --keep-evidence
#   ./scripts/test/test-pi-pack.sh --skip-eval             # skip evaluator
#   ./scripts/test/test-pi-pack.sh --run-id <id>           # explicit run-id
#   ./scripts/test/test-pi-pack.sh --agent-timeout <sec>   # pi timeout (default 300)
#   ./scripts/test/test-pi-pack.sh --model <id>            # model id (default deepseek-v4-flash-0731:floor)
#   ./scripts/test/test-pi-pack.sh --base-url <url>        # api base url (default http://host.docker.internal:8317/v1)
#   ./scripts/test/test-pi-pack.sh --api-key <key>         # api key (default from AGENT_API_KEY env)
#   ./scripts/test/test-pi-pack.sh --dry-run               # dry-run mode
#
# Prerequisites:
#   - Docker daemon running
#   - Vanblog repo at $PROJECT_ROOT (auto-detected)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"
IMAGE_TAG="vanblog:dev-test"
CONTAINER_NAME="vanblog-pi-test-$$"
HTTP_PORT="${TEST_PORT:-8880}"
TEST_TIMEOUT=120     # seconds to wait for container readiness
AGENT_TIMEOUT=1800   # seconds for pi agent to complete (30 min)
RUN_ID="pi-pack-$(date +%Y%m%d-%H%M%S)"

# Model configuration — defaults to deepseek/deepseek-v4-flash-0731:floor via CLIProxyAPI.
# AGENT_MODEL is the FULL OpenRouter model id (":floor" is an OpenRouter variant suffix).
# It carries a "deepseek/" namespace prefix that is PART OF THE MODEL ID, not a pi
# provider. models.json reuses pi's built-in "openrouter" provider (baseUrl overridden
# to CLIProxyAPI) and defines this one model; at runtime we pass --provider openrouter so
# pi does not misread "deepseek" as a provider name.
# AGENT_API_KEY is read from env (never written to files, logs, or run.json)
AGENT_MODEL="${AGENT_MODEL:-deepseek/deepseek-v4-flash-0731:floor}"
AGENT_BASE_URL="${AGENT_BASE_URL:-http://host.docker.internal:8317/v1}"
AGENT_API_KEY="${AGENT_API_KEY:-}"
# Keep the complete upstream model id unchanged for both pi and the API.
PI_MODEL_SELECTOR="$AGENT_MODEL"

# User packs live on a mounted volume (NOT in the builtin /packs dir).
# This mirrors how a real operator adds packs — pi writes here, never to builtin.
# The mount is a temp dir on the host, cleaned up per --cleanup/--keep-evidence.
HOST_USER_PACKS="$(mktemp -d)"

# Artifact directory — persisted regardless of cleanup
ARTIFACTS_DIR="$PROJECT_ROOT/.snow/artifacts/$RUN_ID"
ARTIFACT_DIR="$ARTIFACTS_DIR/artifact"
TRANSCRIPT_PATH="$ARTIFACTS_DIR/transcript"
CONTAINER_LOG_PATH="$ARTIFACTS_DIR/container.log"
RUN_JSON_PATH="$ARTIFACTS_DIR/run.json"
SCORE_JSON_PATH="$ARTIFACTS_DIR/score.json"
CONTAINER_USER_PACKS="/workspace/user-packs"
CONTAINER_SESSION_DIR="/workspace/agent-session"
PI_SESSION_ARCHIVE="$ARTIFACTS_DIR/pi-session"


# pi prompt — minimal, no project background, just the WHAT.
# Tells pi to create the pack in the user-packs dir (mounted volume).
# DO NOT add evaluator rules, checklists, or exit criteria here.
read -r -d '' PI_PROMPT <<'EOF' || true
Create a vanblog user pack called pow-guard in /workspace/user-packs/pow-guard/.
(NOT /workspace/packs/ — that is the builtin dir, do not touch it.)

First, understand the pack format:
1. Run `tree /workspace/docs/` to see the documentation structure
2. Read docs/reference/packs.md for the pack format specification
3. Read /workspace/packs/visits/ as a working example (pack.json, hooks/, frontend/)

Then create the pack with:
- pack.json — frontend script injection (scope: public)
- hooks/<name>.pb.js — GET /api/vanblog/pow-guard/challenge (random challenge + difficulty) and POST /api/vanblog/pow-guard/verify (validate SHA-256 hash with leading zeros, return stateless token)
- frontend/<name>.js — SHA-256 PoW, full-screen overlay during verification, localStorage cache for 1 hour

Do NOT explore the architecture, test endpoints, or read source code.
EOF

# ── Args ─────────────────────────────────────────────────────────
DO_BUILD=true
DO_CLEANUP=false
KEEP_EVIDENCE=false
SKIP_EVAL=false
DRY_RUN=false
RUN_ID_OVERRIDE=""
AGENT_TIMEOUT_OVERRIDE=""
AGENT_MODEL_OVERRIDE=""
AGENT_BASE_URL_OVERRIDE=""
AGENT_API_KEY_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build)        DO_BUILD=false; shift ;;
    --cleanup)         DO_CLEANUP=true; shift ;;
    --keep-evidence|--debug) KEEP_EVIDENCE=true; shift ;;
    --skip-eval)       SKIP_EVAL=true; shift ;;
    --dry-run)         DRY_RUN=true; shift ;;
    --run-id)          RUN_ID_OVERRIDE="$2"; shift 2 ;;
    --agent-timeout)   AGENT_TIMEOUT_OVERRIDE="$2"; shift 2 ;;
    --model)           AGENT_MODEL_OVERRIDE="$2"; shift 2 ;;
    --base-url)        AGENT_BASE_URL_OVERRIDE="$2"; shift 2 ;;
    --api-key)         AGENT_API_KEY_OVERRIDE="$2"; shift 2 ;;
    --help|-h)         echo "Usage: $0 [--no-build] [--cleanup] [--keep-evidence|--debug] [--skip-eval] [--dry-run] [--run-id <id>] [--agent-timeout <sec>] [--model <id>] [--base-url <url>] [--api-key <key>]"; exit 0 ;;
    *)                 echo "Unknown arg: $1"; exit 1 ;;
  esac
done

[[ -n "$RUN_ID_OVERRIDE" ]] && RUN_ID="$RUN_ID_OVERRIDE"
[[ -n "$AGENT_TIMEOUT_OVERRIDE" ]] && AGENT_TIMEOUT="$AGENT_TIMEOUT_OVERRIDE"
[[ -n "$AGENT_MODEL_OVERRIDE" ]] && AGENT_MODEL="$AGENT_MODEL_OVERRIDE"
[[ -n "$AGENT_BASE_URL_OVERRIDE" ]] && AGENT_BASE_URL="$AGENT_BASE_URL_OVERRIDE"
[[ -n "$AGENT_API_KEY_OVERRIDE" ]] && AGENT_API_KEY="$AGENT_API_KEY_OVERRIDE"

# Recompute the pi model selector AFTER overrides are applied. It was captured
# from the default at line 52, so without this a --model override would leave
# pi using the stale default (e.g. st/deepseek-v4-flash) despite run.json
# recording the intended model.
PI_MODEL_SELECTOR="$AGENT_MODEL"

# Recompute artifact paths with final run-id
ARTIFACTS_DIR="$PROJECT_ROOT/.snow/artifacts/$RUN_ID"
ARTIFACT_DIR="$ARTIFACTS_DIR/artifact"
TRANSCRIPT_PATH="$ARTIFACTS_DIR/transcript"
CONTAINER_LOG_PATH="$ARTIFACTS_DIR/container.log"
RUN_JSON_PATH="$ARTIFACTS_DIR/run.json"
SCORE_JSON_PATH="$ARTIFACTS_DIR/score.json"
CONTAINER_USER_PACKS="/workspace/user-packs"
CONTAINER_SESSION_DIR="/workspace/agent-session"
PI_SESSION_ARCHIVE="$ARTIFACTS_DIR/pi-session"

# ── Cleanup trap ─────────────────────────────────────────────────
cleanup() {
  local reason="${1:-EXIT}"
  if [ "$DO_CLEANUP" = true ] && [ "$KEEP_EVIDENCE" = false ]; then
    info "Cleaning up container $CONTAINER_NAME..."
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
    rm -rf "$HOST_USER_PACKS"
    info "Removed container + temp user-packs"
  else
    if [ "$KEEP_EVIDENCE" = true ]; then
      info "Evidence kept (--keep-evidence):"
      detail "  Container: $CONTAINER_NAME (port $HTTP_PORT)"
      detail "  rm -rf $HOST_USER_PACKS    # host user-packs volume"
    else
      info "Container kept running: $CONTAINER_NAME"
      info "  docker exec -it $CONTAINER_NAME pi      # interact with pi"
      info "  docker rm -f $CONTAINER_NAME             # remove when done"
      info "  rm -rf $HOST_USER_PACKS                   # remove volume when done"
    fi
  fi
  info "Artifacts saved at: $ARTIFACTS_DIR"
  if [ -f "$ARTIFACTS_DIR/pi-session-files.txt" ]; then
    detail "  pi-session/   — pi session JSONL archive"
    detail "  pi-session-files.txt — session file inventory"
    detail "  pi-session-sha256.txt — session archive hashes"
  fi

  detail "  run.json       — run metadata"
  detail "  artifact/      — pack files (if created)"
  detail "  transcript     — pi agent output"
  detail "  container.log  — container logs"
  detail "  score.json     — evaluator report (if run)"
}

trap cleanup EXIT

# Ensure artifacts dir exists
mkdir -p "$ARTIFACT_DIR"

# ── Step 1: Build dev image ──────────────────────────────────────
step "Step 1: Build dev image"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping Docker build"
elif [ "$DO_BUILD" = true ]; then
  info "Building $IMAGE_TAG..."
  docker build --target dev -t "$IMAGE_TAG" "$PROJECT_ROOT" \
    || assert_fail "Docker build failed"
  assert_ok "Image built: $IMAGE_TAG"
else
  info "Skipping build (--no-build). Checking image..."
  docker image inspect "$IMAGE_TAG" >/dev/null 2>&1 \
    || assert_fail "Image $IMAGE_TAG not found. Run without --no-build first."
  assert_ok "Image exists: $IMAGE_TAG"
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
    || assert_fail "Failed to start container"
  assert_ok "Container started: $CONTAINER_NAME (port $HTTP_PORT)"
fi

# ── Step 3: Wait for readiness ───────────────────────────────────
step "Step 3: Wait for readiness"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping readiness check"
else
  ATTEMPT=0
  while [ $ATTEMPT -lt $TEST_TIMEOUT ]; do
    if curl -sf -o /dev/null "http://127.0.0.1:$HTTP_PORT/api/health" 2>/dev/null; then
      assert_ok "PocketBase ready (${ATTEMPT}s)"
      break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
  done
  if [ $ATTEMPT -ge $TEST_TIMEOUT ]; then
    assert_fail "Container did not become ready within ${TEST_TIMEOUT}s"
  fi

  # Also verify pi is installed
  docker exec "$CONTAINER_NAME" which pi >/dev/null 2>&1 \
    || assert_fail "pi not found in container"
  assert_ok "pi binary present"
fi

# ── Step 3.5: Override pi config for the CLIProxyAPI-backed model ──
step "Step 3.5: Configure pi agent for the CLIProxyAPI-backed model"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping pi config override"
else
  info "Configuring pi with model=$AGENT_MODEL baseUrl=$AGENT_BASE_URL"

  # Reuse pi's built-in "openrouter" provider metadata (contextWindow/maxTokens/
  # thinkingLevelMap etc.) and only override baseUrl + apiKey to point at the
  # local CLIProxyAPI. The model id is OpenRouter's own ":floor" variant, which
  # CLIProxyAPI now passes through unchanged. maxTokens is raised from pi's
  # 16384 default so long reasoning output is not truncated.
  docker exec "$CONTAINER_NAME" sh -c \
    "mkdir -p /root/.pi/agent && cat > /root/.pi/agent/models.json << 'EOF_MODEL'
{
  \"providers\": {
    \"openrouter\": {
      \"baseUrl\": \"$AGENT_BASE_URL\",
      \"apiKey\": \"$AGENT_API_KEY\",
      \"models\": [{
        \"id\": \"$AGENT_MODEL\",
        \"headers\": { \"User-Agent\": \"Pi (Vanblog)\" },
        \"maxTokens\": 65536
      }]
    }
  }
}
EOF_MODEL" || assert_fail "Failed to write models.json"
  assert_ok "models.json written with openrouter provider (baseUrl → CLIProxyAPI)"

  # Override /workspace/.pi/settings.json model/defaultModel.
  # Use environment variables inside the container to avoid host shell expansion
  # under `set -u`, and never expose the API key in this command.
  docker exec \
    -e AGENT_MODEL="$AGENT_MODEL" \
    "$CONTAINER_NAME" sh -c '
      SETTINGS=/workspace/.pi/settings.json
      TMP=$(mktemp)
      if [ -f "$SETTINGS" ]; then
        node - "$SETTINGS" "$TMP" "$AGENT_MODEL" <<'NODE'
const fs = require("node:fs");
const [source, target, model] = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(source, "utf8"));
settings.model = model;
settings.defaultModel = model;
fs.writeFileSync(target, JSON.stringify(settings, null, 2));
NODE
      else
        printf "{\"model\":%s,\"defaultModel\":%s}\n" \
          "$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$AGENT_MODEL")" \
          "$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$AGENT_MODEL")" > "$TMP"
      fi
      cat "$TMP" > "$SETTINGS"
      rm -f "$TMP"
      echo "settings.json configured"
    ' || assert_fail "Failed to update settings.json"
  assert_ok "settings.json model/defaultModel set to $AGENT_MODEL"

  info "Model config applied (api key never persisted to artifacts)"
fi

# ── Step 3.5b: Install pi-langfuse (optional, if LANGFUSE keys are set) ──
LANGFUSE_ENABLED=false
step "Step 3.5b: Configure pi-langfuse (optional)"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping pi-langfuse setup"
elif [ -n "${LANGFUSE_PUBLIC_KEY:-}" ] && [ -n "${LANGFUSE_SECRET_KEY:-}" ] && [ -n "${LANGFUSE_BASE_URL:-}" ]; then
  info "Installing pi-langfuse in container..."
  if docker exec "$CONTAINER_NAME" pi install npm:pi-langfuse 2>&1 | tail -1; then
    assert_ok "pi-langfuse installed"
    # Write config.json — keys are NOT persisted to run.json/artifacts, only in
    # the container's /root/.pi/agent/ which is destroyed with the container.
    docker exec "$CONTAINER_NAME" sh -c \
      "mkdir -p /root/.pi/agent/pi-langfuse && cat > /root/.pi/agent/pi-langfuse/config.json << 'EOF_LF'
{
  \"publicKey\": \"$LANGFUSE_PUBLIC_KEY\",
  \"secretKey\": \"$LANGFUSE_SECRET_KEY\",
  \"host\": \"$LANGFUSE_BASE_URL\",
  \"privacyPreset\": \"full-debug\"
}
EOF_LF" || assert_fail "Failed to write pi-langfuse config"
    assert_ok "pi-langfuse config written (host=$LANGFUSE_BASE_URL)"
    LANGFUSE_ENABLED=true
  else
    info "pi-langfuse install failed — continuing without tracing"
  fi
else
  info "LANGFUSE_PUBLIC_KEY/SECRET_KEY/BASE_URL not set — skipping pi-langfuse"
fi

# ── Step 3.6: Isolate test/evaluator code from agent workspace ──
# CRITICAL: Remove test implementation and evaluator from agent-visible paths
# so pi agent cannot read the expected solution or evaluation criteria.
# Only test-pi-pack.sh, evaluate-agent-pack.mjs, and any pow-guard challenge
# evaluator files are removed. Normal domain docs/skills are preserved.
ISOLATION_MANIFEST=""
step "Step 3.6: Isolate test/evaluator code from agent workspace"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping isolation"
else
  ISOLATION_REMOVED=""
  ISOLATION_MISSING=""

  # Files to remove from agent-visible workspace (only test infrastructure).
  for f in \
    scripts/test/test-pi-pack.sh \
    scripts/test/evaluate-agent-pack.mjs \
    scripts/runtime/init-pi-config.mjs \
    scripts/runtime/resolve-zen-free-models.mjs \
    scripts/runtime/pi-zen-proxy.mjs \
    scripts/lib/common.sh \
    scripts/lib/js/common.mjs \
    scripts/test/test-agent-rpc.sh \
    scripts/test/test-theme-switch.mjs \
    scripts/dev/dev-verify.sh \
    scripts/dev/dev-up.sh \
    scripts/ops/demo-setup.sh \
    scripts/test/install-test.sh \
    scripts/check/doc-dup-check.mjs \
    scripts/check/override-check.mjs \
    scripts/build/pack-schema-build.mjs \
    scripts/build/theme-init.mjs \
    .pi/settings.json \
    .agents/; do
    if docker exec "$CONTAINER_NAME" test -e "/workspace/$f" 2>/dev/null; then
      docker exec "$CONTAINER_NAME" rm -rf "/workspace/$f" 2>/dev/null && \
        ISOLATION_REMOVED="$ISOLATION_REMOVED $f"
    else
      ISOLATION_MISSING="$ISOLATION_MISSING $f"
    fi
  done

  # Also remove the init-pi-config call from entrypoint so it doesn't re-run
  docker exec "$CONTAINER_NAME" sh -c \
    "sed -i '/init-pi-config/d' /entrypoint.sh 2>/dev/null || true"

  # Also isolate /build/scripts/ — the dev image keeps a full copy of the test
  # scripts at /build/scripts (absolute path, NOT under /workspace). pi reads
  # this if not removed, leaking the expected solution + evaluator.
  for bf in \
    test/test-pi-pack.sh \
    test/evaluate-agent-pack.mjs \
    runtime/init-pi-config.mjs \
    runtime/resolve-zen-free-models.mjs \
    runtime/pi-zen-proxy.mjs \
    lib/common.sh \
    lib/js/common.mjs \
    test/test-agent-rpc.sh \
    test/test-theme-switch.mjs \
    dev/dev-verify.sh \
    dev/dev-up.sh \
    ops/demo-setup.sh \
    test/install-test.sh \
    check/doc-dup-check.mjs \
    check/override-check.mjs \
    build/pack-schema-build.mjs \
    build/theme-init.mjs; do
    if docker exec "$CONTAINER_NAME" test -e "/build/scripts/$bf" 2>/dev/null; then
      docker exec "$CONTAINER_NAME" rm -rf "/build/scripts/$bf" 2>/dev/null && \
        ISOLATION_REMOVED="$ISOLATION_REMOVED build/scripts/$bf"
    else
      ISOLATION_MISSING="$ISOLATION_MISSING build/scripts/$bf"
    fi
  done
  info "Isolation removed:${ISOLATION_REMOVED}"
  [ -n "$ISOLATION_MISSING" ] && info "Already absent:${ISOLATION_MISSING}"

  # Probe: verify critical paths are not readable
  ISOLATION_PROBE_PASSED=true
  ISOLATION_PROBE_DETAIL=""
  for probe_path in \
    scripts/test/test-pi-pack.sh \
    scripts/test/evaluate-agent-pack.mjs \
    scripts/runtime/init-pi-config.mjs \
    .pi/settings.json \
    .agents/skills; do
    if docker exec "$CONTAINER_NAME" test -e "/workspace/$probe_path" 2>/dev/null; then
      ISOLATION_PROBE_PASSED=false
      ISOLATION_PROBE_DETAIL="$ISOLATION_PROBE_DETAIL [STILL PRESENT] $probe_path"
      assert_fail "Isolation probe: $probe_path still present!"
    else
      ISOLATION_PROBE_DETAIL="$ISOLATION_PROBE_DETAIL [REMOVED] $probe_path"
    fi
  done
  # Also probe /build/scripts/test/test-pi-pack.sh (absolute path leak)
  if docker exec "$CONTAINER_NAME" test -e "/build/scripts/test/test-pi-pack.sh" 2>/dev/null; then
    ISOLATION_PROBE_PASSED=false
    ISOLATION_PROBE_DETAIL="$ISOLATION_PROBE_DETAIL [STILL PRESENT] build/scripts/test/test-pi-pack.sh"
    assert_fail "Isolation probe: build/scripts/test/test-pi-pack.sh still present!"
  else
    ISOLATION_PROBE_DETAIL="$ISOLATION_PROBE_DETAIL [REMOVED] build/scripts/test/test-pi-pack.sh"
  fi

  if [ "$ISOLATION_PROBE_PASSED" = true ]; then
    assert_ok "Isolation probe: all test/evaluator paths removed from agent workspace"
  else
    assert_fail "Isolation failed — some test paths remain accessible to agent"
  fi

  ISOLATION_MANIFEST="removed:${ISOLATION_REMOVED}"
  assert_ok "Isolation complete"
fi

# Re-apply model config after isolation. The dev entrypoint may finish its
# startup-time Zen initialization after health becomes ready.
if [ "$DRY_RUN" = false ]; then
  docker exec "$CONTAINER_NAME" sh -c \
    "mkdir -p /root/.pi/agent && cat > /root/.pi/agent/models.json << 'EOF_MODEL_FINAL'
{
  \"providers\": {
    \"openrouter\": {
      \"baseUrl\": \"$AGENT_BASE_URL\",
      \"apiKey\": \"$AGENT_API_KEY\",
      \"models\": [{
        \"id\": \"$AGENT_MODEL\",
        \"headers\": { \"User-Agent\": \"Pi (Vanblog)\" },
        \"maxTokens\": 65536
      }]
    }
  }
}
EOF_MODEL_FINAL" || assert_fail "Failed to re-apply final models.json"
  docker exec -e AGENT_MODEL="$AGENT_MODEL" "$CONTAINER_NAME" sh -c '
    SETTINGS=/workspace/.pi/settings.json
    TMP=$(mktemp)
    printf "{\"model\":%s,\"defaultModel\":%s}\n" \
      "$(node -e "console.log(JSON.stringify(process.argv[1]))" "$AGENT_MODEL")" \
      "$(node -e "console.log(JSON.stringify(process.argv[1]))" "$AGENT_MODEL")" > "$TMP"
    cat "$TMP" > "$SETTINGS"
    rm -f "$TMP"
  ' || assert_fail "Failed to re-apply final settings.json"
  docker exec "$CONTAINER_NAME" sh -c 'test -f /root/.pi/agent/models.json && grep -q '"'"'openrouter'"'"' /root/.pi/agent/models.json' \
    || assert_fail "Final pi model config probe failed"
  assert_ok "Final pi model config applied after isolation"
fi

# ── Step 4: Run pi agent to create pack in user-packs volume ─────
step "Step 4: Run pi agent to create pack"
PI_STATUS=0
PI_TIMED_OUT=false

if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping pi creation"
elif docker exec "$CONTAINER_NAME" test -f "$CONTAINER_USER_PACKS/pow-guard/pack.json" 2>/dev/null; then
  info "pow-guard already present in user-packs volume — skipping pi creation"
  echo "[SKIP] pow-guard already present — pi not run" > "$TRANSCRIPT_PATH"
else
  info "Giving pi the prompt (timeout=${AGENT_TIMEOUT}s)..."
  info "Prompt: $(echo "$PI_PROMPT" | head -1)..."

  # Run pi in background with external timeout enforcement.
  # Pass AGENT_TIMEOUT env so pi (if it honors it) can self-limit.
  # Explicit --provider openrouter (pi's built-in provider, baseUrl overridden to
  # CLIProxyAPI) + bare --model id. The model id carries a "deepseek/" namespace
  # that is part of the OpenRouter model id, so --provider must be given to stop
  # pi from misreading "deepseek" as a provider. External timeout via docker exec.
  docker exec -i -w /workspace \
    "$CONTAINER_NAME" \
    env AGENT_TIMEOUT="$AGENT_TIMEOUT" \
    pi -p "$PI_PROMPT" --provider openrouter --model "$PI_MODEL_SELECTOR" --session-dir "$CONTAINER_SESSION_DIR" --approve \
    --tools "read,edit,write,bash,grep,find,ls" \
    >"$TRANSCRIPT_PATH" 2>&1 &
  PI_PID=$!

  # Poll for completion up to deadline
  DEADLINE=$(( $(date +%s) + AGENT_TIMEOUT ))
  while kill -0 "$PI_PID" 2>/dev/null && [ "$(date +%s)" -lt "$DEADLINE" ]; do
    sleep 2
  done

  if kill -0 "$PI_PID" 2>/dev/null; then
    info "pi timed out after ${AGENT_TIMEOUT}s"
    # Kill the docker exec client on host
    kill "$PI_PID" 2>/dev/null || true
    # Kill pi inside container (targeted — only the pi -p process)
    docker exec "$CONTAINER_NAME" pkill -f "pi -p" 2>/dev/null || true
    wait "$PI_PID" 2>/dev/null || true
    PI_STATUS=124
    PI_TIMED_OUT=true
    echo "[TIMED OUT after ${AGENT_TIMEOUT}s]" >> "$TRANSCRIPT_PATH"
  else
    if wait "$PI_PID" 2>/dev/null; then
      PI_STATUS=0
    else
      PI_STATUS=$?
    fi
    if [ $PI_STATUS -ne 0 ]; then
      info "pi exited with status $PI_STATUS (see transcript for details)"
    else
      assert_ok "pi completed successfully"
    fi
  fi
fi

# ── Step 5: Archive artifacts ────────────────────────────────────
step "Step 5: Archive artifacts"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping archive"
else
  # Capture container logs
  docker logs "$CONTAINER_NAME" > "$CONTAINER_LOG_PATH" 2>&1
  assert_ok "Container log saved: $CONTAINER_LOG_PATH"

  # Archive pi session history before the container is removed.
  mkdir -p "$PI_SESSION_ARCHIVE"
  if docker exec "$CONTAINER_NAME" test -d "$CONTAINER_SESSION_DIR" 2>/dev/null; then
    docker cp "$CONTAINER_NAME:$CONTAINER_SESSION_DIR/." "$PI_SESSION_ARCHIVE/" 2>/dev/null || true
    find "$PI_SESSION_ARCHIVE" -type f -print | sort > "$ARTIFACTS_DIR/pi-session-files.txt" || true
    find "$PI_SESSION_ARCHIVE" -type f -exec shasum -a 256 {} \; > "$ARTIFACTS_DIR/pi-session-sha256.txt" || true
    assert_ok "Pi session archived: $PI_SESSION_ARCHIVE"

    # Metrics are now computed client-side by the lab frontend from raw session JSONL.
    # See lab/src/App.tsx — computeSessionMetrics().
  else
    info "Pi session directory absent — no metrics to extract"
  fi

  # Copy pack artifacts from user-packs volume
  if docker exec "$CONTAINER_NAME" test -d "$CONTAINER_USER_PACKS" 2>/dev/null; then
    docker cp "$CONTAINER_NAME:$CONTAINER_USER_PACKS/." "$ARTIFACT_DIR/" 2>/dev/null || true
    assert_ok "Pack files copied to $ARTIFACT_DIR"
  else
    info "No user-packs volume found — artifact dir may be empty"
  fi

  # Write run.json metadata
  pi_exit_reason="completed"
  $PI_TIMED_OUT && pi_exit_reason="timed_out" || true
  if [ $PI_STATUS -ne 0 ] && [ "$PI_TIMED_OUT" = false ]; then
    pi_exit_reason="failed"
  fi

  python3 -c "
import json, os
meta = {
    'schemaVersion': 1,
    'runId': '$RUN_ID',
    'generatedAt': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'image': '$IMAGE_TAG',
    'containerName': '$CONTAINER_NAME',
    'httpPort': $HTTP_PORT,
    'agentTimeout': $AGENT_TIMEOUT,
    'agentModel': '$AGENT_MODEL',
    'agentBaseUrl': '$AGENT_BASE_URL',
    'piStatus': $PI_STATUS,
    'piTimedOut': '$PI_TIMED_OUT' == 'true',
    'piExitReason': '$pi_exit_reason',
    'isolation': {
        'manifest': '$ISOLATION_MANIFEST',
        'probePassed': '$ISOLATION_PROBE_PASSED' == 'true'
    },
    'args': {
        'build': '$DO_BUILD' == 'true',
        'cleanup': '$DO_CLEANUP' == 'true',
        'keepEvidence': '$KEEP_EVIDENCE' == 'true',
        'skipEval': '$SKIP_EVAL' == 'true',
        'dryRun': '$DRY_RUN' == 'true'
    },
    'artifactDir': '$ARTIFACT_DIR',
    'transcriptPath': '$TRANSCRIPT_PATH',
    'containerLogPath': '$CONTAINER_LOG_PATH',
    'piSessionDir': '$CONTAINER_SESSION_DIR',
    'piSessionArchive': '$PI_SESSION_ARCHIVE',
    'piSessionFilesManifest': '$ARTIFACTS_DIR/pi-session-files.txt',
    'piSessionSha256': '$ARTIFACTS_DIR/pi-session-sha256.txt',
    'langfuse': {
        'enabled': '$LANGFUSE_ENABLED' == 'true',
        'host': '${LANGFUSE_BASE_URL:-}'
    }
}
with open('$RUN_JSON_PATH', 'w') as f:
    json.dump(meta, f, indent=2)
print('run.json written')
" || info "run.json write failed (non-fatal)"
  assert_ok "Run metadata saved: $RUN_JSON_PATH"
fi

# ── Step 6: Run evaluator ────────────────────────────────────────
step "Step 6: Run evaluator"
if [ "$DRY_RUN" = true ]; then
  info "DRY RUN — skipping evaluator"
elif [ "$SKIP_EVAL" = true ]; then
  info "Skipping evaluator (--skip-eval)"
else
  EVAL_PORT="${EVAL_PORT:-$((HTTP_PORT + 1))}"
  info "Invoking evaluator (port $EVAL_PORT)..."
  info "  --artifact-dir $ARTIFACT_DIR"
  info "  --image $IMAGE_TAG"
  info "  --report-dir $ARTIFACTS_DIR"

  if node "$SCRIPT_DIR/evaluate-agent-pack.mjs" \
    --artifact-dir "$ARTIFACT_DIR" \
    --image "$IMAGE_TAG" \
    --port "$EVAL_PORT" \
    --report-dir "$ARTIFACTS_DIR" \
    --timeout "$AGENT_TIMEOUT" \
    --verbose 2>&1; then
    assert_ok "Evaluator completed"
  else
    info "Evaluator exited with non-zero (see score.json for details)"
  fi

  if [ -f "$SCORE_JSON_PATH" ]; then
    # SCORE_STATUS
    SCORE_STATUS="$(python3 -c "import json; print(json.load(open('$SCORE_JSON_PATH'))['status'])" 2>/dev/null || echo "unknown")"
    info "Evaluator status: $SCORE_STATUS"
    assert_ok "Score saved: $SCORE_JSON_PATH"
  else
    info "No score.json produced by evaluator"
  fi
fi

# ── Step 7: Report ───────────────────────────────────────────────
step "Step 7: Summary"
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}TEST COMPLETE${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
info "Run ID:    $RUN_ID"
info "Artifacts: $ARTIFACTS_DIR"
info "  run.json:       $(wc -c < "$RUN_JSON_PATH" 2>/dev/null || echo 0) bytes"
info "  artifact/:      $(find "$ARTIFACT_DIR" -type f 2>/dev/null | wc -l) files"
info "  transcript:     $(wc -c < "$TRANSCRIPT_PATH" 2>/dev/null || echo 0) bytes"
info "  container.log:  $(wc -c < "$CONTAINER_LOG_PATH" 2>/dev/null || echo 0) bytes"
info "  score.json:     $(wc -c < "$SCORE_JSON_PATH" 2>/dev/null || echo "N/A")"
if [ "$LANGFUSE_ENABLED" = true ]; then
  info "  langfuse:       ${LANGFUSE_BASE_URL}/sessions"
fi
echo ""

# Print evaluator summary if available
if [ -f "$SCORE_JSON_PATH" ]; then
  python3 -c "
import json
d = json.load(open('$SCORE_JSON_PATH'))
s = d.get('score', {})
print(f'  Score: {s.get(\"passed\",0)}/{s.get(\"total\",0)} passed ({s.get(\"pct\",0)}%)')
print(f'  Status: {d.get(\"status\",\"unknown\")}')
static = d.get('static', {})
if static.get('passed'):
    print(f'  Static passed: {\", \".join(static[\"passed\"])}')
if static.get('failed'):
    info = '  Static failed: ' + ', '.join(static['failed'])
    print(f'  {YELLOW}{info}{NC}')
runtime = d.get('runtime', {})
if runtime.get('passed'):
    print(f'  Runtime passed: {\", \".join(runtime[\"passed\"])}')
if runtime.get('failed'):
    info = '  Runtime failed: ' + ', '.join(runtime['failed'])
    print(f'  {RED}{info}{NC}')
  " 2>/dev/null || true
fi

echo ""