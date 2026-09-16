#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# e2e-journey.sh — 容器全栈人类旅程验证(解锁流/feed 别名/可见性/theme 切换)
#
# 前提: scripts/dev/dev-verify.sh 已起容器(或等价全栈在 BASE 可达)。
# 覆盖: caddy ReservedPaths 反代、锁定文 teaser 卡(不泄漏正文)、
#       私密文列表/首页缺席、private 详情重定向 /admin、UnLockCard
#       服务端渲染、写钩子缓存失效实时性、theme 切换全链路
#       (site.activeTheme → theme-host poll → 根路径渲染切换 + 前缀路由)。
# 浏览器面(解锁点击流)用 xd://browser 或手工走查,本脚本为 HTTP 断言面。
#
# 用法: bash scripts/test/e2e-journey.sh [BASE]
#   BASE 默认 http://localhost:8080
# 环境变量:
#   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — 已初始化实例的管理员账号;
#   未初始化实例自动走 setup/complete 创建(密码随机,存 /tmp 凭据文件)。
# ═══════════════════════════════════════════════════════════════
set -uo pipefail
BASE="${1:-http://localhost:8080}"
E2E_ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-e2e@vanblog.local}"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
check(){ local cond="$1" label="$2"; if eval "$cond"; then ok "$label"; else bad "$label"; fi; }

# ── 0. setup(未初始化走 setup/complete;已初始化取 env 密码或凭据文件) ──
STATUS=$(curl -s "$BASE/api/vanblog/setup/status")
PW_FILE="/tmp/vanblog-e2e-admin-${E2E_ADMIN_EMAIL}.env"
if echo "$STATUS" | jq -e '.bootstrap == true' >/dev/null; then
  PASSWD="$(openssl rand -hex 16)"
  printf '%s' "$PASSWD" > "$PW_FILE"
  R=$(curl -s -X POST "$BASE/api/vanblog/setup/complete" -H 'Content-Type: application/json' \
    -d "{\"username\":\"e2e-admin\",\"email\":\"$E2E_ADMIN_EMAIL\",\"password\":\"$PASSWD\",\"passwordConfirm\":\"$PASSWD\"}")
  echo "$R" | jq -e '.ok == true' >/dev/null && echo "setup 完成" || { echo "setup 失败: $R"; exit 2; }
elif [ -n "${E2E_ADMIN_PASSWORD:-}" ]; then
  PASSWD="$E2E_ADMIN_PASSWORD"
elif [ -f "$PW_FILE" ]; then
  PASSWD="$(cat "$PW_FILE")"
else
  echo "实例已初始化但缺密码(设 E2E_ADMIN_PASSWORD 或提供 $PW_FILE)"; exit 2
fi

