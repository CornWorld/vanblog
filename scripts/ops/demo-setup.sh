#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  demo-setup.sh — Vanblog Demo 站一键初始化
#
#  前提: prod 容器已在运行 — 两种部署形态均可:
#    a) vanblog.sh install / docker compose up -d (VANBLOG_BASE_PATH 下有 compose)
#    b) 裸 docker run + watchtower (容器名 vanblog,或 VANBLOG_DEMO_CONTAINER 指定)
#  本脚本: 等待就绪 → 创建 demo 管理员 → 设置 allowedDomains
#          → 灌示例文章 → 打印访问地址
#
#  依赖: curl、python3、docker（不依赖 jq——最小化宿主常见缺 jq）
#  用法: bash scripts/ops/demo-setup.sh
#  覆盖: 环境变量 VANBLOG_DEMO_DOMAIN / VANBLOG_DEMO_EMAIL / VANBLOG_DEMO_PASSWORD
#        / VANBLOG_DEMO_CONTAINER(裸容器名) / VANBLOG_DEMO_SEED_COUNT
# ═══════════════════════════════════════════════════════════════
set -uo pipefail

DOMAIN="${VANBLOG_DEMO_DOMAIN:-vanblog.corn.im}"
DEMO_USER="${VANBLOG_DEMO_USER:-demo}"
DEMO_EMAIL="${VANBLOG_DEMO_EMAIL:-demo@corn.im}"
DEMO_PASSWORD="${VANBLOG_DEMO_PASSWORD:-demo1234}"   # 密码须 >= 8 位
SEED_COUNT="${VANBLOG_DEMO_SEED_COUNT:-20}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

VANBLOG_BASE_PATH="${VANBLOG_BASE_PATH:-/var/vanblog}"

for c in curl python3 docker; do
  command -v "$c" >/dev/null 2>&1 || { err "缺少依赖: $c"; exit 1; }
done

# jget '<py-expr>': stdin JSON → 解析为 d 后求值表达式并输出(替代 jq,零依赖)
jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }

# 容器解析:优先 compose(服务名 vanblog)解析出容器 ID;无 compose 项目时
# 直接用裸容器(默认名 vanblog,如 sg 上的 docker run + watchtower 部署)。
# 之后统一 docker exec 直连,不再依赖 compose 子命令。
PB_URL="${VANBLOG_DEMO_PB_URL:-http://127.0.0.1:8080}"

dc() { cd "$VANBLOG_BASE_PATH" && docker compose "$@"; }
if CID=$(dc ps -q vanblog 2>/dev/null) && [ -n "$CID" ]; then
  VANBLOG_CONTAINER="$CID"
else
  VANBLOG_CONTAINER="${VANBLOG_DEMO_CONTAINER:-vanblog}"
  docker inspect "$VANBLOG_CONTAINER" >/dev/null 2>&1 \
    || { err "未找到 compose 服务 vanblog($VANBLOG_BASE_PATH)或容器 $VANBLOG_CONTAINER"; exit 1; }
fi
vex() { docker exec "$VANBLOG_CONTAINER" "$@"; }
vexu() { docker exec -u vanblog "$VANBLOG_CONTAINER" "$@"; }
# pbc: container-side curl against the management port (always up in prod).
pbc() { vex curl -s "$@"; }

info "等待容器就绪…"
for i in $(seq 1 30); do
  if pbc -f "$PB_URL/api/health" >/dev/null 2>&1; then ok "容器已就绪"; break; fi
  [ "$i" -eq 30 ] && { err "容器 30s 未就绪，请先部署（vanblog.sh install）"; exit 1; }
  sleep 1
done

# ── 1. setup（仅当尚未有管理员时）──────────────────────────
STATUS=$(pbc -f "$PB_URL/api/vanblog/setup/status" 2>/dev/null || echo '{"bootstrap":false}')
if [ "$(echo "$STATUS" | jget 'd.get("bootstrap") is True')" = "True" ]; then
  info "创建 demo 管理员 ($DEMO_USER / $DEMO_PASSWORD)…"
  RESP=$(pbc -f -X POST "$PB_URL/api/vanblog/setup/complete" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$DEMO_USER\",\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\",\"passwordConfirm\":\"$DEMO_PASSWORD\"}") \
    || { err "setup 失败，请查看容器日志"; exit 1; }
  [ "$(echo "$RESP" | jget 'd.get("ok") is True')" = "True" ] && ok "管理员创建成功" \
    || { echo "$RESP"; err "setup 返回异常"; exit 1; }
else
  info "已存在管理员，跳过创建"
fi

# ── 2. 设置 allowedDomains（关键：setup 后空白名单 = TLS 拒绝）──
info "设置 site.allowedDomains = [$DOMAIN]…"
TOKEN=$(pbc -f -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" | jget 'd.get("token") or ""')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { err "登录失败（账号/密码被改?）"; exit 1; }
SITE_ID=$(pbc -f "$PB_URL/api/collections/site/records?perPage=1" \
  -H "Authorization: Bearer $TOKEN" | jget '(d.get("items") or [{}])[0].get("id") or ""')
[ -n "$SITE_ID" ] && [ "$SITE_ID" != "null" ] || { err "未找到 site 记录"; exit 1; }
pbc -f -X PATCH "$PB_URL/api/collections/site/records/$SITE_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"allowedDomains\":[\"$DOMAIN\"]}" >/dev/null || { err "设置 allowedDomains 失败"; exit 1; }
ok "allowedDomains 已设置"

# ── 3. 灌示例文章 ──────────────────────────────────────
# 3a. site 配置(gravatar 作者头像/作者名)+ showcase 功能文;count=0 不灌随机文章
info "初始化 site 配置与 showcase 文章…"
vexu vanblog seed --count 0 --dir=/pb_data || { err "seed 失败"; exit 1; }
ok "site/showcase 就绪"

# 3b. 真实语料文章:Hacker News / arXiv(复用 bench 工具链;语料按仓库内
#     corpus.ids.json 钉定 ID,--replay 确定性重建)。脚本用容器自带 node
#     执行,宿主无需 node;直连容器内管理端口。
BENCH_DIR="${VANBLOG_DEMO_BENCH_DIR:-$SCRIPT_DIR/../../bench}"
[ -f "$BENCH_DIR/seed.mjs" ] || { err "未找到 bench 工具链: $BENCH_DIR/seed.mjs
  (部署机上需与 scripts/ 一起同步仓库 bench/ 目录,或设 VANBLOG_DEMO_BENCH_DIR)"; exit 1; }

info "抓取语料(fetch-corpus --replay)…"
docker cp "$BENCH_DIR" "$VANBLOG_CONTAINER:/tmp/bench" >/dev/null || { err "bench 脚本拷入容器失败"; exit 1; }
vex sh -c 'node /tmp/bench/fetch-corpus.mjs --replay > /tmp/bench/corpus.jsonl' \
  || { err "语料抓取失败(容器需可访问外网)"; exit 1; }

info "登录 superuser(categories/tags 创建权限)…"
SUPER_TOKEN=$(pbc -f -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" | jget 'd.get("token") or ""')
[ -n "$SUPER_TOKEN" ] && [ "$SUPER_TOKEN" != "null" ] || { err "superuser 登录失败(bootstrap 应与 admin 同凭据)"; exit 1; }

info "灌入 $SEED_COUNT 篇真实文章…"
vex node /tmp/bench/seed.mjs "$PB_URL" "$SUPER_TOKEN" "$TOKEN" "$SEED_COUNT" /tmp/bench/corpus.jsonl \
  || { err "语料灌入失败"; exit 1; }
vex rm -rf /tmp/bench
ok "seed 完成(1 篇 showcase + $SEED_COUNT 篇 HN/arXiv 语料)"

echo ""
echo "════════════════════════════════════════════"
ok "Demo 站就绪:"
echo "  前台  https://$DOMAIN/"
echo "  后台  https://$DOMAIN/admin/  (账号 $DEMO_USER / $DEMO_PASSWORD)"
echo "  pb UI https://$DOMAIN/_/"
echo "════════════════════════════════════════════"
echo "（若 HTTPS 仍 403：确认 allowedDomains 包含 ${DOMAIN}，且容器只暴露 :80/:443）"
