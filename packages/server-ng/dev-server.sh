#!/bin/bash

# --- 配置 ---
PID_FILE=".vite.pid"
# 主日志文件，捕获所有标准输出和错误输出
LOG_FILE="vite-dev-server.log"
PORT=3050
HEALTH_CHECK_URL="http://localhost:${PORT}/api/v2/health"
HEALTH_CHECK_TIMEOUT=30

# --- 工具依赖检查 ---
command -v curl >/dev/null 2>&1 || { echo >&2 "错误：需要安装 'curl' 才能进行健康检查。"; exit 1; }

# --- 函数定义 ---

is_process_running() {
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null; then return 0; fi
  fi
  return 1
}

check_health() {
  HEALTH_STATUS=$(curl -s -f --connect-timeout 5 "$HEALTH_CHECK_URL")
  if [ $? -eq 0 ] && echo "$HEALTH_STATUS" | grep -q '"status":"ok"'; then
    return 0
  else
    return 1
  fi
}

start_server() {
  echo "正在启动开发服务器(pnpm run dev)..."
  # 确保使用你的项目实际的启动命令
  pnpm run dev > "$LOG_FILE" 2>&1 &

  PID=$!
  echo $PID > "$PID_FILE"

  echo "服务器已启动 (PID: $PID)。等待健康检查( $HEALTH_CHECK_URL )通过..."

  end_time=$((SECONDS + HEALTH_CHECK_TIMEOUT))
  while [ $SECONDS -lt $end_time ]; do
    if check_health; then
      echo "✅ 服务器已在端口 $PORT 成功启动并响应健康检查( $HEALTH_CHECK_URL )。"
      return 0
    fi
    sleep 3
    echo -n "."
  done

  echo
  echo "❌ 错误：服务器在 $HEALTH_CHECK_TIMEOUT 秒内未能进入健康状态。"
  echo "   请运行 'bash dev-server.sh logs' 检查日志。"
  kill $PID >/dev/null 2>&1
  rm "$PID_FILE"
  exit 1
}

stop_server() {
  if is_process_running; then
    PID=$(cat "$PID_FILE")
    echo "正在停止服务器 (PID: $PID)..."
    kill $PID > /dev/null 2>&1
    wait $PID 2>/dev/null
    rm "$PID_FILE"
    echo "服务器已停止。"
  else
    echo "服务器未在运行。"
  fi
}

# --- (重要) 已修正的日志检查函数 ---
check_dev_logs() {
    echo "--- 检查开发服务器日志 ---"

    if [ ! -f "$LOG_FILE" ]; then
        echo "主日志文件 '$LOG_FILE' 未找到。"
        return
    fi

    echo "正在分析文件: $LOG_FILE"

    # 在最近的 200 行日志中，不区分大小写地查找 "error" 关键字
    # -i: 忽略大小写
    # -C 3: 显示匹配行的前后3行，以便看到上下文
    ERRORS=$(tail -n 200 "$LOG_FILE" | grep -i -C 3 "error")

    if [ -n "$ERRORS" ]; then
        echo "在最近的日志中发现潜在的错误记录:"
        echo "------------------------------------"
        # 使用 echo 来保留换行和格式
        echo "$ERRORS"
        echo "------------------------------------"
    else
        echo "✅ 在最近的日志中未发现明确的错误记录。"
        echo "如果应用仍然不健康，请手动检查完整的日志文件 '$LOG_FILE'。"
    fi
}

# --- 主逻辑 ---
case "$1" in
  start)
    if is_process_running && check_health; then
      echo "✅ 服务器已在运行且健康。"
    else
      echo "服务器未运行或不健康，正在启动..."
      if is_process_running; then stop_server; sleep 1; fi
      start_server
    fi
    ;;
  stop)
    stop_server
    ;;
  restart)
    echo "正在重启服务器..."
    stop_server
    sleep 1
    start_server
    ;;
  status)
    if is_process_running; then
      echo -n "▶️ 进程正在运行。检查健康状况... "
      if check_health; then
        echo "✅ 健康"
        curl -s "$HEALTH_CHECK_URL" | sed 's/,/,\n  /g; s/[{}]//g; s/"//g' | awk 'NF'
      else
        echo "❌ 不健康 (服务无响应或响应错误)"
      fi
    else
      echo "❌ 服务器未运行。"
    fi
    ;;
  # (重要) 命令也更新了
  logs)
    check_dev_logs
    ;;
  *)
    echo "用法: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac

exit 0
