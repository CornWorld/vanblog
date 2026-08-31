#!/usr/bin/env sh
# agent-rpc-bridge.sh — 把平台 agent RPC 桥到容器外的宿主 omp。
#
# Manager spawn 本脚本作为"引擎"(engine.json: {"bin": ".../agent-rpc-bridge.sh"}),
# 参数与 stdio JSONL 语义完全透传;ssh 天然转发 stdio,宿主 omp --mode rpc
# 直接成为平台引擎。session-dir 重写:容器 /pb_data/agent-sessions/<id> →
# 宿主 ~/agent-bridge-sessions/<id>(会话文件属引擎侧,PB 只存元数据)。
#
# 依赖:容器内 openssh-client(缺失时自动 apk add);宿主 authorized_keys 里的
# agent-config/bridge-key 受限公钥(restrict, from=172.17.0.0/16)。
#
# 环境变量:
#   VANBLOG_AGENT_BRIDGE_HOST  默认 172.17.0.1(docker0 网关)
#   VANBLOG_AGENT_BRIDGE_DIR   宿主会话根,默认 agent-bridge-sessions
set -eu
USER_NAME="${VANBLOG_AGENT_BRIDGE_USER:-ubuntu}"
HOST="${VANBLOG_AGENT_BRIDGE_HOST:-172.17.0.1}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KEY="$ROOT/agent-config/bridge-key"
REMOTE_DIR="${VANBLOG_AGENT_BRIDGE_DIR:-agent-bridge-sessions}"
OMP_BIN="${VANBLOG_AGENT_BRIDGE_OMP:-/usr/bin/omp}"

SSH_BIN="$(command -v ssh || true)"
if [ -z "$SSH_BIN" ]; then
  apk add --no-cache openssh-client >/dev/null 2>&1 || true
  SSH_BIN="$(command -v ssh || true)"
fi
[ -n "$SSH_BIN" ] || { echo "bridge: no ssh client available" >&2; exit 127; }
[ -f "$KEY" ] || { echo "bridge: missing $KEY" >&2; exit 127; }

# Rewrite any caller-side absolute session-dir to a host-side engine path
# (the value after --session-dir → $REMOTE_DIR/<basename>), then pass all
# args through to the remote omp. Build the remote command as a quoted
# string — rebuilding "$@" with `set --` before iterating would iterate an
# already-emptied list (verified the hard way).
cmd_args=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "--session-dir" ]; then
    case "$arg" in
      /*) arg="$REMOTE_DIR/$(basename "$arg")" ;;
    esac
  fi
  cmd_args="$cmd_args '$arg'"
  prev="$arg"
done

exec "$SSH_BIN" -i "$KEY" \
  -o User="$USER_NAME" \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
  -o ConnectTimeout=15 \
  "$HOST" "mkdir -p '$REMOTE_DIR' && exec '$OMP_BIN' $cmd_args"
