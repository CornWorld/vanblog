#!/usr/bin/env bash

# VanBlog root dev server orchestrator
# References: packages/server-ng/dev-server.sh

set -euo pipefail

# --- Config ---
WEBSITE_PORT=${WEBSITE_PORT:-3003}
SERVERNG_PORT=${SERVERNG_PORT:-3050}
ADMIN_PORT=${ADMIN_PORT:-3002}
WALINE_PORT=${WALINE_PORT:-8360}

LOG_DIR=${LOG_DIR:-"./dev-logs"}
PID_DIR=${PID_DIR:-"${LOG_DIR}"}

WEBSITE_PID_FILE="${PID_DIR}/website.pid"
ADMIN_PID_FILE="${PID_DIR}/admin.pid"
CADDY_PID_FILE="${PID_DIR}/caddy.pid"

WEBSITE_LOG_FILE="${LOG_DIR}/website.log"
ADMIN_LOG_FILE="${LOG_DIR}/admin.log"
CADDY_LOG_FILE="${LOG_DIR}/caddy.log"

HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}

mkdir -p "${LOG_DIR}"

# --- Helpers ---
is_pid_running() {
  local pid="$1"
  if [ -z "${pid}" ]; then return 1; fi
  if ps -p "${pid}" > /dev/null 2>&1; then return 0; fi
  return 1
}

safe_kill() {
  local pid="$1"
  if is_pid_running "${pid}"; then
    kill "${pid}" >/dev/null 2>&1 || true
    wait "${pid}" 2>/dev/null || true
  fi
}

check_port() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_http_ok() {
  local url="$1"
  local end_time=$((SECONDS + HEALTH_CHECK_TIMEOUT))
  while [ $SECONDS -lt $end_time ]; do
    if curl -sfI --connect-timeout 2 "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    echo "."
  done
  echo
  return 1
}

# --- Website ---
start_website() {
  if [ -f "${WEBSITE_PID_FILE}" ] && is_pid_running "$(cat "${WEBSITE_PID_FILE}")"; then
    echo "Website already running (PID: $(cat "${WEBSITE_PID_FILE}"))."
  else
    echo "Starting Website on :${WEBSITE_PORT}..."
    (
      cd packages/website
      PORT="${WEBSITE_PORT}" \
      VAN_BLOG_WALINE_URL="http://127.0.0.1:${WALINE_PORT}" \
      VAN_BLOG_SERVER_URL="http://127.0.0.1:${SERVERNG_PORT}" \
      NEXT_PUBLIC_VANBLOG_SERVER_URL="http://127.0.0.1:${SERVERNG_PORT}" \
      pnpm exec next dev -p "${WEBSITE_PORT}" --hostname 0.0.0.0 . \
        > "$(pwd)/../../${WEBSITE_LOG_FILE}" 2>&1 &
      echo $! > "$(pwd)/../../${WEBSITE_PID_FILE}"
    )
  fi
  echo "Waiting for Website ready at http://localhost:${WEBSITE_PORT} "
  if wait_for_http_ok "http://localhost:${WEBSITE_PORT}/"; then
    echo "✅ Website ready."
  else
    echo "❌ Website not responding. See ${WEBSITE_LOG_FILE}."
  fi
}

stop_website() {
  if [ -f "${WEBSITE_PID_FILE}" ]; then
    local pid="$(cat "${WEBSITE_PID_FILE}")"
    echo "Stopping Website (PID: ${pid})..."
    safe_kill "${pid}"
    rm -f "${WEBSITE_PID_FILE}"
    echo "Website stopped."
  else
    echo "Website not running."
  fi
}

# --- Server-NG --- (delegate to its dev-server.sh)
start_serverng() {
  echo "Starting Server-NG dev on :${SERVERNG_PORT}..."
  (cd packages/server-ng && bash dev-server.sh start)
}

stop_serverng() {
  echo "Stopping Server-NG dev..."
  (cd packages/server-ng && bash dev-server.sh stop)
}

status_serverng() {
  (cd packages/server-ng && bash dev-server.sh status)
}

logs_serverng() {
  (cd packages/server-ng && bash dev-server.sh logs)
}

# --- Admin (Vite) ---
start_admin() {
  if [ -f "${ADMIN_PID_FILE}" ] && is_pid_running "$(cat "${ADMIN_PID_FILE}")"; then
    echo "Admin already running (PID: $(cat "${ADMIN_PID_FILE}"))."
  else
    echo "Starting Admin on :${ADMIN_PORT}..."
    (
      cd packages/admin
      pnpm exec vite --port "${ADMIN_PORT}" --host 0.0.0.0 \
        > "$(pwd)/../../${ADMIN_LOG_FILE}" 2>&1 &
      echo $! > "$(pwd)/../../${ADMIN_PID_FILE}"
    )
  fi
  echo "Waiting for Admin ready at http://localhost:${ADMIN_PORT} "
  if wait_for_http_ok "http://localhost:${ADMIN_PORT}/"; then
    echo "✅ Admin ready."
  else
    echo "❌ Admin not responding. See ${ADMIN_LOG_FILE}."
  fi
}

