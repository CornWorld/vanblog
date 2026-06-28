#!/bin/bash

#========================================================
#   Vanblog 一键管理脚本 (gum enhanced)
#   Github: https://github.com/cornworld/vanblog
#   适用系统: CentOS 7+ / Debian 8+ / Ubuntu 16+ / Alpine
#
#   依赖:
#     - docker + docker compose (脚本会自动尝试安装)
#     - gum (Charm TUI 工具,可选 — 缺失时自动 fallback 到 read 模式)
#       安装: https://github.com/charmbracelet/gum#installation
#========================================================

VANBLOG_BASE_PATH="${VANBLOG_BASE_PATH:-/var/vanblog}"
VANBLOG_DATA_PATH="${VANBLOG_BASE_PATH}/data"
VANBLOG_SCRIPT_VERSION="v1.1.0"

# 镜像源(根据 CN 自动切换)
DEFAULT_IMAGE="ghcr.io/cornworld/vanblog:prod"
CN_IMAGE="registry.cn-beijing.aliyuncs.com/cornworld/vanblog:prod"

export PATH=$PATH:/usr/local/bin

# --- gum 检测与 fallback 包装 -----------------------------------------------
# 设计: 如果 gum 可用,用 TUI 风格;否则退回到 read 模式,脚本仍可运行。
# 这样 curl | bash 在没装 gum 的机器上不会炸,老用户也能升级到更顺手的体验。

GUM_BIN=""

gum_choose() {
    # $1 = prompt; 后续参数 = 选项
    local prompt="$1"; shift
    if [[ -n "$GUM_BIN" ]]; then
        "$GUM_BIN" choose --header="$prompt" --selected.foreground="212" "$@"
    else
        echo "$prompt" >&2
        local i=1
        for opt in "$@"; do
            echo "  $i) $opt" >&2
            i=$((i + 1))
        done
        read -e -p "选择 [1-$#]: " num >&2
        echo "${!num}"
    fi
}

gum_ask() {
    # $1 = prompt; $2 = default (y/n)
    local prompt="$1" default="${2:-n}"
    if [[ -n "$GUM_BIN" ]]; then
        if [[ "$default" = "y" ]]; then
            "$GUM_BIN" confirm "$prompt" --default=true && return 0 || return 1
        else
            "$GUM_BIN" confirm "$prompt" --default=false && return 0 || return 1
        fi
    else
        local yn
        read -e -p "$prompt [y/N]: " yn
        [[ "$yn" =~ ^[yY] ]]
    fi
}

gum_input() {
    # $1 = prompt; $2 = placeholder/default
    local prompt="$1" default="${2:-}"
    if [[ -n "$GUM_BIN" ]]; then
        if [[ -n "$default" ]]; then
            "$GUM_BIN" input --header="$prompt" --placeholder="$default" --value="$default" --width=80
        else
            "$GUM_BIN" input --header="$prompt" --width=80
        fi
    else
        local val
        read -e -p "$prompt [$default]: " val
        echo "${val:-$default}"
    fi
}

gum_spin() {
    # $1 = spinner message; $2... = command (string passed to bash -c)
    local msg="$1"; shift
    if [[ -n "$GUM_BIN" ]]; then
        "$GUM_BIN" spin --spinner dot --title "$msg" -- bash -c "$*"
    else
        echo "[$msg]"
        bash -c "$*"
    fi
}

gum_info()  { [[ -n "$GUM_BIN" ]] && "$GUM_BIN" style --foreground=39  "ℹ $1"  || echo "ℹ $1"; }
gum_ok()    { [[ -n "$GUM_BIN" ]] && "$GUM_BIN" style --foreground=76  "✓ $1"  || echo "✓ $1"; }
gum_warn()  { [[ -n "$GUM_BIN" ]] && "$GUM_BIN" style --foreground=214 "⚠ $1"  || echo "⚠ $1"; }
gum_err()   { [[ -n "$GUM_BIN" ]] && "$GUM_BIN" style --foreground=196 "✗ $1"  || echo "✗ $1"; }

detect_gum() {
    if command -v gum >/dev/null 2>&1; then
        GUM_BIN="$(command -v gum)"
        return 0
    fi
    cat >&2 <<'EOF'

┌──────────────────────────────────────────────────────────┐
│ 提示:未检测到 gum,使用基础 read 模式                       │
│ 安装 gum 获得更好体验:https://github.com/charmbracelet/gum │
│   macOS:  brew install gum                                │
│   Linux:  详见 https://github.com/charmbracelet/gum        │
└──────────────────────────────────────────────────────────┘

EOF
    return 1
}

