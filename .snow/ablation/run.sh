#!/usr/bin/env bash
# 消融实验运行器 — 对照组(无记忆)vs 实验组(注入记忆)
# 用法: bash .snow/ablation/run.sh <control|memory> [轮数]
export PROJECT_ROOT="$(pwd)"

GROUP="${1:-control}"
N="${2:-3}"

if [ "$GROUP" = "control" ]; then
  MEM_ARG=""
  PREFIX="ablation-control"
  echo "=== 对照组:无记忆 ==="
elif [ "$GROUP" = "memory" ]; then
  MEM_ARG="--memory-dir .snow/ablation/memory-pack"
  PREFIX="ablation-memory"
  echo "=== 实验组:注入 memory-pack ==="
else
  echo "未知组: $GROUP (control|memory)"; exit 1
fi

for i in $(seq 1 "$N"); do
  RUN_ID="${PREFIX}-${i}"
  echo ""
  echo "════════ $GROUP 轮次 $i/$N → $RUN_ID ════════"
  ./scripts/test/test-pi-pack.sh --no-build --cleanup \
    --run-id "$RUN_ID" $MEM_ARG
  echo "得分: $(jq -r '.score.passed + "/" + .score.total + " (" + .score.pct + "%) " + .summary' .snow/artifacts/$RUN_ID/score.json 2>/dev/null || echo 'N/A')"
  sleep 20   # 控制模型限流
done
