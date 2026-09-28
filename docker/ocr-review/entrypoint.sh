#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/workspace}"
REFS_DIR="${REFS_DIR:-/workspace/refs}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

cd "$REPO_DIR"
mkdir -p "$REFS_DIR"

# ── Step 1: Record current HEAD & pull latest ────────────────────
PREV_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")

echo "[ocr-review] $(date -u +%H:%M:%S) Pulling $GIT_REMOTE/$GIT_BRANCH..."
git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH" 2>&1 || {
    echo "[ocr-review] $(date -u +%H:%M:%S) ⚠️  git pull failed (conflict? network?), using local HEAD"
}

CURR_HEAD=$(git rev-parse HEAD)

# ── Step 2: Determine baseline ───────────────────────────────────
# PREV_HEAD 不落盘,「pull 无新提交」意味着本窗口没有可review的增量——
# 旧实现的 HEAD~10 fallback 会在安静期每 6h 重review同一批旧提交(实测一轮
# 白烧 31 万 token),改为直接跳过。HEAD~10 仅作冷启动兜底(PREV_HEAD 为空)。
if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$CURR_HEAD" ]; then
    BASELINE="$PREV_HEAD"
    echo "[ocr-review] $(date -u +%H:%M:%S) Reviewing $PREV_HEAD → $CURR_HEAD"
elif [ -z "$PREV_HEAD" ]; then
    BASELINE="${BASELINE_FALLBACK:-HEAD~10}"
    echo "[ocr-review] $(date -u +%H:%M:%S) Cold start, using fallback: $BASELINE"
else
    echo "[ocr-review] $(date -u +%H:%M:%S) No new commits since last run, nothing to review."
    exit 0
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

# ── Step 4: Quota probe ─────────────────────────────────────────
# 商汤 TokenPlan 无配额查询端点(usage/account 等 4 端点均 404),只能探测:
# 1-token 请求连中 2 次 HTTP 200 才开跑;否则视为池子打干,跳过本轮等下个窗口。
# 探测 200 即可——推理模型 max_tokens=1 时 finish_reason=length 属正常。
PROBE_OK=$(python3 - <<'PYEOF'
import json, os, urllib.request
cfg = json.load(open(os.path.expanduser('~/.opencodereview/config.json')))
name = cfg.get('provider')
p = (cfg.get('custom_providers') or {}).get(name) or {}
url = p.get('url', '').rstrip('/') + '/chat/completions'
req_body = json.dumps({'model': p.get('model'), 'messages': [{'role': 'user', 'content': 'hi'}], 'max_tokens': 1}).encode()
ok = 0
for _ in range(2):
    try:
        req = urllib.request.Request(url, data=req_body, headers={'Authorization': 'Bearer ' + p.get('api_key', ''), 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            if r.status == 200:
                ok += 1
    except Exception:
        pass
print('yes' if ok >= 2 else 'no')
PYEOF
) || PROBE_OK=no
if [ "$PROBE_OK" != "yes" ]; then
    echo "[ocr-review] $(date -u +%H:%M:%S) ⏭ quota probe failed (pool exhausted?), skipping this run"
    exit 0
fi
echo "[ocr-review] $(date -u +%H:%M:%S) quota probe OK"

# ── Step 5: Run review ───────────────────────────────────────────
TIMESTAMP=$(date -u +%Y%m%d-%H%M)
OUTPUT_FILE="$REFS_DIR/review-${TIMESTAMP}.json"

OCR_STDERR=$(mktemp)
set +e
ocr review \
    --from "$BASELINE" \
    --to HEAD \
    --format json \
    --audience agent \
    --concurrency 1 \
    --timeout 60 \
    > "$OUTPUT_FILE" 2>"$OCR_STDERR"
OCR_EXIT=$?
set -e

cat "$OCR_STDERR" >> "$REFS_DIR/review-debug.log" 2>/dev/null || true
rm -f "$OCR_STDERR"

if [ $OCR_EXIT -ne 0 ]; then
    echo "[ocr-review] ocr exited with code $OCR_EXIT"
fi

# ── Step 6: Summary ─────────────────────────────────────────────
if [ ! -s "$OUTPUT_FILE" ]; then
    echo "[ocr-review] $(date -u +%H:%M:%S) ❌ Failed (no output)"
    exit 1
fi

# 真实判定: ocr 退出码非 0 或 status=failed 都算失败,不因 summary 字段缺省而误报成功
STATUS=$(python3 -c "import json; d=json.load(open('$OUTPUT_FILE')); print(d.get('status','unknown'))" 2>/dev/null || echo unknown)
SUMMARY_LINE=$(python3 -c "
import json
d = json.load(open('$OUTPUT_FILE'))
s = d.get('summary', {})
tt = s.get('total_tokens')
tt_str = f'{tt:,}' if isinstance(tt, (int, float)) else str(tt or '?')
print(f\"{s.get('comments','?')} issues, {tt_str} tokens in {s.get('elapsed','?')}\")
" 2>/dev/null || echo "summary unavailable")

if [ "$OCR_EXIT" -eq 0 ] && [ "$STATUS" != "failed" ]; then
    echo "[ocr-review] $(date -u +%H:%M:%S) ✅ $SUMMARY_LINE → $OUTPUT_FILE"
else
    echo "[ocr-review] $(date -u +%H:%M:%S) ❌ review failed (ocr_exit=$OCR_EXIT, status=$STATUS): $SUMMARY_LINE → $OUTPUT_FILE"
    exit 1
fi
