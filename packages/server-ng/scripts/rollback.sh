#!/bin/bash

# VanBlog Server-NG 回滚脚本
# 用于从 v2 回滚到 v1 版本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为 root 用户
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "不建议以 root 用户运行此脚本"
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 检查必要的命令
check_dependencies() {
    local deps=("node" "npm" "mongo" "mongorestore")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "缺少必要的命令: $dep"
            exit 1
        fi
    done
}

# 检查备份文件
check_backup() {
    local backup_dir="$1"
    if [[ ! -d "$backup_dir" ]]; then
        log_error "备份目录不存在: $backup_dir"
        exit 1
    fi
    
    if [[ ! -d "$backup_dir/mongodb" ]]; then
        log_error "MongoDB 备份不存在: $backup_dir/mongodb"
        exit 1
    fi
    
    if [[ ! -f "$backup_dir/config.yaml" ]]; then
        log_error "配置文件备份不存在: $backup_dir/config.yaml"
        exit 1
    fi
    
    log_success "备份文件检查通过"
}

# 停止 Server-NG 服务
stop_server_ng() {
    log_info "停止 Server-NG 服务..."
    
    # 检查是否有运行的进程
    if pgrep -f "server-ng" > /dev/null; then
        log_info "发现运行中的 Server-NG 进程，正在停止..."
        pkill -f "server-ng" || true
        sleep 2
    fi
    
    # 使用 dev-server.sh 停止
    if [[ -f "./dev-server.sh" ]]; then
        bash ./dev-server.sh stop || true
    fi
    
    # 检查端口占用
    if lsof -i :3000 > /dev/null 2>&1; then
        log_warning "端口 3000 仍被占用，尝试强制停止..."
        lsof -ti :3000 | xargs kill -9 || true
        sleep 1
    fi
    
    log_success "Server-NG 服务已停止"
}

# 恢复 MongoDB 数据
restore_mongodb() {
    local backup_dir="$1"
    local db_name="${2:-vanBlog}"
    
    log_info "恢复 MongoDB 数据..."
    
    # 检查 MongoDB 连接
    if ! mongo --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; then
        log_error "无法连接到 MongoDB，请确保 MongoDB 服务正在运行"
        exit 1
    fi
    
    # 备份当前数据库（以防万一）
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local current_backup="./backup/current_${timestamp}"
    mkdir -p "$current_backup"
    
    log_info "备份当前数据库到: $current_backup"
    mongodump --db "$db_name" --out "$current_backup" || {
        log_warning "当前数据库备份失败，但继续恢复过程"
    }
    
    # 删除当前数据库
    log_info "删除当前数据库: $db_name"
    mongo "$db_name" --eval "db.dropDatabase()" || {
        log_error "删除当前数据库失败"
        exit 1
    }
    
    # 恢复备份数据
    log_info "从备份恢复数据库: $backup_dir/mongodb"
    mongorestore --db "$db_name" "$backup_dir/mongodb/$db_name" || {
        log_error "数据库恢复失败"
        exit 1
    }
    
    log_success "MongoDB 数据恢复完成"
}

# 恢复配置文件
restore_config() {
    local backup_dir="$1"
    local server_dir="$2"
    
    log_info "恢复配置文件..."
    
    # 备份当前配置
    if [[ -f "$server_dir/config.yaml" ]]; then
        local timestamp=$(date +"%Y%m%d_%H%M%S")
        cp "$server_dir/config.yaml" "$server_dir/config.yaml.backup.$timestamp"
        log_info "当前配置已备份为: config.yaml.backup.$timestamp"
    fi
    
    # 恢复配置文件
    cp "$backup_dir/config.yaml" "$server_dir/config.yaml" || {
        log_error "配置文件恢复失败"
        exit 1
    }
    
    log_success "配置文件恢复完成"
}

# 恢复静态文件
restore_static_files() {
    local backup_dir="$1"
    local static_path="$2"
    
    if [[ -d "$backup_dir/static" && -n "$static_path" ]]; then
        log_info "恢复静态文件..."
        
        # 创建静态文件目录
        mkdir -p "$static_path"
        
        # 备份当前静态文件
        if [[ -d "$static_path" && "$(ls -A $static_path)" ]]; then
            local timestamp=$(date +"%Y%m%d_%H%M%S")
            local current_static_backup="./backup/static_current_$timestamp"
            mkdir -p "$current_static_backup"
            cp -r "$static_path"/* "$current_static_backup/" || true
            log_info "当前静态文件已备份到: $current_static_backup"
        fi
        
        # 恢复静态文件
        cp -r "$backup_dir/static"/* "$static_path/" || {
            log_error "静态文件恢复失败"
            exit 1
        }
        
        log_success "静态文件恢复完成"
    else
        log_info "跳过静态文件恢复（备份不存在或路径未指定）"
    fi
}

# 启动 v1 服务
start_v1_server() {
    local server_dir="$1"
    
    log_info "启动 v1 服务..."
    
    cd "$server_dir"
    
    # 检查依赖
    if [[ ! -d "node_modules" ]]; then
        log_info "安装 v1 服务依赖..."
        npm install || {
            log_error "依赖安装失败"
            exit 1
        }
    fi
    
    # 构建项目
    log_info "构建 v1 服务..."
    npm run build || {
        log_error "项目构建失败"
        exit 1
    }
    
    # 启动服务
    log_info "启动 v1 服务..."
    npm run start:prod &
    
    # 等待服务启动
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s http://localhost:3000/api/public/meta > /dev/null 2>&1; then
            log_success "v1 服务启动成功"
            return 0
        fi
        
        sleep 2
        ((attempt++))
        log_info "等待服务启动... ($attempt/$max_attempts)"
    done
    
    log_error "v1 服务启动超时"
    return 1
}

# 验证回滚结果
verify_rollback() {
    log_info "验证回滚结果..."
    
    # 检查 API 响应
    local api_response
    api_response=$(curl -s http://localhost:3000/api/public/meta || echo "")
    
    if [[ -n "$api_response" ]]; then
        log_success "API 响应正常"
    else
        log_error "API 响应异常"
        return 1
    fi
    
    # 检查数据库连接
    if mongo --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; then
        log_success "数据库连接正常"
    else
        log_error "数据库连接异常"
        return 1
    fi
    
    log_success "回滚验证通过"
}

# 清理 v2 数据
cleanup_v2_data() {
    local cleanup="$1"
    
    if [[ "$cleanup" == "true" ]]; then
        log_info "清理 v2 数据..."
        
        # 删除 SQLite 数据库
        if [[ -f "./data/vanblog.db" ]]; then
            rm -f "./data/vanblog.db"
            log_info "已删除 SQLite 数据库"
        fi
        
        # 删除 v2 上传文件
        if [[ -d "./data/uploads" ]]; then
            rm -rf "./data/uploads"
            log_info "已删除 v2 上传文件"
        fi
        
        # 删除 v2 日志
        if [[ -d "./logs" ]]; then
            rm -rf "./logs"
            log_info "已删除 v2 日志文件"
        fi
        
        log_success "v2 数据清理完成"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
VanBlog Server-NG 回滚脚本

用法: $0 [选项]

选项:
  -b, --backup-dir DIR     备份目录路径 (必需)
  -s, --server-dir DIR     v1 服务器目录路径 (默认: ../server)
  -d, --database NAME      数据库名称 (默认: vanBlog)
  -p, --static-path PATH   静态文件路径
  -c, --cleanup            清理 v2 数据
  -y, --yes                自动确认所有操作
  -h, --help               显示此帮助信息

示例:
  $0 -b ./backup -s ../server
  $0 --backup-dir ./backup --cleanup --yes

EOF
}

# 主函数
main() {
    local backup_dir=""
    local server_dir="../server"
    local database_name="vanBlog"
    local static_path=""
    local cleanup="false"
    local auto_confirm="false"
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--backup-dir)
                backup_dir="$2"
                shift 2
                ;;
            -s|--server-dir)
                server_dir="$2"
                shift 2
                ;;
            -d|--database)
                database_name="$2"
                shift 2
                ;;
            -p|--static-path)
                static_path="$2"
                shift 2
                ;;
            -c|--cleanup)
                cleanup="true"
                shift
                ;;
            -y|--yes)
                auto_confirm="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 检查必需参数
    if [[ -z "$backup_dir" ]]; then
        log_error "必须指定备份目录 (-b|--backup-dir)"
        show_help
        exit 1
    fi
    
    # 转换为绝对路径
    backup_dir=$(realpath "$backup_dir")
    server_dir=$(realpath "$server_dir")
    
    # 显示操作信息
    echo
    log_info "=== VanBlog Server-NG 回滚操作 ==="
    log_info "备份目录: $backup_dir"
    log_info "服务器目录: $server_dir"
    log_info "数据库名称: $database_name"
    log_info "静态文件路径: ${static_path:-未指定}"
    log_info "清理 v2 数据: $cleanup"
    echo
    
    # 确认操作
    if [[ "$auto_confirm" != "true" ]]; then
        log_warning "此操作将:"
        echo "  1. 停止 Server-NG 服务"
        echo "  2. 恢复 MongoDB 数据库"
        echo "  3. 恢复配置文件"
        echo "  4. 恢复静态文件 (如果指定)"
        echo "  5. 启动 v1 服务"
        if [[ "$cleanup" == "true" ]]; then
            echo "  6. 清理 v2 数据"
        fi
        echo
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "操作已取消"
            exit 0
        fi
    fi
    
    # 执行回滚操作
    log_info "开始回滚操作..."
    
    check_permissions
    check_dependencies
    check_backup "$backup_dir"
    
    stop_server_ng
    restore_mongodb "$backup_dir" "$database_name"
    restore_config "$backup_dir" "$server_dir"
    
    if [[ -n "$static_path" ]]; then
        restore_static_files "$backup_dir" "$static_path"
    fi
    
    start_v1_server "$server_dir"
    verify_rollback
    
    cleanup_v2_data "$cleanup"
    
    echo
    log_success "=== 回滚操作完成 ==="
    log_info "v1 服务已启动，访问地址: http://localhost:3000"
    log_info "API 文档地址: http://localhost:3000/swagger"
    
    if [[ "$cleanup" != "true" ]]; then
        log_info "v2 数据已保留，如需清理请使用 --cleanup 选项"
    fi
    
    echo
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi