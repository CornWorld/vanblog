#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  demo-reset.sh — Demo 站定时重置(防 demo 公开账号被外部滥用)
#
#  动作: 定位 vanblog 容器(compose/裸 run 均可) → stop → 清空
#        宿主侧 /pb_data 绑定目录 → start → 跑 demo-setup.sh
#        (重建 demo 管理员 + allowedDomains + 种子文章)
#
#  部署: sg 上由 systemd timer 每日调用(见 docs/guide/demo.md);
#        亦可手动执行。⚠️ 会删光全部数据,demo 站专用,生产环境严禁。
#
#  依赖: docker;其余同 demo-setup.sh(curl/python3 在其内部检查)
#  用法: bash scripts/ops/demo-reset.sh
# ═══════════════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

# ── 自更新(修「宿主 scp 死副本」坑,2026-10-05)──────────────────────
# 每次重置前先从仓库分支拉最新 scripts/ + bench/ 覆盖本地副本,再 exec
# 新副本继续执行——重置逻辑与种子数据永远跟仓库走,不随宿主副本老化。
# 跳过条件:--no-selfupdate 参数,或 curl/tar 不可用(回退本地副本)。
SELFUPDATE_SKIP=0
for arg in "$@"; do
  case "$arg" in --no-selfupdate) SELFUPDATE_SKIP=1 ;; esac
done
if [ "$SELFUPDATE_SKIP" != 1 ] && command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
  DEMO_HOME="${VANBLOG_DEMO_HOME:-/opt/vanblog}"
  BRANCH="${VANBLOG_DEMO_REPO_BRANCH:-main-go}"
  TARBALL="${VANBLOG_DEMO_REPO_TARBALL:-https://github.com/CornWorld/vanblog/archive/refs/heads/${BRANCH}.tar.gz}"
  info "自更新 scripts/bench(分支 ${BRANCH})…"
  TMP=$(mktemp -d)
  if curl -sL --max-time 120 "$TARBALL" | tar xz -C "$TMP" --strip-components=1 2>/dev/null \
     && [ -f "$TMP/scripts/ops/demo-reset.sh" ] && [ -f "$TMP/bench/seed.mjs" ]; then
    mkdir -p "$DEMO_HOME"
    rm -rf "$DEMO_HOME/scripts" "$DEMO_HOME/bench"
    cp -a "$TMP/scripts" "$TMP/bench" "$DEMO_HOME/"
    rm -rf "$TMP"
    ok "自更新完成,切到新副本继续"
    exec bash "$DEMO_HOME/scripts/ops/demo-reset.sh" --no-selfupdate "$@"
  else
    warn "自更新失败(网络/仓库?),回退本地副本继续"
    rm -rf "$TMP"
  fi
fi

VANBLOG_BASE_PATH="${VANBLOG_BASE_PATH:-/var/vanblog}"

command -v docker >/dev/null 2>&1 || { err "缺少依赖: docker"; exit 1; }

# ── 定位容器与数据目录(逻辑与 demo-setup.sh 保持一致)─────────
dc() { cd "$VANBLOG_BASE_PATH" && docker compose "$@"; }
if CID=$(dc ps -q vanblog 2>/dev/null) && [ -n "$CID" ]; then
  VANBLOG_CONTAINER="$CID"
else
  VANBLOG_CONTAINER="${VANBLOG_DEMO_CONTAINER:-vanblog}"
  docker inspect "$VANBLOG_CONTAINER" >/dev/null 2>&1 \
    || { err "未找到 compose 服务 vanblog($VANBLOG_BASE_PATH)或容器 $VANBLOG_CONTAINER"; exit 1; }
fi

DATA_DIR=$(docker inspect "$VANBLOG_CONTAINER" --format \
  '{{range .Mounts}}{{if eq .Destination "/pb_data"}}{{.Source}}{{end}}{{end}}')
[ -n "$DATA_DIR" ] && [ -d "$DATA_DIR" ] \
  || { err "容器未绑定 /pb_data 到宿主目录(找不到数据目录,无法安全重置)"; exit 1; }

info "重置 demo 站: 容器 $VANBLOG_CONTAINER, 数据 $DATA_DIR"

# ── 停 → 清 → 起 ─────────────────────────────────────────────
info "停止容器…"
docker stop "$VANBLOG_CONTAINER" >/dev/null || { err "停止失败"; exit 1; }

info "清空数据目录…"
# 目录本身保留(保属主/权限),只清内容,含隐藏文件
find "$DATA_DIR" -mindepth 1 -delete || { err "清空失败(权限?)"; exit 1; }

info "启动容器…"
docker start "$VANBLOG_CONTAINER" >/dev/null || { err "启动失败"; exit 1; }

# ── 重新初始化(复用 demo-setup.sh 的就绪等待与全部步骤)─────────
exec bash "$SCRIPT_DIR/demo-setup.sh"