stop_admin() {
  if [ -f "${ADMIN_PID_FILE}" ]; then
    local pid="$(cat "${ADMIN_PID_FILE}")"
    echo "Stopping Admin (PID: ${pid})..."
    safe_kill "${pid}"
    rm -f "${ADMIN_PID_FILE}"
    echo "Admin stopped."
  else
    echo "Admin not running."
  fi
}

status_admin() {
  if [ -f "${ADMIN_PID_FILE}" ] && is_pid_running "$(cat "${ADMIN_PID_FILE}")"; then
    echo "Admin: RUNNING (PID: $(cat "${ADMIN_PID_FILE}") )"
  else
    echo "Admin: STOPPED"
  fi
}

logs_admin() {
  echo "--- Admin recent logs ---"
  if [ -f "${ADMIN_LOG_FILE}" ]; then
    tail -n 200 "${ADMIN_LOG_FILE}" || true
  else
    echo "No admin log."
  fi
}

# --- Caddy (dev) ---
start_caddy() {
  if [ -f "${CADDY_PID_FILE}" ] && is_pid_running "$(cat "${CADDY_PID_FILE}")"; then
    echo "Caddy already running (PID: $(cat "${CADDY_PID_FILE}"))."
  else
    if ! command -v caddy >/dev/null 2>&1; then
      echo "Error: caddy not found. Please install Caddy first."
      exit 1
    fi
    echo "Starting Caddy dev (config: Caddyfile.dev) on :80..."
    caddy run --config Caddyfile.dev > "${CADDY_LOG_FILE}" 2>&1 &
    echo $! > "${CADDY_PID_FILE}"
  fi
  echo "Waiting for Caddy to serve http://localhost/ "
  if wait_for_http_ok "http://localhost/"; then
    echo "✅ Caddy ready."
  else
    echo "❌ Caddy not responding. See ${CADDY_LOG_FILE}."
  fi
}

stop_caddy() {
  if [ -f "${CADDY_PID_FILE}" ]; then
    local pid="$(cat "${CADDY_PID_FILE}")"
    echo "Stopping Caddy (PID: ${pid})..."
    safe_kill "${pid}"
    rm -f "${CADDY_PID_FILE}"
    echo "Caddy stopped."
  else
    echo "Caddy not running."
  fi
}

status_caddy() {
  if [ -f "${CADDY_PID_FILE}" ] && is_pid_running "$(cat "${CADDY_PID_FILE}")"; then
    echo "Caddy: RUNNING (PID: $(cat "${CADDY_PID_FILE}") )"
  else
    echo "Caddy: STOPPED"
  fi
}

logs_caddy() {
  if [ -f "${CADDY_LOG_FILE}" ]; then
    echo "--- Caddy recent logs ---"
    tail -n 200 "${CADDY_LOG_FILE}" || true
  else
    echo "Caddy log not found: ${CADDY_LOG_FILE}"
  fi
}

# --- Orchestration ---
cmd_start() {
  start_serverng
  start_admin
  start_website
  start_caddy
}

cmd_stop() {
  stop_caddy
  stop_website
  stop_admin
  stop_serverng
}

cmd_restart() {
  cmd_stop
  sleep 1
  cmd_start
}

cmd_status() {
  echo "--- Status ---"
  status_serverng
  status_caddy
  status_admin
  if [ -f "${WEBSITE_PID_FILE}" ] && is_pid_running "$(cat "${WEBSITE_PID_FILE}")"; then
    echo "Website: RUNNING (PID: $(cat "${WEBSITE_PID_FILE}") )"
  else
    echo "Website: STOPPED"
  fi
  echo "Ports: WEBSITE=${WEBSITE_PORT}, SERVERNG=${SERVERNG_PORT}, ADMIN=${ADMIN_PORT}, WALINE=${WALINE_PORT}"
}

cmd_logs() {
  echo "--- Website recent logs ---"
  if [ -f "${WEBSITE_LOG_FILE}" ]; then tail -n 200 "${WEBSITE_LOG_FILE}"; else echo "No website log."; fi
  logs_serverng
  logs_admin
  logs_caddy
}

usage() {
  cat <<EOF
Usage: $0 {start|stop|restart|status|logs}

Environment variables:
  WEBSITE_PORT           Default: 3003
  SERVERNG_PORT          Default: 3050 (matches server-ng dev)
  ADMIN_PORT             Default: 3002
  WALINE_PORT            Default: 8360
  LOG_DIR                Default: ./dev-logs

Examples:
  WEBSITE_PORT=3001 SERVERNG_PORT=3050 $0 start
  $0 status
  $0 logs
  $0 stop
EOF
}

case "${1:-}" in
  start)
    cmd_start ;;
  stop)
    cmd_stop ;;
  restart)
    cmd_restart ;;
  status)
    cmd_status ;;
  logs)
    cmd_logs ;;
  *)
    usage ; exit 1 ;;
esac
