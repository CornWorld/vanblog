#!/bin/bash
set -uo pipefail

#========================================================
#   Vanblog 一键管理脚本 (gum enhanced)
#   Github: https://github.com/CornWorld/vanblog
#   适用系统: CentOS 7+ / Debian 8+ / Ubuntu 16+ / Alpine
#
#   依赖:
#     - docker + docker compose (脚本会自动尝试安装)
#     - gum (Charm TUI 工具,缺失时自动从 GitHub 下载安装)
#========================================================

VANBLOG_BASE_PATH="${VANBLOG_BASE_PATH:-/var/vanblog}"
VANBLOG_DATA_PATH="${VANBLOG_BASE_PATH}/data"
VANBLOG_SCRIPT_VERSION="v1.2.0"

# 镜像源(根据 CN 自动切换)
DEFAULT_IMAGE="${VANBLOG_IMAGE:-ghcr.io/cornworld/vanblog:prod}"
CN_IMAGE="${VANBLOG_CN_IMAGE:-registry.cn-beijing.aliyuncs.com/cornworld/vanblog:prod}"

export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin

# --- gum 包装（无 fallback，gum 由 ensure_gum 自动安装）---
# 设计: 始终使用 gum 提供一致的 TUI 体验。
# 首次运行时如果检测不到 gum，自动从 GitHub 下载安装。

gum_choose() {
    # $1 = prompt; 后续参数 = 选项
    local prompt="$1"; shift
    gum choose \
        --header="$prompt" \
        --header.foreground="39" \
        --cursor="→ " \
        --cursor.foreground="212" \
        --selected.foreground="212" \
        --item.foreground="250" \
        --height=15 \
        "$@"
}

gum_ask() {
    # $1 = prompt; $2 = default (y/n)
    local prompt="$1" default="${2:-n}"
    if [[ -t 0 ]]; then
        gum confirm "$prompt" \
            --prompt.foreground="212" \
            --selected.background="212" \
            --unselected.foreground="250" \
            $([[ "$default" = "y" ]] && echo "--default=true" || echo "--default=false") \
            && return 0 || return 1
    else
        # 非交互（piped stdin）：从管道读取
        local yn
        IFS= read -r yn
        case "$yn" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
    fi
}

gum_input() {
    # $1 = prompt; $2 = placeholder/default
    local prompt="$1" default="${2:-}"
    if [[ -t 0 ]]; then
        if [[ -n "$default" ]]; then
            gum input \
                --header="$prompt" \
                --header.foreground="39" \
                --prompt="▸ " \
                --prompt.foreground="212" \
                --placeholder="$default" \
                --value="$default" \
                --width=80
        else
            gum input \
                --header="$prompt" \
                --header.foreground="39" \
                --prompt="▸ " \
                --prompt.foreground="212" \
                --width=80
        fi
    else
        # 非交互（piped stdin）：从管道读取
        local val
        IFS= read -r val
        echo "${val:-$default}"
    fi
}

gum_spin() {
    # $1 = spinner message; $2... = command (string passed to bash -c)
    local msg="$1"; shift
    gum spin --spinner minidot --title "$msg" -- bash -c "$*"
}

gum_info()  { gum style --foreground=39 --bold "ℹ $1"; }
gum_ok()    { gum style --foreground=76 --bold "✓ $1"; }
gum_warn()  { gum style --foreground=214 --bold "⚠ $1"; }
gum_err()   { gum style --foreground=196 --bold "✗ $1"; }

gum_section() {
    # 带圆角边框的区域分隔标题
    local title="$1"
    echo ""
    gum style \
        --border rounded \
        --padding "0 2" \
        --border-foreground 212 \
        --foreground 39 \
        --bold \
        "$title"
}

