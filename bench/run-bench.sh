#!/usr/bin/env bash
# run-bench.sh — benchmark 矩阵驱动
#
# 控制变量：
#   MEM:    服务端容器内存限制（512m / 1g / 2g / 4g）
#   POSTS:  种子文章数（0 / 50 / 500）
#   QPS:    目标 QPS
#   DUR:    每轮时长（秒）
#   REPEAT: 每配置重复次数（取中位数）
#   RW:     写占比 %
#
# 结构：
#   服务端容器：--memory=$MEM，与 bench volume 隔离
#   客户端容器：独立（无内存限制），host network 直连服务端 127.0.0.1:8090
#     —— 用 --network container:<server> 共享 netns，但 cgroup 独立
#
# 用法: ./run-bench.sh [mem_list] [posts_list]
#   ./run-bench.sh                    # 默认 1g,2g × 0,500
#   ./run-bench.sh "512m 1g 2g 4g" "0 500"

set -euo pipefail
cd "$(dirname "$0")"

IMAGE="${BENCH_IMAGE:-vanblog:bench-prod}"
# 绝对路径（docker -v 需要绝对路径）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VEGETA="${BENCH_VEGETA:-$SCRIPT_DIR/bin/vegeta-linux-arm64}"
MEM_LIST=${1:-"1g 2g"}
POSTS_LIST=${2:-"0 500"}
QPS=${BENCH_QPS:-1000}
DUR=${BENCH_DUR:-120}
REPEAT=${BENCH_REPEAT:-3}
RW=${BENCH_RW:-0}
VOL="vanblog-bench-pbdata"

SERVER=vanblog-bench-server
CLIENT=vanblog-bench-client
RESULTS_DIR="results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

log() { echo "[matrix] $*"; }

# ---------------------------------------------------------------------------
# 服务端生命周期
# ---------------------------------------------------------------------------

server_up() {
  local mem=$1
  docker rm -f $SERVER 2>/dev/null || true
  # 使用预构建镜像 vanblog:bench-prod（含 GOMEMLIMIT 推导 entrypoint + hooksPool + pprof）
  # 不再 docker cp —— entrypoint 修复已烧进镜像层
  docker run -d --name $SERVER \
    --memory="$mem" --memory-swap="$mem" \
    -v "$VOL":/pb_data \
    "$IMAGE" >/dev/null
  for i in $(seq 1 60); do
    if docker exec $SERVER wget -q -O /dev/null -T 1 http://127.0.0.1:8090/api/health 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  log "ERROR: server failed to become healthy"
  return 1
}

server_down() {
  docker rm -f $SERVER 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 初始化（建 admin + seed）
# ---------------------------------------------------------------------------

init_admin() {
  local status
  status=$(docker exec $SERVER node -e '
    fetch("http://127.0.0.1:8090/api/vanblog/setup/status").then(r=>r.json()).then(d=>console.log(d.bootstrap)).catch(()=>console.log("true"))
  ' 2>/dev/null | tail -1)
  if [ "$status" = "true" ]; then
    docker exec $SERVER node -e '
      fetch("http://127.0.0.1:8090/api/vanblog/setup/complete", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username:"bench",email:"bench@test.local",password:"bench12345678",passwordConfirm:"bench12345678"})
      }).then(r=>r.json()).then(d=>console.log(JSON.stringify(d))).catch(e=>console.error(e))
    ' >/dev/null 2>&1
    log "admin created"
  fi
}

get_token() {
  docker cp seed.mjs $SERVER:/tmp/seed.mjs >/dev/null
  # returns "SUPERTOKEN ADMINTOKEN"
  docker exec $SERVER node -e '
    (async()=>{
      const [su, au] = await Promise.all([
        fetch("http://127.0.0.1:8090/api/collections/_superusers/auth-with-password", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({identity:"bench@test.local", password:"bench12345678"})
        }).then(r=>r.json()),
        fetch("http://127.0.0.1:8090/api/collections/users/auth-with-password", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({identity:"bench", password:"bench12345678"})
        }).then(r=>r.json())
      ]);
      if(!su.token || !au.token){ console.error("AUTH FAIL"); process.exit(1); }
      console.log(su.token + " " + au.token);
    })();
  ' 2>/dev/null | tail -1
}

seed_posts() {
  local count=$1 tokens=$2
  # tokens = "SUPERTOKEN ADMINTOKEN"
  local st at
  st=$(echo "$tokens" | awk '{print $1}')
  at=$(echo "$tokens" | awk '{print $2}')
  docker cp corpus.jsonl $SERVER:/tmp/corpus.jsonl >/dev/null
  if [ "$count" = "0" ]; then
    docker exec $SERVER node /tmp/seed.mjs http://127.0.0.1:8090 "$st" "$at" 0 /tmp/corpus.jsonl 2>/dev/null | tail -2
  else
    docker exec $SERVER node /tmp/seed.mjs http://127.0.0.1:8090 "$st" "$at" "$count" /tmp/corpus.jsonl 2>/dev/null | tail -2
  fi
}

# ---------------------------------------------------------------------------
# 跑一轮
# ---------------------------------------------------------------------------

run_round() {
  local mem=$1 posts=$2 rep=$3 token=$4
  local out="$RESULTS_DIR/mem_${mem}_posts_${posts}_run${rep}.json"
  # docker -v 需要绝对路径
  local ABS_RESULTS="$SCRIPT_DIR/results/$(basename "$RESULTS_DIR")"

  # 生成 targets（走 Caddy :8080 真实链路；token 用于授权）
  cat > "$RESULTS_DIR/targets.txt" <<EOF
GET http://127.0.0.1:8080/api/vanblog/timeline?limit=20
GET http://127.0.0.1:8080/api/vanblog/timeline?limit=50
GET http://127.0.0.1:8080/api/feed.xml
GET http://127.0.0.1:8080/api/vanblog/search?q=performance
GET http://127.0.0.1:8080/api/sitemap.xml
GET http://127.0.0.1:8080/api/vanblog/timeline?limit=20
GET http://127.0.0.1:8080/api/vanblog/timeline?limit=50
GET http://127.0.0.1:8080/api/feed.xml
GET http://127.0.0.1:8080/api/vanblog/timeline?limit=50
EOF

  # vegeta 独立容器：共享 server netns（连 Caddy :8080）+ 独立 cgroup
  docker rm -f $CLIENT 2>/dev/null || true
  docker run -d --name $CLIENT \
    --network container:$SERVER \
    -v "$VEGETA":/veg:ro \
    -v "$ABS_RESULTS/targets.txt":/targets.txt:ro \
    -v "$ABS_RESULTS":/out \
    --entrypoint sh \
    "$IMAGE" -c "/veg attack -targets /targets.txt -rate $QPS -duration ${DUR}s -header 'Authorization: Bearer $token' -timeout 10s -output /out/r.bin && /veg report -type json /out/r.bin" \
    2>"$ABS_RESULTS/client_err.txt" || { log "  client failed to start: $(cat $ABS_RESULTS/client_err.txt | tail -2)"; return 1; }

  # 等待客户端完成
  local waited=0
  while [ $waited -lt $((DUR + 60)) ]; do
    state=$(docker inspect -f '{{.State.Status}}' $CLIENT 2>/dev/null || echo "gone")
    [ "$state" != "running" ] && break
    sleep 5
    waited=$((waited + 5))
  done
  docker logs $CLIENT 2>/dev/null > "$RESULTS_DIR"/run_log.txt
  docker rm -f $CLIENT >/dev/null 2>&1 || true

  # 解析: 从 run_log.txt (vegeta report JSON 已在 stdout) 提取关键指标
  python3 - "$out" "$RESULTS_DIR"/run_log.txt "$mem" "$posts" "$rep" <<'PYEOF'
import json, sys, subprocess, os
out_path, log_path, mem, posts, rep = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
if not os.path.exists(log_path):
    json.dump({"failed": True, "reason": "no_log"}, open(out_path,"w"))
    print("    run: FAILED (no run_log)")
    sys.exit(0)
try:
    rj = json.load(open(log_path))
except Exception as e:
    json.dump({"failed": True, "reason": f"bad_log: {e}"}, open(out_path,"w"))
    print(f"    run: FAILED (bad log: {e})")
    sys.exit(0)
oom = subprocess.run(["docker","inspect","-f","{{.State.OOMKilled}}","vanblog-bench-server"],capture_output=True,text=True).stdout.strip()
lat = rj.get("latencies", {}) or {}
result = {
    "mem": mem, "posts": int(posts), "run": int(rep),
    "target_qps": rj.get("rate", 0), "actual_qps": rj.get("rate", 0),
    "duration_s": rj.get("duration", 0)/1e9,
    "sent": rj.get("requests", 0), "success_rate": rj.get("success", 0),
    "bytes_transferred": (rj.get("bytes_in") or {}).get("total", 0),
    "latency_ms": {"mean": lat.get("mean",0)/1e6, "p50": lat.get("50th",0)/1e6, "p90": lat.get("90th",0)/1e6, "p95": lat.get("95th",0)/1e6, "p99": lat.get("99th",0)/1e6, "max": lat.get("max",0)/1e6},
    "server_oom_killed": oom == "true",
}
json.dump(result, open(out_path,"w"), indent=2)
p99 = lat.get("99th", 0)/1e6
print(f"    run: {result['actual_qps']:.0f}qps success={result['success_rate']*100:.1f}% p99={p99:.1f}ms oom={result['server_oom_killed']}")
PYEOF

  # 检查服务端是否还活着
  if ! docker exec $SERVER wget -q -O /dev/null -T 2 http://127.0.0.1:8090/api/health 2>/dev/null; then
    log "  SERVER DIED during run (mem=$mem posts=$posts)"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# 主循环
# ---------------------------------------------------------------------------

log "matrix: MEM=[$MEM_LIST] POSTS=[$POSTS_LIST] QPS=$QPS DUR=${DUR}s REPEAT=$REPEAT RW=${RW}%"
log "results → $RESULTS_DIR"

# 准备干净的 volume
docker volume rm -f $VOL >/dev/null 2>&1 || true
docker volume create $VOL >/dev/null

for mem in $MEM_LIST; do
  for posts in $POSTS_LIST; do
    log "=== mem=$mem posts=$posts ==="
    server_up "$mem" || continue
    init_admin
    TOKENS=$(get_token)
    if [ -z "$TOKENS" ]; then log "no token, skip"; server_down; continue; fi
    SUPER_TOKEN=$(echo "$TOKENS" | awk '{print $1}')
    ADMIN_TOKEN=$(echo "$TOKENS" | awk '{print $2}')
    seed_posts "$posts" "$SUPER_TOKEN $ADMIN_TOKEN"

    for rep in $(seq 1 "$REPEAT"); do
      log "  run $rep/$REPEAT"
      # 重启服务端确保每轮从相同状态开始（清掉上一轮的堆状态）
      docker restart $SERVER >/dev/null
      for i in $(seq 1 30); do
        docker exec $SERVER wget -q -O /dev/null -T 1 http://127.0.0.1:8090/api/health 2>/dev/null && break
        sleep 1
      done
      run_round "$mem" "$posts" "$rep" "$SUPER_TOKEN" || break
    done
    server_down
  done
done

log "all done. results in $RESULTS_DIR/"
log "summarize: python3 summarize.py $RESULTS_DIR"
