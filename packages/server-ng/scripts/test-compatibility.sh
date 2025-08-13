#!/bin/bash

# VanBlog Server-NG 兼容性测试脚本
# 用于测试 v1 API 兼容层是否正常工作

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="http://localhost:3000"
TEST_TIMEOUT=30
TEST_RESULTS_FILE="./test-results/compatibility-test-$(date +%Y%m%d_%H%M%S).json"

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=()

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# 创建测试结果目录
mkdir -p "$(dirname "$TEST_RESULTS_FILE")"

# 测试函数
test_api() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local expected_status="$4"
    local expected_fields="$5"
    local post_data="$6"
    
    ((TOTAL_TESTS++))
    
    log_info "测试: $test_name"
    
    local start_time=$(date +%s.%N)
    local response_file="/tmp/api_response_$$"
    local headers_file="/tmp/api_headers_$$"
    
    # 构建 curl 命令
    local curl_cmd="curl -s -w '%{http_code}' -o '$response_file' -D '$headers_file' -m $TEST_TIMEOUT"
    
    if [[ "$method" == "POST" ]]; then
        curl_cmd="$curl_cmd -X POST -H 'Content-Type: application/json'"
        if [[ -n "$post_data" ]]; then
            curl_cmd="$curl_cmd -d '$post_data'"
        fi
    fi
    
    curl_cmd="$curl_cmd '$BASE_URL$endpoint'"
    
    # 执行请求
    local http_code
    http_code=$(eval "$curl_cmd" 2>/dev/null || echo "000")
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    # 检查 HTTP 状态码
    if [[ "$http_code" != "$expected_status" ]]; then
        log_error "HTTP 状态码不匹配: 期望 $expected_status, 实际 $http_code"
        ((FAILED_TESTS++))
        record_test_result "$test_name" "FAIL" "HTTP status mismatch: expected $expected_status, got $http_code" "$duration"
        cleanup_temp_files
        return 1
    fi
    
    # 检查响应内容
    if [[ ! -f "$response_file" ]]; then
        log_error "响应文件不存在"
        ((FAILED_TESTS++))
        record_test_result "$test_name" "FAIL" "Response file not found" "$duration"
        cleanup_temp_files
        return 1
    fi
    
    local response_content
    response_content=$(cat "$response_file")
    
    # 检查是否为有效 JSON
    if ! echo "$response_content" | jq . > /dev/null 2>&1; then
        log_error "响应不是有效的 JSON"
        ((FAILED_TESTS++))
        record_test_result "$test_name" "FAIL" "Invalid JSON response" "$duration"
        cleanup_temp_files
        return 1
    fi
    
    # 检查必需字段
    if [[ -n "$expected_fields" ]]; then
        IFS=',' read -ra FIELDS <<< "$expected_fields"
        for field in "${FIELDS[@]}"; do
            field=$(echo "$field" | xargs) # 去除空格
            if ! echo "$response_content" | jq -e "$field" > /dev/null 2>&1; then
                log_error "缺少必需字段: $field"
                ((FAILED_TESTS++))
                record_test_result "$test_name" "FAIL" "Missing required field: $field" "$duration"
                cleanup_temp_files
                return 1
            fi
        done
    fi
    
    log_success "$test_name (${duration}s)"
    ((PASSED_TESTS++))
    record_test_result "$test_name" "PASS" "" "$duration"
    
    cleanup_temp_files
    return 0
}

# 记录测试结果
record_test_result() {
    local test_name="$1"
    local status="$2"
    local error="$3"
    local duration="$4"
    
    local result="{"
    result="$result\"name\": \"$test_name\","
    result="$result\"status\": \"$status\","
    result="$result\"duration\": $duration,"
    result="$result\"timestamp\": \"$(date -Iseconds)\""
    if [[ -n "$error" ]]; then
        result="$result,\"error\": \"$error\""
    fi
    result="$result}"
    
    TEST_RESULTS+=("$result")
}

# 清理临时文件
cleanup_temp_files() {
    rm -f "/tmp/api_response_$$" "/tmp/api_headers_$$"
}

# 检查服务器状态
check_server() {
    log_info "检查服务器状态..."
    
    local max_attempts=10
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s "$BASE_URL/api/v2/health" > /dev/null 2>&1; then
            log_success "服务器运行正常"
            return 0
        fi
        
        sleep 2
        ((attempt++))
        log_info "等待服务器启动... ($attempt/$max_attempts)"
    done
    
    log_error "服务器未响应，请确保服务器正在运行"
    exit 1
}

