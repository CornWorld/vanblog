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

# ── 1b. 轮换 superuser 密码(公开凭据 ≠ superuser)──────────────────
# bootstrap 使 superuser 与 admin 同邮箱同密码;公开 demo 等于把 pb superuser
# UI(/_/)发给全世界。每次 setup 用随机密码轮换,新密码落宿主
# $VANBLOG_DEMO_HOME/SUPER_PASSWORD(600),pb_data 清空后仍可追溯。
info "轮换 superuser 密码…"
SUPER_EMAIL="$DEMO_EMAIL"
SUPER_PASS="${VANBLOG_DEMO_SUPER_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
vex vanblog superuser upsert "$SUPER_EMAIL" "$SUPER_PASS" --dir=/pb_data >/dev/null \
  || { err "superuser 轮换失败"; exit 1; }
DEMO_HOME="${VANBLOG_DEMO_HOME:-/opt/vanblog}"
printf '%s' "$SUPER_PASS" > "$DEMO_HOME/SUPER_PASSWORD"
chmod 600 "$DEMO_HOME/SUPER_PASSWORD" 2>/dev/null
ok "superuser 密码已轮换(已存 $DEMO_HOME/SUPER_PASSWORD)"

# ── 2. 设置 allowedDomains（关键：setup 后空白名单 = TLS 拒绝）──
info "设置 site.allowedDomains = [$DOMAIN]…"
LOGIN_JSON=$(pbc -f -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}")
TOKEN=$(echo "$LOGIN_JSON" | jget 'd.get("token") or ""')
ADMIN_ID=$(echo "$LOGIN_JSON" | jget 'd.get("record",{}).get("id") or ""')
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

info "登录 superuser(categories/tags 创建权限;已轮换密码)…"
SUPER_TOKEN=$(pbc -f -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SUPER_EMAIL\",\"password\":\"$SUPER_PASS\"}" | jget 'd.get("token") or ""')
[ -n "$SUPER_TOKEN" ] && [ "$SUPER_TOKEN" != "null" ] || { err "superuser 登录失败(轮换密码不一致?)"; exit 1; }

info "灌入 $SEED_COUNT 篇真实文章…"
vex node /tmp/bench/seed.mjs "$PB_URL" "$SUPER_TOKEN" "$TOKEN" "$SEED_COUNT" /tmp/bench/corpus.jsonl \
  || { err "语料灌入失败"; exit 1; }
vex rm -rf /tmp/bench
ok "seed 完成(1 篇 showcase + $SEED_COUNT 篇 HN/arXiv 语料)"

# ── 4. 清零引用 tag(showcase 的 gofakeit 标签只有名字没有文章,tag 页
#    「0 文章」即由此来;devseed 每次重建都会再造一批,放 setup 里跟随
#    每次重置自动生效)──────────────────────────────────────────
info "清理零引用 tag…"
python3 - "$PB_URL" "$SUPER_TOKEN" << 'PYEOF' || warn "零引用 tag 清理失败(不影响就绪)"
import json, sys, urllib.request
pb, token = sys.argv[1], sys.argv[2]
def get(u):
    return json.load(urllib.request.urlopen(u))
def delete(u):
    req = urllib.request.Request(u, method='DELETE', headers={'Authorization': 'Bearer ' + token})
    return urllib.request.urlopen(req).status
tags = get(pb + '/api/collections/tags/records?perPage=200')['items']
posts = get(pb + '/api/collections/posts/records?perPage=200&fields=id,tags')['items']
used = {t for p in posts for t in (p.get('tags') or [])}
removed = 0
for t in tags:
    if t['id'] not in used:
        try:
            delete(pb + '/api/collections/tags/records/' + t['id'])
            removed += 1
        except Exception:
            pass
print(f'  removed {removed} empty tags')
PYEOF
ok "零引用 tag 清理完成"

# ── 5. 置顶欢迎文(公开演示的试玩说明,含后台凭据)──────────────────
# 写成文章而非 login 页硬编码:自部署实例零改动,演示实例随每次重置自动重建。
info "创建置顶欢迎文…"
python3 - "$PB_URL" "$TOKEN" "$ADMIN_ID" << 'PYEOF' || warn "欢迎文创建失败(不影响就绪)"
import json, sys, urllib.request
pb, token, admin = sys.argv[1], sys.argv[2], sys.argv[3]
def call(u, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(u, data=data, method=method)
    r.add_header('Authorization', 'Bearer ' + token)
    r.add_header('Content-Type', 'application/json')
    return json.load(urllib.request.urlopen(r))
pathname = 'welcome-demo'
content = """## 👋 欢迎来到 VanBlog 公开演示站

随便折腾!这是全功能演示实例,**每小时整点自动重置**,改坏了别担心。

### 后台试玩

- 后台地址: [/admin/](/admin/)
- 账号: `demo`
- 密码: `demo1234`

### 可以玩的

写文章、页面、主题设置、调色盘、密码锁文、置顶、分类标签、评论配置……

### 演示模式已封禁

终端(agent)、MCP 文件读写、备份、迁移导入、路由接管、服务重启——这些
能力对公开账号一律 403,superuser 密码也已随机化。

### 注意

- 别放真实数据、真实邮箱(每小时清空)
- 改动会在下次整点恢复默认
"""
body = {
    'title': '👋 公开演示站 · 随便玩',
    'content': content,
    'status': 'published',
    'pathname': pathname,
    'top': 1000,
    'author': admin,
}
found = call(f"{pb}/api/collections/posts/records?filter=(pathname='{pathname}')")['items']
if found:
    call(f"{pb}/api/collections/posts/records/{found[0]['id']}", 'PATCH', body)
else:
    call(f"{pb}/api/collections/posts/records", 'POST', body)
print('  welcome post ready')
PYEOF
ok "置顶欢迎文就绪"

echo ""
echo "════════════════════════════════════════════"
ok "Demo 站就绪:"
echo "  前台  https://$DOMAIN/"
echo "  后台  https://$DOMAIN/admin/  (账号 $DEMO_USER / $DEMO_PASSWORD)"
echo "  pb UI https://$DOMAIN/_/"
echo "════════════════════════════════════════════"
echo "（若 HTTPS 仍 403：确认 allowedDomains 包含 ${DOMAIN}，且容器只暴露 :80/:443）"