# ── 1. 登录 + 种子(可重复执行:先清理上一轮) ──
TOKEN=$(curl -s -X POST "$BASE/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' -d "{\"identity\":\"$E2E_ADMIN_EMAIL\",\"password\":\"$PASSWD\"}" | jq -r '.token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { echo "登录失败"; exit 2; }
OLD=$(curl -s "$BASE/api/collections/posts/records?filter=(pathname~'/e2e-')&perPage=50" -H "Authorization: $TOKEN" | jq -r '.items[].id')
for id in $OLD; do curl -s -X DELETE "$BASE/api/collections/posts/records/$id" -H "Authorization: $TOKEN" >/dev/null; done

seed() { curl -s -X POST "$BASE/api/collections/posts/records" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d "$1"; }
NORMAL_ID=$(seed '{"title":"E2E-NORMAL-MARKER 普通文","content":"普通正文","status":"published","private":false,"pathname":"/e2e-normal","deleted":false}' | jq -r '.id')
LOCKED_ID=$(seed '{"title":"E2E-LOCKED-MARKER 锁定文","content":"SECRET-E2E-LOCKED 锁定正文","status":"published","private":false,"password":"E2ELOCKPW1","pathname":"/e2e-locked","deleted":false}' | jq -r '.id')
PRIVATE_ID=$(seed '{"title":"E2E-PRIVATE-MARKER 私密文","content":"SECRET-E2E-PRIVATE","status":"published","private":true,"pathname":"/e2e-private","deleted":false}' | jq -r '.id')
for id in "$NORMAL_ID" "$LOCKED_ID" "$PRIVATE_ID"; do
  [ -n "$id" ] && [ "$id" != "null" ] || { echo "seed failed"; exit 2; }
done
echo "seeded: normal=$NORMAL_ID locked=$LOCKED_ID private=$PRIVATE_ID"

cleanup() {
  for id in "$NORMAL_ID" "$LOCKED_ID" "$PRIVATE_ID" "$FRESH_ID"; do
    [ -n "$id" ] && [ "$id" != "null" ] && curl -s -X DELETE "$BASE/api/collections/posts/records/$id" -H "Authorization: $TOKEN" >/dev/null
  done
}
trap cleanup EXIT

# ── 2. caddy 路由面 ──
echo "== caddy 路由 =="
check "[ \"\$(curl -s -o /dev/null -w '%{http_code}' \"$BASE/feed.xml\")\" = 200 ]" "C1 caddy /feed.xml → pb → 200"
check "[ \"\$(curl -s -o /dev/null -w '%{http_code}' \"$BASE/atom.xml\")\" = 200 ]" "C1 caddy /atom.xml → 200"
check "[ \"\$(curl -s -o /dev/null -w '%{http_code}' \"$BASE/sitemap.xml\")\" = 200 ]" "C1 caddy /sitemap.xml → 200"
check "curl -s \"$BASE/feed.xml\" | grep -q 'E2E-NORMAL-MARKER' && ! curl -s \"$BASE/feed.xml\" | grep -qE 'LOCKED|PRIVATE'" "C2 feed 含正常文,排除锁定/私密"

# ── 3. 主题 SSR 面(theme-host 根路径挂载) ──
echo "== 主题 SSR =="
sleep 2
HOME_HTML=$(curl -s "$BASE/")
check "echo \"\$HOME_HTML\" | grep -q 'E2E-NORMAL-MARKER'" "T1 首页含正常文卡"
check "echo \"\$HOME_HTML\" | grep -q 'E2E-LOCKED-MARKER'" "T2 首页含锁定文 teaser 卡"
check "echo \"\$HOME_HTML\" | grep -q '该文章已加密'" "T2 锁定卡加密提示渲染"
check "! echo \"\$HOME_HTML\" | grep -q 'SECRET-E2E-LOCKED'" "T2 锁定卡不泄漏正文"
check "! echo \"\$HOME_HTML\" | grep -q 'E2E-PRIVATE-MARKER'" "T3 私密文首页缺席"
PRIV_REDIRECT=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/post/e2e-private")
check "echo \"\$PRIV_REDIRECT\" | grep -qE '^30[27] '" "T4 私密文详情重定向 /admin"
LOCKED_PAGE=$(curl -s "$BASE/post/e2e-locked")
check "echo \"\$LOCKED_PAGE\" | grep -q '请输入密码'" "T5 锁定文详情渲染 UnLockCard(上游文案)"
check "! echo \"\$LOCKED_PAGE\" | grep -q 'SECRET-E2E-LOCKED'" "T5 详情不泄漏正文"
NORMAL_PAGE=$(curl -s "$BASE/post/e2e-normal")
check "echo \"\$NORMAL_PAGE\" | grep -q '普通正文'" "T6 正常文详情渲染全文"

# ── 4. 写后实时性(钩子链修复的行为): 新建文必须及时出现在首页 ──
echo "== 写后实时性 =="
FRESH_ID=$(seed '{"title":"E2E-FRESH-MARKER 实时性探针","content":"fresh body","status":"published","pathname":"/e2e-fresh","deleted":false}' | jq -r '.id')
FRESH=0
for i in $(seq 1 10); do
  sleep 1
  if curl -s "$BASE/" | grep -q 'E2E-FRESH-MARKER'; then FRESH=1; break; fi
done
check "[ \"\$FRESH\" = 1 ]" "T7 新建文 ${i}s 内出现在首页(写钩子失效生效)"

# ── 5. theme 切换全链路(site.activeTheme → theme-host poll → 根路径渲染) ──
echo "== theme 切换 =="
HEALTH=$(curl -s "$BASE/__theme_host_health")
check "echo \"\$HEALTH\" | jq -e '.ok == true and (.activeTheme | length > 0)' >/dev/null" "T8 theme-host 健康端点暴露 activeTheme"
ACTIVE=$(echo "$HEALTH" | jq -r '.activeTheme')
if [ "$ACTIVE" = "vanblog" ]; then OTHER="base"; else OTHER="vanblog"; fi
check "[ \"\$(curl -s -o /dev/null -w '%{http_code}' \"$BASE/themes/$ACTIVE/\")\" = 200 ]" "T9 /themes/$ACTIVE/ 前缀路由经 caddy 反代可达(withBase 契约)"
SITE_ID=$(curl -s "$BASE/api/collections/site/records?perPage=1" | jq -r '.items[0].id')
patch_theme() {
  local code
  code=$(curl -s -o /tmp/vb-journey-patch.out -w '%{http_code}' \
    -X PATCH "$BASE/api/collections/site/records/$SITE_ID" \
    -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"activeTheme\":\"$1\"}")
  if [ "$code" != "200" ]; then
    echo "  ⚠ PATCH activeTheme=$1 → HTTP $code: $(head -c 200 /tmp/vb-journey-patch.out)"
  fi
  rm -f /tmp/vb-journey-patch.out
}
wait_theme() { # wait_theme <期望主题> <轮数x2s>
  local want="$1" rounds="$2" i
  for i in $(seq 1 "$rounds"); do
    sleep 2
    [ "$(curl -s "$BASE/__theme_host_health" | jq -r '.activeTheme')" = "$want" ] && return 0
  done
  return 1
}
patch_theme "$OTHER"
check "wait_theme '$OTHER' 15" "T10 site.activeTheme→$OTHER 经 poll 生效(≤30s)"
check "curl -s \"$BASE/\" | grep -q \"/themes/$OTHER/_astro/\"" "T10 根路径资产前缀切到 $OTHER(withBase 生效)"
patch_theme "no-such-theme"
sleep 12
check "[ \"\$(curl -s \"$BASE/__theme_host_health\" | jq -r '.activeTheme')\" = \"$OTHER\" ]" "T11 切换不存在的主题名:加载失败回退保持原主题"
patch_theme "$ACTIVE"
check "wait_theme '$ACTIVE' 15" "T12 切回 $ACTIVE 恢复基线"

echo "════ 容器旅程(HTTP 断言面): PASS=$PASS FAIL=$FAIL ════"
[ "$FAIL" -eq 0 ]