# v1 API 兼容性测试
test_v1_compatibility() {
    log_info "=== 开始 v1 API 兼容性测试 ==="
    
    # 测试站点元数据
    test_api "v1 站点元数据" "GET" "/api/v1/public/meta" "200" ".data.version,.data.tags,.data.meta,.data.menus,.data.totalArticles"
    
    # 测试文章列表
    test_api "v1 文章列表" "GET" "/api/v1/public/getByOption?option=articles&page=1&pageSize=5" "200" ".data.articles,.data.total"
    
    # 测试分类列表
    test_api "v1 分类列表" "GET" "/api/v1/public/getByOption?option=categories" "200" ".data"
    
    # 测试标签列表
    test_api "v1 标签列表" "GET" "/api/v1/public/getByOption?option=tags" "200" ".data"
    
    # 测试时间线
    test_api "v1 时间线" "GET" "/api/v1/public/getTimeLineInfo" "200" ".data"
    
    # 测试搜索功能
    test_api "v1 搜索功能" "GET" "/api/v1/public/searchArticle?keyword=test" "200" ".data"
    
    # 测试自定义页面列表
    test_api "v1 自定义页面列表" "GET" "/api/v1/public/getAllCustomPages" "200" ".data"
    
    # 测试访问统计
    test_api "v1 访问统计" "GET" "/api/v1/public/getViewer" "200" ".data"
}

# v2 API 基础测试
test_v2_basic() {
    log_info "=== 开始 v2 API 基础测试 ==="
    
    # 测试健康检查
    test_api "v2 健康检查" "GET" "/api/v2/health" "200" ".status"
    
    # 测试站点信息
    test_api "v2 站点信息" "GET" "/api/v2/public/site-info" "200" ".success,.data"
    
    # 测试导航配置
    test_api "v2 导航配置" "GET" "/api/v2/public/navigation" "200" ".success,.data"
    
    # 测试文章列表
    test_api "v2 文章列表" "GET" "/api/v2/articles?page=1&pageSize=5" "200" ".success,.data.items,.meta.pagination"
    
    # 测试分类列表
    test_api "v2 分类列表" "GET" "/api/v2/categories" "200" ".success,.data"
    
    # 测试标签列表
    test_api "v2 标签列表" "GET" "/api/v2/tags" "200" ".success,.data"
}

# 性能测试
test_performance() {
    log_info "=== 开始性能测试 ==="
    
    local endpoints=(
        "/api/public/meta"
        "/api/public/article?page=1&pageSize=10"
        "/api/v2/public/site-info"
        "/api/v2/articles?page=1&pageSize=10"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local test_name="性能测试: $endpoint"
        log_info "$test_name"
        
        local start_time=$(date +%s.%N)
        local http_code
        http_code=$(curl -s -w '%{http_code}' -o /dev/null -m 10 "$BASE_URL$endpoint" || echo "000")
        local end_time=$(date +%s.%N)
        local duration=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
        
        ((TOTAL_TESTS++))
        
        if [[ "$http_code" == "200" ]]; then
            if (( $(echo "$duration < 2.0" | bc -l 2>/dev/null || echo "0") )); then
                log_success "$test_name (${duration}s)"
                ((PASSED_TESTS++))
                record_test_result "$test_name" "PASS" "" "$duration"
            else
                log_warning "$test_name 响应较慢 (${duration}s)"
                ((PASSED_TESTS++))
                record_test_result "$test_name" "PASS" "Slow response" "$duration"
            fi
        else
            log_error "$test_name 失败 (HTTP $http_code)"
            ((FAILED_TESTS++))
            record_test_result "$test_name" "FAIL" "HTTP $http_code" "$duration"
        fi
    done
}

# 错误处理测试
test_error_handling() {
    log_info "=== 开始错误处理测试 ==="
    
    # 测试不存在的文章
    test_api "v1 不存在的文章" "GET" "/api/public/article/nonexistent" "404" ".statusCode"
    
    # 测试不存在的 v2 端点
    test_api "v2 不存在的端点" "GET" "/api/v2/nonexistent" "404" ".success"
    
    # 测试无效的查询参数
    test_api "v1 无效查询参数" "GET" "/api/public/article?page=invalid" "200" ".data" # 应该使用默认值
    
    # 测试 POST 请求到 GET 端点
    test_api "v1 错误的请求方法" "POST" "/api/public/meta" "404" ".statusCode"
}

# 数据一致性测试
test_data_consistency() {
    log_info "=== 开始数据一致性测试 ==="
    
    # 获取 v1 和 v2 的文章总数
    local v1_response_file="/tmp/v1_meta_$$"
    local v2_response_file="/tmp/v2_articles_$$"
    
    curl -s "$BASE_URL/api/public/meta" > "$v1_response_file"
    curl -s "$BASE_URL/api/v2/articles?page=1&pageSize=1" > "$v2_response_file"
    
    if [[ -f "$v1_response_file" && -f "$v2_response_file" ]]; then
        local v1_total
        local v2_total
        
        v1_total=$(jq -r '.data.totalArticles // 0' "$v1_response_file" 2>/dev/null || echo "0")
        v2_total=$(jq -r '.meta.pagination.total // 0' "$v2_response_file" 2>/dev/null || echo "0")
        
        ((TOTAL_TESTS++))
        
        if [[ "$v1_total" == "$v2_total" ]]; then
            log_success "数据一致性检查: 文章总数一致 ($v1_total)"
            ((PASSED_TESTS++))
            record_test_result "数据一致性: 文章总数" "PASS" "" "0"
        else
            log_error "数据一致性检查: 文章总数不一致 (v1: $v1_total, v2: $v2_total)"
            ((FAILED_TESTS++))
            record_test_result "数据一致性: 文章总数" "FAIL" "v1: $v1_total, v2: $v2_total" "0"
        fi
    else
        log_error "数据一致性检查: 无法获取响应数据"
        ((FAILED_TESTS++))
        record_test_result "数据一致性: 文章总数" "FAIL" "Cannot get response data" "0"
    fi
    
    rm -f "$v1_response_file" "$v2_response_file"
}

# 生成测试报告
generate_report() {
    log_info "生成测试报告..."
    
    local report="{"
    report="$report\"timestamp\": \"$(date -Iseconds)\","
    report="$report\"summary\": {"
    report="$report\"total\": $TOTAL_TESTS,"
    report="$report\"passed\": $PASSED_TESTS,"
    report="$report\"failed\": $FAILED_TESTS,"
    report="$report\"success_rate\": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")"
    report="$report},"
    report="$report\"tests\": ["
    
    local first=true
    for result in "${TEST_RESULTS[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            report="$report,"
        fi
        report="$report$result"
    done
    
    report="$report]}"
    
    echo "$report" | jq . > "$TEST_RESULTS_FILE"
    
    log_success "测试报告已保存到: $TEST_RESULTS_FILE"
}