# --- 环境探测 ---

detect_arch() {
    case "$(uname -m)" in
        x86_64)         echo "amd64" ;;
        aarch64|armv8*) echo "arm64" ;;
        *) gum_err "不支持的架构: $(uname -m) (目前仅支持 amd64 / arm64)"; exit 1 ;;
    esac
}

detect_cn() {
    if [[ -n "$CN" ]]; then
        [[ "$CN" = "true" || "$CN" = "1" ]] && return 0 || return 1
    fi
    if command -v curl >/dev/null 2>&1; then
        if curl -m 5 -s https://ipapi.co/json 2>/dev/null | grep -q '"China"'; then
            return 0
        fi
    fi
    return 1
}

# --- Docker 安装 ---

ensure_docker() {
    if command -v docker >/dev/null 2>&1; then
        return 0
    fi

    gum_info "未检测到 Docker,正在安装..."
    if detect_cn; then
        bash <(curl -sL https://vanblog.mereith.com/docker.sh) -s docker --mirror Aliyun
    else
        curl -fsSL https://get.docker.com | bash
    fi

    systemctl enable docker.service 2>/dev/null || true
    systemctl start docker.service 2>/dev/null || service docker start 2>/dev/null || true

    command -v docker >/dev/null 2>&1 || { gum_err "Docker 安装失败,请手动安装"; exit 1; }
    gum_ok "Docker 安装成功"
}

ensure_docker_compose() {
    if docker compose version >/dev/null 2>&1; then
        return 0
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        return 0
    fi

    gum_info "安装 docker compose 插件..."
    if   command -v apt  >/dev/null 2>&1; then apt update && apt install -y docker-compose-plugin
    elif command -v yum  >/dev/null 2>&1; then yum install -y docker-compose-plugin
    elif command -v dnf  >/dev/null 2>&1; then dnf install -y docker-compose-plugin
    elif command -v pacman >/dev/null 2>&1; then pacman -Sy --noconfirm docker-compose
    fi

    docker compose version >/dev/null 2>&1 || { gum_err "请手动安装 docker-compose-plugin"; exit 1; }
}

# --- compose 调用 ---

dc() {
    cd "$VANBLOG_BASE_PATH" || exit 1
    if docker compose version >/dev/null 2>&1; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

# --- 生成 compose 文件 ---

write_compose() {
    local image="$1" email="$2" http_port="$3" https_port="$4" mgmt_port="$5" http_only="$6"

    local mgmt_block=""
    [[ -n "$mgmt_port" ]] && mgmt_block="      - \"${mgmt_port}:8080\""

    local tls_env=""
    [[ "$http_only" = "true" ]] && tls_env="      - VANBLOG_HTTP_ONLY=1"

    cat > "${VANBLOG_BASE_PATH}/docker-compose.yml" <<EOF
# Vanblog 一键部署配置 — 由 vanblog.sh 自动生成
# 修改后请运行: ./vanblog.sh restart
services:
  vanblog:
    image: ${image}
    restart: unless-stopped
    ports:
      - "${http_port}:80"
      - "${https_port}:443"
${mgmt_block}
    volumes:
      - ${VANBLOG_DATA_PATH}/pb_data:/pb_data
      - ${VANBLOG_DATA_PATH}/caddy_data:/data/caddy
    environment:
      - VANBLOG_EMAIL=${email}
      - VANBLOG_CADDY_LOG_LEVEL=warn
${tls_env}

volumes: {}
EOF
}

# --- 菜单动作 ---

install_vanblog() {
    gum_info "安装 Vanblog"

    mkdir -p "$VANBLOG_DATA_PATH"
    chmod 777 -R "$VANBLOG_DATA_PATH" 2>/dev/null || true

    if [[ -f "${VANBLOG_BASE_PATH}/docker-compose.yml" ]]; then
        gum_warn "检测到已有配置,继续将覆盖"
        gum_ask "建议先 backup。是否继续覆盖?" n || return 0
    fi

    ensure_docker
    ensure_docker_compose

    config_compose

    gum_spin "启动 vanblog..." "true"
    dc up -d
    if [[ $? -eq 0 ]]; then
        gum_ok "Vanblog 启动成功"
        gum_info "管理面板: http://<你的IP>:<http端口>/admin"
        gum_info "首次访问 /admin 时创建管理员账号"
    else
        gum_err "启动失败,请查看日志: ./vanblog.sh log"
    fi

    before_show_menu
}

config_compose() {
    gum_info "修改配置"

    local image
    if detect_cn; then
        image="$CN_IMAGE"
        gum_warn "检测到中国 IP,使用国内镜像"
    else
        image="$DEFAULT_IMAGE"
    fi

    local email
    while [[ -z "$email" ]]; do
        email=$(gum_input "请输入邮箱(用于 Let's Encrypt 证书提醒)")
    done

    local http_port
    http_port=$(gum_input "HTTP 端口" "80")
    http_port="${http_port:-80}"

    local https_port
    https_port=$(gum_input "HTTPS 端口" "443")
    https_port="${https_port:-443}"

    local http_only="false"
    if gum_ask "启用 HTTP_ONLY 模式?(外置反代用户选 y,默认 N)" n; then
        http_only="true"
        gum_info "HTTP_ONLY:外置反代将终止 TLS,容器内只跑 HTTP"
    fi

    local mgmt_port=""
    if gum_ask "暴露 8080 管理端口?(TLS 故障时回退用,默认不开)" n; then
        mgmt_port=$(gum_input "管理端口" "8080")
        mgmt_port="${mgmt_port:-8080}"
    fi

    write_compose "$image" "$email" "$http_port" "$https_port" "$mgmt_port" "$http_only"
    gum_ok "配置已保存到 ${VANBLOG_BASE_PATH}/docker-compose.yml"
    gum_info "重启生效: ./vanblog.sh restart"
}

start_vanblog()   { gum_info "启动 Vanblog";   dc up -d && gum_ok "已启动"   || gum_err "启动失败"; before_show_menu; }
stop_vanblog()    { gum_info "停止 Vanblog";   dc down && gum_ok "已停止"     || gum_err "停止失败"; before_show_menu; }
restart_vanblog() { gum_info "重启 Vanblog";   dc restart && gum_ok "已重启" || gum_err "重启失败"; before_show_menu; }

update_vanblog() {
    gum_info "更新 Vanblog"
    dc pull && dc down && dc up -d
    [[ $? -eq 0 ]] && gum_ok "更新成功" || gum_err "更新失败,请查看日志"
    before_show_menu
}

show_log() {
    gum_info "查看日志(Ctrl+C 退出)"
    dc logs -f
}

backup_vanblog() {
    gum_info "备份 Vanblog"
    local name="vanblog-backup-$(date +%Y%m%d%H%M%S).tar.gz"
    cd "$VANBLOG_BASE_PATH" || exit 1
    if dc down >/dev/null 2>&1; then
        gum_spin "压缩数据..." "tar czf $name data"
        dc up -d >/dev/null 2>&1
        gum_ok "备份成功: ${VANBLOG_BASE_PATH}/${name}"
    else
        gum_err "停止服务失败,备份中止"
    fi
    before_show_menu
}

restore_vanblog() {
    gum_info "恢复 Vanblog"
    local path
    path=$(gum_input "请输入备份文件路径(含文件名)")
    [[ -z "$path" ]] && { gum_err "路径为空"; return 1; }
    [[ ! -f "$path" ]] && { gum_err "文件不存在: $path"; return 1; }

    gum_warn "此操作将覆盖当前数据"
    gum_ask "确认恢复?" n || return 0

    stop_vanblog 0
    tar xzf "$path" -C "$VANBLOG_BASE_PATH"
    gum_ok "恢复成功,请手动启动: ./vanblog.sh start"
}

uninstall_vanblog() {
    gum_err "卸载 Vanblog — 数据将被删除!"
    gum_warn "此操作不可逆"
    gum_ask "确认卸载?" n || return 0

    dc down -v 2>/dev/null || true
    rm -rf "$VANBLOG_BASE_PATH"

    if [[ -n "$1" ]] && [[ "$1" = "purge" ]]; then
        docker rmi -f "$DEFAULT_IMAGE" "$CN_IMAGE" 2>/dev/null || true
        gum_ok "镜像已清理"
    fi
    gum_ok "Vanblog 已卸载"
}

enter_maintenance() {
    gum_warn "进入维护模式"
    gum_info "此操作会重启容器并暴露 8080 端口(明文 HTTP,绕过 TLS)"
    gum_info "用于 TLS 配置出错时通过 HTTP 修复 site.allowedDomains"
    gum_ask "继续?" n || return 0

    cd "$VANBLOG_BASE_PATH" || exit 1
    if ! grep -q "8080:8080" docker-compose.yml; then
        sed -i '/- "443:443"/a\      - "8080:8080"' docker-compose.yml
        gum_info "已添加 8080 端口映射,重启中..."
        dc down && dc up -d
        gum_ok "现在可通过 http://<你的IP>:8080/admin/ 修复配置"
        gum_warn "修复后: ./vanblog.sh restart(并手动移除 8080 映射)"
    else
        gum_ok "8080 端口已映射,无需重复操作"
    fi
    before_show_menu
}

# --- 菜单 ---

show_usage() {
    cat <<EOF
Vanblog 一键管理脚本 ${VANBLOG_SCRIPT_VERSION}

用法:
  ./vanblog.sh                # 显示交互菜单
  ./vanblog.sh install        # 安装并启动
  ./vanblog.sh config         # 修改配置
  ./vanblog.sh start          # 启动
  ./vanblog.sh stop           # 停止
  ./vanblog.sh restart        # 重启
  ./vanblog.sh update         # 拉取最新镜像并重启
  ./vanblog.sh log            # 跟随日志
  ./vanblog.sh backup         # 备份数据(tar.gz)
  ./vanblog.sh restore        # 从备份恢复
  ./vanblog.sh maintenance    # 进入维护模式(暴露 8080)
  ./vanblog.sh uninstall [purge]  # 卸载(purge 同时删镜像)

可选依赖:
  gum — Charm 出品的 TUI 工具,缺失时自动 fallback 到 read 模式
        安装: https://github.com/charmbracelet/gum#installation

数据目录: ${VANBLOG_DATA_PATH}
配置文件: ${VANBLOG_BASE_PATH}/docker-compose.yml
EOF
}

show_menu() {
    local choice
    choice=$(gum_choose "Vanblog ${VANBLOG_SCRIPT_VERSION} — 请选择" \
        "1. 安装 Vanblog" \
        "2. 修改配置" \
        "3. 启动服务" \
        "4. 停止服务" \
        "5. 重启服务" \
        "6. 更新镜像" \
        "7. 查看日志" \
        "8. 备份数据" \
        "9. 恢复数据" \
        "10. 进入维护模式" \
        "11. 卸载 Vanblog" \
        "0. 退出")
    [[ -z "$choice" || "$choice" = "0. 退出" ]] && exit 0

    case "${choice:0:2}" in
        "1.") install_vanblog ;;
        "2.") config_compose; before_show_menu ;;
        "3.") start_vanblog ;;
        "4.") stop_vanblog ;;
        "5.") restart_vanblog ;;
        "6.") update_vanblog ;;
        "7.") show_log ;;
        "8.") backup_vanblog ;;
        "9.") restore_vanblog ;;
        "10") enter_maintenance ;;
        "11") uninstall_vanblog ;;
    esac
}

before_show_menu() {
    echo
    gum_ask "返回主菜单?" y && show_menu || exit 0
}

# --- 入口 ---

if [[ $EUID -ne 0 ]]; then
    gum_err "请使用 root 用户运行此脚本"
    exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
    gum_err "缺少 curl,请先安装"
    exit 1
fi

detect_gum  # 设 GUM_BIN,缺失则 fallback
mkdir -p "$VANBLOG_BASE_PATH"

if [[ $# -gt 0 ]]; then
    case "$1" in
        install)     install_vanblog 0 ;;
        config)      config_compose; before_show_menu ;;
        start)       start_vanblog 0 ;;
        stop)        stop_vanblog 0 ;;
        restart)     restart_vanblog 0 ;;
        update)      update_vanblog 0 ;;
        log)         show_log ;;
        backup)      backup_vanblog 0 ;;
        restore)     restore_vanblog 0 ;;
        maintenance) enter_maintenance ;;
        uninstall)   uninstall_vanblog "$2" ;;
        -h|--help|help) show_usage ;;
        *)           show_usage; exit 1 ;;
    esac
else
    show_menu
fi
