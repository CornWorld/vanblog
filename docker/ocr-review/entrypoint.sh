#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/workspace}"
REFS_DIR="${REFS_DIR:-/workspace/refs}"
RESUME_FILE="$REFS_DIR/ocr-resume-session.txt"
STATE_FILE="$REFS_DIR/ocr-last-head.txt"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

cd "$REPO_DIR"
mkdir -p "$REFS_DIR"

# ── Step 1: Load last-reviewed HEAD & pull latest ────────────────
# 增量基线读落盘的 STATE_FILE,不读运行时 HEAD——工作区就是开发用的同一份
# clone,提交发生在两次运行之间时 pull 永远 no-op,读运行时 HEAD 会把本地
# 提交全部漏掉(9-28 失败轮后一整周代码零审查即此因)。
LAST_HEAD=$(cat "$STATE_FILE" 2>/dev/null || echo "")
# history rewrite 后旧 SHA 可能悬空:diff 失败会被当「无源码变更」静默跳过,
# 校验失效即降级冷启动。
if [ -n "$LAST_HEAD" ] && ! git rev-parse --verify -q "$LAST_HEAD^{commit}" >/dev/null 2>&1; then
    echo "[ocr-review] stale state ($LAST_HEAD unreachable), falling back to cold start"
    LAST_HEAD=""
fi

echo "[ocr-review] $(date -u +%H:%M:%S) Pulling $GIT_REMOTE/$GIT_BRANCH..."
git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH" 2>&1 || {
    echo "[ocr-review] $(date -u +%H:%M:%S) ⚠️  git pull failed (conflict? network?), using local HEAD"
}

CURR_HEAD=$(git rev-parse HEAD)

# 原子推进 STATE_FILE:tmp + rename。直接 `echo >` 在半写/被 kill 时留下
# 截断 SHA,守卫会把它降级成冷启动扩窗;rename 保证读端只见旧值或新值。
# (launchd 同一 job 不并发起两份,kickstart 也串行,无需加锁。)
advance_state() {
    local tmp
    tmp=$(mktemp "$REFS_DIR/.ocr-last-head.XXXXXX")
    printf '%s\n' "$1" > "$tmp"
    mv -f "$tmp" "$STATE_FILE"
}

# ── Step 2: Determine baseline ───────────────────────────────────
# STATE_FILE 只在 review 实际跑过之后推进(见 Step 6),「无增量」即跳过——
# 否则安静期每 6h 重烧同一批旧提交(实测一轮 31 万 token)。
# HEAD~10 仅作冷启动兜底(STATE_FILE 不存在)。
RESUME_ID=""
if [ -n "$LAST_HEAD" ] && [ "$LAST_HEAD" != "$CURR_HEAD" ]; then
    BASELINE="$LAST_HEAD"
    rm -f "$RESUME_FILE"   # 新增量到来,旧的失败 session 已过期
    echo "[ocr-review] $(date -u +%H:%M:%S) Reviewing $LAST_HEAD → $CURR_HEAD"
elif [ -z "$LAST_HEAD" ]; then
    BASELINE="${BASELINE_FALLBACK:-HEAD~10}"
    echo "[ocr-review] $(date -u +%H:%M:%S) Cold start, using fallback: $BASELINE"
elif [ -s "$RESUME_FILE" ]; then
    # 429 规则不公布、事前不可预知(无余量查询 API):中途打干是常态而非异常。
    # 上轮失败的 session 落盘于此,本窗口窗口恢复后 --resume 续跑剩余文件,
    # 已 review 的不重烧。
    IFS=$'\t' read -r BASELINE RESUME_ID < "$RESUME_FILE"
    echo "[ocr-review] $(date -u +%H:%M:%S) No new commits; resuming unfinished session $RESUME_ID (baseline $BASELINE)"
else
    echo "[ocr-review] $(date -u +%H:%M:%S) No new commits since last run, nothing to review."
    exit 0
fi

# ── Step 3: Check for source changes ─────────────────────────────
CHANGES=$(git diff --name-only "$BASELINE"..HEAD 2>/dev/null | \
    grep -v '^\.snow/' | grep -v '^refs/' | grep -v 'node_modules/' | \
    grep -v '^bench/results/' | grep -v '^bench/corpus' | \
    grep -v '\.md$' | wc -l | tr -d ' ') || true

if [ "${CHANGES:-0}" -eq 0 ]; then
    echo "[ocr-review] $(date -u +%H:%M:%S) No source changes, skipping."
    advance_state "$CURR_HEAD"   # 增量已判定为空,推进避免每轮重复判定
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
OCR_ARGS=(review --from "$BASELINE" --to HEAD --format json --audience agent --concurrency 1 --timeout 60)
if [ -n "$RESUME_ID" ]; then
    OCR_ARGS+=(--resume "$RESUME_ID")
fi
set +e
ocr "${OCR_ARGS[@]}" \
    > "$OUTPUT_FILE" 2>"$OCR_STDERR"
OCR_EXIT=$?
set -e

cat "$OCR_STDERR" >> "$REFS_DIR/review-debug.log" 2>/dev/null || true
rm -f "$OCR_STDERR"

if [ $OCR_EXIT -ne 0 ]; then
    echo "[ocr-review] ocr exited with code $OCR_EXIT"
fi

# ── Step 6: Summary ─────────────────────────────────────────────
# 注意: quota probe 提前退出 / 无输出失败 / 中途被 kill 都不写 STATE_FILE,
# 下轮会把同一段增量整段重试——重烧可接受,静默漏审不可接受。
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
    rm -f "$RESUME_FILE"
    advance_state "$CURR_HEAD"
    echo "[ocr-review] $(date -u +%H:%M:%S) ✅ $SUMMARY_LINE → $OUTPUT_FILE"
else
    echo "[ocr-review] $(date -u +%H:%M:%S) ❌ review failed (ocr_exit=$OCR_EXIT, status=$STATUS): $SUMMARY_LINE → $OUTPUT_FILE"
    FAILED_SID=$(python3 -c "import json; print(json.load(open('$OUTPUT_FILE')).get('session_id') or '')" 2>/dev/null || true)
    if [ -n "$FAILED_SID" ]; then
        printf '%s\t%s\n' "$BASELINE" "$FAILED_SID" > "$RESUME_FILE"
        advance_state "$CURR_HEAD"   # 增量已消费,续跑兜底在 RESUME_FILE
        echo "[ocr-review] saved session for resume next window: $FAILED_SID"
    fi
    # 无 session_id 的失败不推进 STATE_FILE → 下轮整段重试,宁可重烧不漏审
    exit 1
fi