ensure_gum() {
    # 确保 gum 已安装（缺失时自动用包管理器 / 下载安装）
    command -v gum >/dev/null 2>&1 && return 0

    # --- 1) 包管理器安装 ---
    if command -v brew >/dev/null 2>&1; then
        echo "📦 正在通过 Homebrew 安装 gum..."
        brew install gum && echo "✓ gum 安装成功" && return 0
    fi
    if command -v pacman >/dev/null 2>&1; then
        echo "📦 正在通过 pacman 安装 gum..."
        pacman -S --noconfirm gum && echo "✓ gum 安装成功" && return 0
    fi
    if command -v apt-get >/dev/null 2>&1 && [[ $EUID -eq 0 ]]; then
        echo "📦 正在通过 apt 安装 gum..."
        mkdir -p /etc/apt/keyrings
        if curl -fsSL https://repo.charm.sh/apt/gpg.key | gpg --dearmor -o /etc/apt/keyrings/charm.gpg 2>/dev/null; then
            [[ -f /etc/apt/sources.list.d/charm.list ]] || \
                echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" > /etc/apt/sources.list.d/charm.list
            apt-get update -qq && apt-get install -y -qq gum && echo "✓ gum 安装成功" && return 0
        fi
    fi
    if command -v dnf >/dev/null 2>&1 && [[ $EUID -eq 0 ]]; then
        echo "📦 正在通过 dnf 安装 gum..."
        cat > /etc/yum.repos.d/charm.repo <<'REPO'
[charm]
name=Charm
baseurl=https://repo.charm.sh/yum/
enabled=1
gpgcheck=1
gpgkey=https://repo.charm.sh/yum/gpg.key
REPO
        dnf install -y gum && echo "✓ gum 安装成功" && return 0
    fi

    # --- 无可用包管理器 ---
    echo "✗ 无法自动安装 gum"
    if [[ $EUID -eq 0 ]]; then
        echo "  当前系统未检测到 brew / pacman / apt / dnf 等包管理器"
        echo "  请手动安装: https://github.com/charmbracelet/gum#installation"
    else
        echo "  非 root 用户请手动安装: brew install gum"
        echo "  或: sudo bash $0 以 root 运行（自动使用 apt/dnf）"
    fi
    exit 1
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
    if [[ -n "${CN:-}" ]]; then
        [[ "${CN:-}" = "true" || "${CN:-}" = "1" ]] && return 0 || return 1
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

# --- 读取已有 compose 配置（用于默认值）---
read_compose_env() {
    local key="$1" val=""
    local cf="${VANBLOG_BASE_PATH}/docker-compose.yml"
    [[ -f "$cf" ]] || return 1

    # 优先使用 docker compose config 做 YAML 规范化解析，
    # 避免裸 grep 被注释行 / 多行值 / 特殊字符误判。
    if docker compose version >/dev/null 2>&1; then
        val=$((cd "$VANBLOG_BASE_PATH" && docker compose config 2>/dev/null) | \
              grep -E "VANBLOG_${key}[=:]" | head -1 | \
              sed -E 's/.*VANBLOG_'"${key}"'[=:][[:space:]]*//;
                       s/[[:space:]]*$//; s/^"//; s/"$//')
    fi
    # 回退：docker compose 不存在时用裸 grep（匹配 `- VAR=value` 列表和 `VAR: value` 映射两种格式）
    [[ -n "$val" ]] || val=$(grep -E "^\\s*(-+\\s*)?VANBLOG_${key}[=:]" "$cf" 2>/dev/null | head -1 | \
                             sed -E 's/.*VANBLOG_'"${key}"'[=:][[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//')
    echo "$val"
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

write_compose() {
    local image="$1" email="$2" http_port="$3" https_port="$4" mgmt_port="$5" http_only="$6" caddy_log_level="${7:-warn}"

    local mgmt_block=""
    [[ -n "$mgmt_port" ]] && mgmt_block="      - \"${mgmt_port}:8080\""

    local tls_env=""
    [[ "$http_only" = "true" ]] && tls_env="      - VANBLOG_HTTP_ONLY=1"

    mkdir -p "${VANBLOG_DATA_PATH}/packs"

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
      - ${VANBLOG_DATA_PATH}/packs:/var/lib/vanblog/packs
    environment:
      - VANBLOG_EMAIL=${email}
      - VANBLOG_CADDY_LOG_LEVEL=${caddy_log_level}
      - VANBLOG_PACKS_DIR=/var/lib/vanblog/packs
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
    gum_info "修改配置（留空 = 保持现有值 / 默认值）"

    local image
    if detect_cn; then
        image="$CN_IMAGE"
        gum_warn "检测到中国 IP,使用国内镜像"
    else
        image="$DEFAULT_IMAGE"
    fi

    local def_email def_caddy_log
    def_email=$(read_compose_env EMAIL)
    def_caddy_log=$(read_compose_env CADDY_LOG_LEVEL)

    local email
    email=$(gum_input "邮箱(Let's Encrypt 证书提醒)" "${def_email:-}")
    while [[ -z "$email" ]]; do
        email=$(gum_input "邮箱不能为空" "${def_email:-}")
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

    local caddy_log_level
    caddy_log_level=$(gum_input "Caddy 日志级别 (debug|info|warn|error)" "${def_caddy_log:-warn}")
    caddy_log_level="${caddy_log_level:-${def_caddy_log:-warn}}"

    write_compose "$image" "$email" "$http_port" "$https_port" "$mgmt_port" "$http_only" "$caddy_log_level"
    gum_ok "配置已保存到 ${VANBLOG_BASE_PATH}/docker-compose.yml"
    gum_info "重启生效: ./vanblog.sh restart"
}

start_vanblog()   { gum_info "启动 Vanblog";   dc up -d && gum_ok "已启动"   || gum_err "启动失败"; before_show_menu; }
stop_vanblog()    { gum_info "停止 Vanblog";   dc down && gum_ok "已停止"     || gum_err "停止失败"; before_show_menu; }
restart_vanblog() {
    local override="${VANBLOG_BASE_PATH}/docker-compose.maintenance.yml"
    if [[ -f "$override" ]]; then
        rm -f "$override"
        gum_info "已移除维护模式覆盖"
    fi
    gum_info "重启 Vanblog"
    dc down && dc up -d && gum_ok "已重启" || gum_err "重启失败"
    before_show_menu
}

update_vanblog() {
    gum_info "更新 Vanblog"
    dc pull && dc down && dc up -d
    [[ $? -eq 0 ]] && gum_ok "更新成功" || gum_err "更新失败,请查看日志"
    before_show_menu
}

pack_cli() {
    # 透传给容器内 vanblog pack CLI(挂载了持久化 packs 目录)
    if [[ -z "$(dc ps -q vanblog 2>/dev/null)" ]]; then
        gum_err "容器未运行,请先启动: ./vanblog.sh start"
        return 1
    fi
    dc exec vanblog vanblog pack --packsDir=/var/lib/vanblog/packs "$@"
}
diagnose_vanblog() {
    gum_section "诊断 Vanblog"
    cd "$VANBLOG_BASE_PATH" || exit 1

    gum_section "容器状态"
    dc ps 2>/dev/null || echo "  容器未运行"

    gum_section "资源使用"
    local cid
    cid=$(dc ps -q vanblog 2>/dev/null | head -1)
    if [[ -n "$cid" ]]; then
        docker stats --no-stream "$cid" 2>/dev/null || echo "  docker stats 不可用"
    else
        echo "  容器未运行"
    fi

    gum_section "磁盘占用"
    du -sh "$VANBLOG_DATA_PATH" 2>/dev/null || echo "  数据目录不可读"
    du -sh "${VANBLOG_DATA_PATH}/packs" 2>/dev/null || true

    gum_section "最近日志（最后 20 行）"
    dc logs --tail=20 2>/dev/null || echo "  日志不可用"

    gum_section "系统信息"
    docker info --format 'Docker: {{.ServerVersion}} | OS: {{.OperatingSystem}} | CPU: {{.NCPU}} | Memory: {{.MemTotal}}' 2>/dev/null || true
    echo "  脚本版本: ${VANBLOG_SCRIPT_VERSION}"
    echo "  数据目录: ${VANBLOG_DATA_PATH}"

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
        gum_ok "备份成功: ${VANBLOG_BASE_PATH}/${name}（含 pb_data、caddy_data、packs）"
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

    local override="${VANBLOG_BASE_PATH}/docker-compose.maintenance.yml"
    if [[ -f "$override" ]]; then
        gum_ok "已处于维护模式（8080 端口已暴露）"
        before_show_menu
        return
    fi
    cat > "$override" <<'OVERRIDE'
services:
  vanblog:
    ports:
      - "8080:8080"
OVERRIDE
    gum_info "已生成维护覆盖文件, 重启中..."
    dc -f docker-compose.yml -f docker-compose.maintenance.yml down && \
    dc -f docker-compose.yml -f docker-compose.maintenance.yml up -d
    gum_ok "现在可通过 http://<你的IP>:8080/admin/ 修复配置"
    gum_warn "修复完成后运行 ./vanblog.sh restart（自动移除维护覆盖）"
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
  ./vanblog.sh pack list      # 列出已安装的 Pack(主题/扩展)
  ./vanblog.sh pack status    # 查看 Pack 生命周期状态
  ./vanblog.sh pack plan      # 部署预检(只读)
  ./vanblog.sh pack inspect <name>  # 查看单个 Pack 详情
  ./vanblog.sh pack add <name>      # 添加 Pack 本地覆盖
  ./vanblog.sh diagnose     # 诊断容器状态和资源使用

自动依赖:
  gum — Charm 出品的 TUI 工具,缺失时自动下载安装

数据目录: ${VANBLOG_DATA_PATH}
配置文件: ${VANBLOG_BASE_PATH}/docker-compose.yml
EOF
}

show_banner() {
    echo ""
    gum style \
        --border double \
        --padding "1 2" \
        --border-foreground 212 \
        --foreground 212 \
        --bold \
        " Vanblog 管理脚本 ${VANBLOG_SCRIPT_VERSION} "
}

show_menu() {
    show_banner
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
        "12. 诊断系统" \
        "13. Pack 管理" \
        "0. 退出")
    [[ -z "$choice" || "$choice" = "0. 退出" ]] && exit 0

    case "$choice" in
        "1. 安装 Vanblog")    install_vanblog ;;
        "2. 修改配置")        config_compose; before_show_menu ;;
        "3. 启动服务")        start_vanblog ;;
        "4. 停止服务")        stop_vanblog ;;
        "5. 重启服务")        restart_vanblog ;;
        "6. 更新镜像")        update_vanblog ;;
        "7. 查看日志")        show_log ;;
        "8. 备份数据")        backup_vanblog ;;
        "9. 恢复数据")        restore_vanblog ;;
        "10. 进入维护模式")   enter_maintenance ;;
        "11. 卸载 Vanblog")   uninstall_vanblog ;;
        "12. 诊断系统")       diagnose_vanblog ;;
        "13. Pack 管理")      pack_cli list; before_show_menu ;;
    esac
}

before_show_menu() {
    echo
    gum_ask "返回主菜单?" y && show_menu || exit 0
}

# --- 入口 ---
if [[ $EUID -ne 0 && "${VANBLOG_SKIP_ROOT_CHECK:-}" != "1" ]]; then
    gum_err "请使用 root 用户运行此脚本（测试环境可设 VANBLOG_SKIP_ROOT_CHECK=1）"
    exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
    gum_err "缺少 curl,请先安装"
    exit 1
fi

ensure_gum  # 自动安装 gum（如果缺失）
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
        pack)        shift; pack_cli "$@" ;;
        diagnose)    diagnose_vanblog 0 ;;
        -h|--help|help) show_usage ;;
        *)           show_usage; exit 1 ;;
    esac
else
    show_menu
fi
