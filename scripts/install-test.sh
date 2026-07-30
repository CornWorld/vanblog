#!/bin/bash
set -uo pipefail

#========================================================
#   Vanblog 集成测试 — 模拟首次用户安装流程
#
#   运行前提:
#     - 主机已安装 Docker + docker compose
#     - 需要 root 权限（vanblog.sh 需要 root）
#
#   用法:
#     sudo bash scripts/install-test.sh
#
#   测试流程:
#     1. 创建临时目录作为 VANBLOG_BASE_PATH
#     2. 用管道输入模拟交互式安装
#     3. 验证 docker-compose.yml 正确生成
#     4. 等待容器就绪
#     5. 验证端口可达
#     6. 运行 diagnose 验证
#     7. 清理
#========================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# 交互检查点: VANBLOG_TEST_INTERACTIVE=0 可跳过
interactive_pause() {
    local title="$1" body="$2"
    if [[ "${VANBLOG_TEST_INTERACTIVE:-1}" != "0" ]]; then
        blue ""
        blue "┌──────────────────────────────────────────┐"
        blue "│  🖐  ${title}"
        blue "├──────────────────────────────────────────┤"
        echo -e "${body}"
        blue "└──────────────────────────────────────────┘"
        read -p "  服务就绪后按 Enter 继续测试..." _ || exit 1
    fi
}

TEST_DIR=""
CLEANED=0
cleanup() {
    # 防止 trap 重入（EXIT + INT 可同时触发）
    if [[ $CLEANED -eq 1 ]]; then return; fi
    CLEANED=1
    if [[ -n "$TEST_DIR" && -d "$TEST_DIR" ]]; then
        blue "--- 清理测试环境 ---"
        local proj
        proj=$(basename "$TEST_DIR")
        # 1. 直接 docker rm -f 清除容器（不通过 compose，不等待优雅退出，不会卡死）
        docker ps -a --filter "name=$proj" --format '{{.ID}}' 2>/dev/null | \
            xargs -r docker rm -f 2>/dev/null || true
        # 2. 删除临时目录（bind mount 数据随目录一起删除）
        rm -rf "$TEST_DIR" 2>/dev/null || true
    fi
}
# EXIT 时一定清理（正常 return / exit 都走这里）
trap cleanup EXIT
# INT/TERM/HUP: 先清理，再退出（避免 trap 后继续执行）
trap 'cleanup; exit 1' INT TERM HUP

# --- 准备测试环境 ---

TEST_DIR=$(mktemp -d /tmp/vanblog-test-XXXXXX)
export VANBLOG_BASE_PATH="$TEST_DIR"
export VANBLOG_DATA_PATH="${VANBLOG_BASE_PATH}/data"
export VANBLOG_SKIP_ROOT_CHECK=1  # 测试环境跳过 root 检查
# 随机高位端口避免多实例冲突
HTTP_PORT=$((18080 + RANDOM % 1000))
HTTPS_PORT=$((HTTP_PORT + 363))
TEST_EMAIL="test@vanblog.local"

blue "测试目录: $TEST_DIR"
blue "HTTP 端口: $HTTP_PORT  HTTPS 端口: $HTTPS_PORT"

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VANBLOG_SH="$SCRIPT_DIR/vanblog.sh"

if [[ ! -f "$VANBLOG_SH" ]]; then
    assert_fail "找不到 vanblog.sh" "$VANBLOG_SH"
    exit 1
fi
assert_ok "找到 vanblog.sh"

# --- 预检查 ---
leftover=$(docker ps -a --filter "name=vanblog-test" --format '{{.ID}}' 2>/dev/null)
if [[ -n "$leftover" ]]; then
    echo "⚠ 检测到残留测试容器，正在清理..."
    docker rm -f $leftover 2>/dev/null || true
fi

# === 阶段 1: 模拟首次安装 ===

blue ""
blue "=== 阶段 1: 模拟首次安装（完整输出如下）==="

# 模拟 stdin 输入序列（gum 由 ensure_gum 自动处理）：
#   1. 邮箱: test@vanblog.local
#   2. HTTP 端口: (随机)
#   3. HTTPS 端口: (随机)
#   4. HTTP_ONLY 模式: y（测试无域名，避免 Caddy HTTPS 重定向）
#   5. 暴露管理端口: n（默认）
#   6. Caddy 日志级别: 回车（默认 warn）
#   7. 返回主菜单: n（退出）

{
    echo "$TEST_EMAIL"
    echo "$HTTP_PORT"
    echo "$HTTPS_PORT"
    echo "y"
    echo "n"
    echo ""
    echo "n"
} | bash "$VANBLOG_SH" install 2>&1

INSTALL_EXIT=$?
if [[ $INSTALL_EXIT -ne 0 ]]; then
    assert_fail "安装脚本退出码 $INSTALL_EXIT"
    exit 1
else
    assert_ok "安装脚本执行完毕"
fi

# === 阶段 2: 验证 compose 文件 ===

blue ""
blue "=== 阶段 2: 验证 compose 文件 ==="