# 显示测试结果
show_results() {
    echo
    log_info "=== 测试结果汇总 ==="
    echo "总测试数: $TOTAL_TESTS"
    echo "通过: $PASSED_TESTS"
    echo "失败: $FAILED_TESTS"
    
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        local success_rate
        success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "成功率: ${success_rate}%"
    fi
    
    echo
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "所有测试通过！兼容性测试成功。"
        return 0
    else
        log_error "有 $FAILED_TESTS 个测试失败。请检查测试报告。"
        return 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
VanBlog Server-NG 兼容性测试脚本

用法: $0 [选项]

选项:
  -u, --url URL            服务器 URL (默认: http://localhost:3000)
  -t, --timeout SECONDS    请求超时时间 (默认: 30)
  -o, --output FILE        测试结果输出文件
  --v1-only               仅测试 v1 API
  --v2-only               仅测试 v2 API
  --performance           包含性能测试
  --error-handling        包含错误处理测试
  --data-consistency      包含数据一致性测试
  -h, --help              显示此帮助信息

示例:
  $0                                    # 运行所有测试
  $0 --v1-only                         # 仅测试 v1 API
  $0 --url http://example.com:3000     # 指定服务器 URL
  $0 --performance --data-consistency  # 包含性能和数据一致性测试

EOF
}

# 主函数
main() {
    local test_v1=true
    local test_v2=true
    local test_performance=false
    local test_error_handling=false
    local test_data_consistency=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--url)
                BASE_URL="$2"
                shift 2
                ;;
            -t|--timeout)
                TEST_TIMEOUT="$2"
                shift 2
                ;;
            -o|--output)
                TEST_RESULTS_FILE="$2"
                shift 2
                ;;
            --v1-only)
                test_v1=true
                test_v2=false
                shift
                ;;
            --v2-only)
                test_v1=false
                test_v2=true
                shift
                ;;
            --performance)
                test_performance=true
                shift
                ;;
            --error-handling)
                test_error_handling=true
                shift
                ;;
            --data-consistency)
                test_data_consistency=true
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
    
    # 检查依赖
    if ! command -v jq &> /dev/null; then
        log_error "缺少必要的命令: jq"
        log_info "请安装 jq: brew install jq (macOS) 或 apt-get install jq (Ubuntu)"
        exit 1
    fi
    
    if ! command -v bc &> /dev/null; then
        log_error "缺少必要的命令: bc"
        log_info "请安装 bc: brew install bc (macOS) 或 apt-get install bc (Ubuntu)"
        exit 1
    fi
    
    echo
    log_info "=== VanBlog Server-NG 兼容性测试 ==="
    log_info "服务器 URL: $BASE_URL"
    log_info "请求超时: ${TEST_TIMEOUT}s"
    log_info "结果文件: $TEST_RESULTS_FILE"
    echo
    
    # 检查服务器状态
    check_server
    
    # 运行测试
    if [[ "$test_v1" == "true" ]]; then
        test_v1_compatibility
    fi
    
    if [[ "$test_v2" == "true" ]]; then
        test_v2_basic
    fi
    
    if [[ "$test_performance" == "true" ]]; then
        test_performance
    fi
    
    if [[ "$test_error_handling" == "true" ]]; then
        test_error_handling
    fi
    
    if [[ "$test_data_consistency" == "true" ]]; then
        test_data_consistency
    fi
    
    # 生成报告和显示结果
    generate_report
    show_results
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi