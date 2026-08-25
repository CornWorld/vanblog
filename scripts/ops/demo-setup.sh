#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  demo-setup.sh — Vanblog Demo 站一键初始化
#
#  前提: vanblog.corn.im 已解析到本机, prod 容器已在运行
#        (vanblog.sh install 或 docker compose up -d 已完成)
#  本脚本: 等待就绪 → 创建 demo 管理员 → 设置 allowedDomains
#          → 灌示例文章 → 打印访问地址
#
#  依赖: curl、jq、docker(compose)
#  用法: bash scripts/ops/demo-setup.sh
#  覆盖: 环境变量 VANBLOG_DEMO_DOMAIN / VANBLOG_DEMO_EMAIL / VANBLOG_DEMO_PASSWORD
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

for c in curl jq docker; do
  command -v "$c" >/dev/null 2>&1 || { err "缺少依赖: $c"; exit 1; }
done

# 容器内 pb 地址（走管理口比较稳，默认 :80 的 /api 也行）
PB_URL="${VANBLOG_DEMO_PB_URL:-http://127.0.0.1:80}"

dc() { cd "$VANBLOG_BASE_PATH" && docker compose "$@"; }

info "等待容器就绪…"
for i in $(seq 1 30); do
  if curl -sf "$PB_URL/api/health" >/dev/null 2>&1; then ok "容器已就绪"; break; fi
  [ "$i" -eq 30 ] && { err "容器 30s 未就绪，请先部署（vanblog.sh install）"; exit 1; }
  sleep 1
done

# ── 1. setup（仅当尚未有管理员时）──────────────────────────
STATUS=$(curl -sf "$PB_URL/api/vanblog/setup/status" 2>/dev/null || echo '{"bootstrap":false}')
if echo "$STATUS" | jq -e '.bootstrap == true' >/dev/null 2>&1; then
  info "创建 demo 管理员 ($DEMO_USER / $DEMO_PASSWORD)…"
  RESP=$(curl -sf -X POST "$PB_URL/api/vanblog/setup/complete" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$DEMO_USER\",\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\",\"passwordConfirm\":\"$DEMO_PASSWORD\"}") \
    || { err "setup 失败，请查看容器日志"; exit 1; }
  echo "$RESP" | jq -e '.ok == true' >/dev/null 2>&1 && ok "管理员创建成功" \
    || { echo "$RESP"; err "setup 返回异常"; exit 1; }
else
  info "已存在管理员，跳过创建"
fi

# ── 2. 设置 allowedDomains（关键：setup 后空白名单 = TLS 拒绝）──
info "设置 site.allowedDomains = [$DOMAIN]…"
TOKEN=$(curl -sf -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" | jq -r '.token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { err "登录失败（账号/密码被改?）"; exit 1; }
SITE_ID=$(curl -sf "$PB_URL/api/collections/site/records?perPage=1" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.items[0].id')
[ -n "$SITE_ID" ] && [ "$SITE_ID" != "null" ] || { err "未找到 site 记录"; exit 1; }
curl -sf -X PATCH "$PB_URL/api/collections/site/records/$SITE_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"allowedDomains\":[\"$DOMAIN\"]}" >/dev/null || { err "设置 allowedDomains 失败"; exit 1; }
ok "allowedDomains 已设置"

# ── 3. 灌示例文章 ──────────────────────────────────────
info "灌入 $SEED_COUNT 篇示例文章…"
dc exec -T vanblog vanblog seed --count "$SEED_COUNT" --dir=/pb_data || { err "seed 失败"; exit 1; }
ok "seed 完成"

echo ""
echo "════════════════════════════════════════════"
ok "Demo 站就绪:"
echo "  前台  https://$DOMAIN/"
echo "  后台  https://$DOMAIN/admin/  (账号 $DEMO_USER / $DEMO_PASSWORD)"
echo "  pb UI https://$DOMAIN/_/"
echo "════════════════════════════════════════════"
echo "（若 HTTPS 仍 403：确认 allowedDomains 包含 $DOMAIN，且容器只暴露 :80/:443）"
