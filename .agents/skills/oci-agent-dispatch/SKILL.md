---
name: oci-agent-dispatch
description: 把调查/验证/改码任务分派到 oci-sg 宿主 omp(与 dev 容器同树),给本机减负
---

# oci-agent-dispatch

用户要求任务跑远端算力、给本机减负时使用。宿主 omp 已就绪:配置 `~/.omp/agent/` 直接拷自 m4air(同凭据同模型,含 oauth 型)。

## 派任务

```bash
ssh oci-sg 'cd ~/dev/workspaces/vanblog && omp -p --model zhipu-coding-plan/glm-5.3-flash "<任务>"'
# 重活换 glm-5.3;长会话 --session-id <id> 或 -c;会话文件在 ~/.omp/agent/,可与 m4air 互拷转移
```

## 检查清单

1. 宿主 omp 干活(状态持久);容器内 pi 是平台产品侧,不用于开发分派
2. 宿主工作区与容器 `/app` 同一棵树——改码即时可见;但 **receiveonly 不回流 m4air**,产物用 git 或 scp 拉回
3. 跑验证先等同步:`node scripts/dev/wait-sync.mjs && make test`

## 禁止

- 在容器 `/workspace` 干活(镜像快照死副本,活树是 `/app`)
- 凭据轮换后重新从 m4air 拷 `~/.omp/agent/{config.yml,agent.db}`(agent.db 用 `sqlite3 … .backup` 导出),不要手改远端配置
