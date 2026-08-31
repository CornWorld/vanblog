#!/usr/bin/env bash
# =============================================================================
# backup-pbdata.sh — oci-sg 侧 PocketBase 活数据备份 → Cloudflare R2
#
# 为什么不直接 restic 备份 pb_data 目录:PocketBase 运行中 SQLite(WAL)文件级
# 拷贝无一致性保证。本脚本走平台自带的事务快照端点:
#   POST /api/vanblog/backups  →  PB 内部 CreateBackup 产出 zip(同步,201 返回 key)
#   GET  /api/vanblog/backups/{key}/download  →  拉取 zip
# 再由 restic 推 R2。
#
# 在 oci-sg 宿主运行(dev 容器端口映射到 localhost:8090;若 Syncthing folder
# 已忽略 vault/pb_data,本备份是 pb_data 的唯一异地副本)。
#
# 依赖:curl、restic、jq。
#
# 环境变量(必填):
#   PB_EMAIL / PB_PASSWORD        admin 账号(或 PB_PASSWORD_FILE 指向密码文件)
#   RESTIC_REPOSITORY             如 s3:https://<acct>.r2.cloudflarestorage.com/vanblog-pb
#   RESTIC_PASSWORD_FILE          restic 仓库口令文件
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   R2 token
# 可选:
#   PB_URL(默认 http://127.0.0.1:8090)
#   RESTIC_ENV_FILE   先 source 的环境文件(放 R2 凭据,避免进 shell history)
#   KEEP_SERVER=7     PB 服务器端保留份数(更旧的删除)
#
# cron 示例(oci-sg,每天 09:10,避开 gateway-gz 8:30 的 restic 并发窗口):
#   10 9 * * * /home/<user>/dev/workspaces/vanblog/scripts/ops/backup-pbdata.sh \
#     >> /home/<user>/backup-pbdata.log 2>&1
# =============================================================================
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
KEEP_SERVER="${KEEP_SERVER:-7}"

if [ -n "${RESTIC_ENV_FILE:-}" ]; then set -a; . "$RESTIC_ENV_FILE"; set +a; fi
if [ -n "${PB_PASSWORD_FILE:-}" ]; then PB_PASSWORD="$(cat "$PB_PASSWORD_FILE")"; fi
: "${PB_EMAIL:?需要 PB_EMAIL}"
: "${PB_PASSWORD:?需要 PB_PASSWORD}"
: "${RESTIC_REPOSITORY:?需要 RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD_FILE:?需要 RESTIC_PASSWORD_FILE}"

TMPDIR_BACKUP="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BACKUP"' EXIT

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# --- 1. 认证 ---
log "auth…"
TOKEN=$(curl -sf "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$PB_EMAIL\",\"password\":\"$PB_PASSWORD\"}" | jq -r .token)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { log "auth 失败"; exit 1; }
AUTH=(-H "Authorization: $TOKEN")

# --- 2. 触发事务快照(同步;大库时耐心等) ---
log "创建快照…"
NEW_KEY=$(curl -sf --max-time 600 -X POST "$PB_URL/api/vanblog/backups" "${AUTH[@]}" \
  | jq -r .key)
[ -n "$NEW_KEY" ] && [ "$NEW_KEY" != "null" ] || { log "创建快照失败"; exit 1; }
log "快照就绪: $NEW_KEY"

# --- 3. 下载并推 R2 ---
ZIP="$TMPDIR_BACKUP/$NEW_KEY"
curl -sf --max-time 600 "$PB_URL/api/vanblog/backups/$NEW_KEY/download" "${AUTH[@]}" -o "$ZIP"
log "下载完成: $(du -h "$ZIP" | cut -f1)"

restic backup "$ZIP" --tag pbdata --host oci-sg
log "restic backup 完成"

restic forget --tag pbdata --keep-daily 7 --keep-weekly 4 --prune
log "restic forget/prune 完成"

# --- 4. 服务器端按保留份数清理(新快照永不删) ---
if [ "$KEEP_SERVER" -gt 0 ]; then
  mapfile -t OLD < <(curl -sf "$PB_URL/api/vanblog/backups" "${AUTH[@]}" \
    | jq -r 'sort_by(.modified) | .[0:-'"$KEEP_SERVER"'] | .[].key')
  for key in "${OLD[@]:-}"; do
    [ -z "$key" ] && continue
    [ "$key" = "$NEW_KEY" ] && continue
    curl -sf -X DELETE "$PB_URL/api/vanblog/backups/$key" "${AUTH[@]}" >/dev/null \
      && log "服务器端删除旧快照: $key"
  done
fi

log "完成 ✓"
