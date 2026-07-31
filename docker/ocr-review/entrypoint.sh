#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/workspace}"
REFS_DIR="${REFS_DIR:-/workspace/refs}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$REPO_DIR"
mkdir -p "$REFS_DIR"

# ── Step 1: Record current HEAD & pull latest ────────────────────
PREV_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")

echo "[ocr-review] $(date -u +%H:%M:%S) Pulling $GIT_REMOTE/$GIT_BRANCH..."
git pull -- "$GIT_REMOTE" "$GIT_BRANCH" --ff-only 2>&1 || {
    echo "[ocr-review] $(date -u +%H:%M:%S) ⚠️  git pull failed (conflict? network?), using local HEAD"
}

CURR_HEAD=$(git rev-parse HEAD)

# ── Step 2: Determine baseline ───────────────────────────────────
if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$CURR_HEAD" ]; then
    BASELINE="$PREV_HEAD"
    echo "[ocr-review] $(date -u +%H:%M:%S) Reviewing $PREV_HEAD → $CURR_HEAD"
else
    BASELINE="${BASELINE_FALLBACK:-HEAD~10}"
    echo "[ocr-review] $(date -u +%H:%M:%S) No new commits pulled, using fallback: $BASELINE"
fi

# ── Step 3: Check for source changes ─────────────────────────────
CHANGES=$(git diff --name-only "$BASELINE"..HEAD 2>/dev/null | \
    grep -v '^\.snow/' | grep -v '^refs/' | grep -v 'node_modules/' | \
    grep -v '\.md$' | wc -l | tr -d ' ') || true

if [ "${CHANGES:-0}" -eq 0 ]; then
    echo "[ocr-review] $(date -u +%H:%M:%S) No source changes, skipping."
    exit 0
fi
echo "[ocr-review] $(date -u +%H:%M:%S) $CHANGES changed files"

# ── Step 4: Run review ───────────────────────────────────────────
TIMESTAMP=$(date -u +%Y%m%d-%H%M)
OUTPUT_FILE="$REFS_DIR/review-${TIMESTAMP}.json"

OCR_STDERR=$(mktemp)
set +e
ocr review \
    --from "$BASELINE" \
    --to HEAD \
    --format json \
    --audience agent \
    --concurrency 4 \
    --timeout 15 \
    > "$OUTPUT_FILE" 2>"$OCR_STDERR"
OCR_EXIT=$?
set -e

cat "$OCR_STDERR" >> "$REFS_DIR/review-debug.log" 2>/dev/null || true
rm -f "$OCR_STDERR"

if [ $OCR_EXIT -ne 0 ]; then
    echo "[ocr-review] ocr exited with code $OCR_EXIT"
fi

# ── Step 5: Summary ──────────────────────────────────────────────
if [ -f "$OUTPUT_FILE" ]; then
    python3 -c "
import json
with open('$OUTPUT_FILE') as f:
    d = json.load(f)
s = d.get('summary', {})
tt = s.get('total_tokens')
tt_str = f'{tt:,}' if isinstance(tt, (int, float)) else str(tt or '?')
print(f\"[ocr-review] $(date -u +%H:%M:%S) ✅ {s.get('comments','?')} issues, {tt_str} tokens in {s.get('elapsed','?')}\")
" 2>/dev/null || echo "[ocr-review] $(date -u +%H:%M:%S) ✅ Done → $OUTPUT_FILE"
else
    echo "[ocr-review] $(date -u +%H:%M:%S) ❌ Failed"
    exit 1
fi