COMPOSE_FILE="$VANBLOG_BASE_PATH/docker-compose.yml"
if [[ -f "$COMPOSE_FILE" ]]; then
    assert_ok "docker-compose.yml 已生成"
else
    assert_fail "docker-compose.yml 未生成"
fi

# 验证关键配置项
grep -q "VANBLOG_EMAIL=test@vanblog.local" "$COMPOSE_FILE" && \
    assert_ok "EMAIL 配置正确" || assert_fail "EMAIL 配置缺失或错误"
grep -q "${HTTP_PORT}:80" "$COMPOSE_FILE" && \
    assert_ok "HTTP 端口配置正确" || assert_fail "HTTP 端口缺失"
grep -q "${HTTPS_PORT}:443" "$COMPOSE_FILE" && \
    assert_ok "HTTPS 端口配置正确" || assert_fail "HTTPS 端口缺失"
grep -q "VANBLOG_PACKS_DIR=/var/lib/vanblog/packs" "$COMPOSE_FILE" && \
    assert_ok "PACKS_DIR env 已配置" || assert_fail "PACKS_DIR env 缺失"
grep -q "packs:/var/lib/vanblog/packs" "$COMPOSE_FILE" && \
    assert_ok "packs volume 已挂载" || assert_fail "packs volume 缺失"
grep -q "VANBLOG_HTTP_ONLY=1" "$COMPOSE_FILE" && \
    assert_ok "HTTP_ONLY 模式已启用" || assert_fail "HTTP_ONLY 模式缺失"

interactive_pause "检查 compose 配置" "${COMPOSE_FILE}"

# === 阶段 3: 等待服务就绪 ===

blue ""
blue "=== 阶段 3: 等待服务就绪（Caddy + PocketBase + Dispatcher）==="

cd "$VANBLOG_BASE_PATH" || exit 1

MAX_WAIT=120
i=0
SERVICE_UP=0
resp=""
while [[ $i -lt $MAX_WAIT ]]; do
    resp=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://127.0.0.1:${HTTP_PORT}/" 2>/dev/null || true)
    if [[ "$resp" =~ ^(200|301|302|308|404)$ ]]; then
        SERVICE_UP=1
        break
    fi
    printf "." >&2
    sleep 3
    i=$((i + 3))
done
echo >&2

if [[ $SERVICE_UP -eq 1 ]]; then
    assert_ok "HTTP 服务就绪（耗时 ${i}s, 状态码 ${resp}）"
    interactive_pause "服务已就绪，浏览器打开下方地址完成首次注册" \
"  前台: http://127.0.0.1:${HTTP_PORT}/\n  管理: http://127.0.0.1:${HTTP_PORT}/admin/\n  注册创建管理员账号即可体验全流程"
else
    assert_fail "服务启动超时（${MAX_WAIT}s）"
    docker compose logs --tail=40 2>/dev/null || true
    exit 1
fi

# === 阶段 4: 诊断 ===

blue ""
blue "=== 阶段 4: 诊断 + 容器详情 ==="

cd "$VANBLOG_BASE_PATH"
if docker compose ps --format '{{.Status}}' 2>/dev/null | grep -q "Up"; then
    assert_ok "diagnose: 容器运行中"
else
    assert_fail "diagnose: 容器未运行"
fi

CID=$(docker compose ps -q vanblog 2>/dev/null | head -1)
if [[ -n "$CID" ]]; then
    assert_ok "diagnose: 可获取容器 ID ($CID)"
else
    assert_fail "diagnose: 无法获取容器 ID"
fi

# === 阶段 6: 维护模式测试（override compose） ===

blue ""
blue "=== 阶段 6: 维护模式 ==="

{
    echo "y"
    echo "n"
} | bash "$VANBLOG_SH" maintenance 2>&1 | tail -3

MAINT_FILE="$VANBLOG_BASE_PATH/docker-compose.maintenance.yml"
# 等待维护模式重启完成（down+up 需要时间）
for i in $(seq 1 10); do
    if [[ -f "$MAINT_FILE" ]]; then
        break
    fi
    sleep 1
done
if [[ -f "$MAINT_FILE" ]]; then
    assert_ok "维护覆盖文件已创建"
    # 验证 compose 覆盖中包含 8080 端口映射
    grep -q '"8080:8080"' "$MAINT_FILE" && \
        assert_ok "维护覆盖: 8080 端口映射已配置" || \
        assert_fail "维护覆盖: 8080 端口映射缺失"
else
    assert_fail "维护覆盖文件未创建"
fi

# 退出维护模式（restart 应移除 override）
{
    echo "n"
} | bash "$VANBLOG_SH" restart 2>&1 | tail -3
sleep 3

if [[ ! -f "$MAINT_FILE" ]]; then
    assert_ok "restart 后维护覆盖已清理"
else
    assert_fail "restart 后维护覆盖仍在"
fi

# === 报告 ===
blue ""
blue "========================================"
echo -n "结果: "
if [[ $FAIL -eq 0 ]]; then
    green "全部通过 ($PASS/$PASS)"
else
    red "$FAIL 失败, $PASS 通过"
fi
exit $FAIL
