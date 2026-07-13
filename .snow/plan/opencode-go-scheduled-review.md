# OpenCode Go Plan 定时代码审查方案调研

## Context

用户拥有 OpenCode Go Plan ($10/月)，包含 5 小时滚动时间窗口的用量配额。用户希望：

1. 以 `refs/` 为可产出内容的目录
2. 搭建一套本地/容器化运行的定时调度系统
3. 自动对近期代码改动进行 AI 代码审查
4. 用量感知：有剩余配额才触发，配额耗尽则跳过
5. 尽量使用现成开源方案，减少自建工作量

## 🔑 核心问题：OpenCode CLI 代码审查能力够用吗？

### 答案：✅ 完全够用，且是同类最优解

经过深入调研，发现 OpenCode **原生支持代码审查**，且有生产级实践：

| 证据                  | 说明                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **内置 Plan Agent**   | OpenCode 自带 `plan` agent，专门用于"分析代码和审查建议而不做任何代码修改"                     |
| **自定义 Agent 系统** | 可创建专用审查 agent（安全审计、性能审查、代码规范等），支持 model/temperature/permission 配置 |
| **多 Agent 并行审查** | 业界已有实践：Orchestrator + Frontend/Backend/DevOps 多专家并行审查                            |
| **CI/CD 生产使用**    | Martin Alderson 用 OpenCode 替换了 SaaS 代码审查工具，质量和成本都优于商业方案                 |
| **Provider 无关**     | 支持 75+ LLM provider，Go Plan 模型用完可无缝切换                                              |

### 最佳架构：Agent Oven + opencode-quota + **OpenCode 多 Agent 审查系统**

三个组件全 MIT/开源，零外部依赖，纯本地/容器运行。

## 调研结论

### 推荐架构：Agent Oven + opencode-quota + OpenCode 多 Agent 审查

```
┌──────────────────────────────────────────────────────┐
│  Agent Oven (Cron Scheduler)                         │
│  ┌──────────────────────────────────────────────────┐│
│  │  Job: "opencode-code-review"                     ││
│  │  schedule: "0 */6 * * *"  (每6小时)              ││
│  │  image: custom (node + opencode + git)           ││
│  │  command:                                        ││
│  │    1. opencode-quota show --json --threshold 5   ││
│  │       → 检查 Go Plan 剩余用量 > 5%               ││
│  │    2. git log --since="6 hours ago" --oneline    ││
│  │       → 获取近期改动                              ││
│  │    3. opencode run "review recent changes..."    ││
│  │       → 执行代码审查                              ││
│  │    4. 输出结果 → /refs/review-$(date).md          ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## 方案一：Agent Oven ⭐ 首选

| 维度           | 评价                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| **定位**       | "Cron for AI agents" — 专为 AI Agent 设计的定时调度器                                                   |
| **开源**       | ✅ MIT License                                                                                          |
| **容器化**     | ✅ 原生 Docker 隔离，每个 Job 独立容器运行                                                              |
| **定时调度**   | ✅ 标准 5 段 cron 语法，也支持一次性定时任务                                                            |
| **Agent 支持** | ✅ 内置 Claude Code pipeline；Python 镜像含 openai/anthropic SDK；Node 镜像含 @anthropic-ai/claude-code |
| **自定义 API** | ✅ 可在容器内调用任意 API/CLI，完全自由                                                                 |
| **自定义行为** | ✅ 通过 Shell 脚本在 command 中实现任意前置检查（配额检查 → 有则执行/无则跳过）                         |
| **配额感知**   | ✅ 结合 opencode-quota CLI 的 `--threshold` 实现前置检查                                                |
| **部署方式**   | `npm install -g agent-oven` + `agent-oven init`，支持 macOS (launchd) 和 Linux (systemd)                |
| **输出目录**   | ✅ volumes 挂载 `./refs:/refs`，结果直接写入 refs                                                       |
| **监控**       | ✅ TUI 终端界面，实时日志查看，运行状态追踪                                                             |

**关键配置示例**（jobs.json）：

```json
{
  "type": "docker",
  "id": "opencode-review",
  "name": "OpenCode Go Code Review",
  "image": "opencode-review:latest",
  "command": [
    "sh",
    "-c",
    "QUOTA=$(opencode-quota show --json --threshold 5 2>/dev/null); if [ $? -eq 0 ]; then opencode run 'Review recent git changes in this repo and write findings to /refs/review-$(date +%Y%m%d-%H%M).md'; else echo 'Quota exhausted, skipping.'; fi"
  ],
  "volumes": [
    "/Users/corn/Code/vanblog:/workspace:rw",
    "/Users/corn/Code/vanblog/refs:/refs:rw"
  ],
  "schedule": { "type": "cron", "cron": "0 */6 * * *" },
  "resources": { "timeout": 1800, "memory": "2g" },
  "enabled": true
}
```

**构建自定义 Docker 镜像**：

```dockerfile
FROM node:20-slim
RUN npm install -g @anthropic-ai/claude-code @slkiser/opencode-quota
RUN apt-get update && apt-get install -y git
WORKDIR /workspace
```

---

## 方案二：Switchboard

| 维度           | 评价                                                       |
| -------------- | ---------------------------------------------------------- |
| **定位**       | "Cron for AI coding agents" — TOML 配置驱动的 Agent 调度器 |
| **开源**       | ✅ 开源，自托管                                            |
| **容器化**     | ✅ Docker 隔离运行                                         |
| **定时调度**   | ✅ Cron 语法                                               |
| **Agent 支持** | ✅ Claude Code 及主流 coding agent                         |
| **自定义 API** | ⚠️ 通过 prompt/skills 配置，灵活性略低于直接脚本           |
| **自定义行为** | ⚠️ 配额检查需要额外脚本包装                                |
| **优势**       | TOML 配置极简、可复用 skills、工作流模板                   |
| **劣势**       | 较新项目（2025），社区/文档相对少                          |

**switchboard.toml 示例**：

```toml
[settings]
image_name = "switchboard-agent:latest"

[[agent]]
name = "opencode-reviewer"
schedule = "0 */6 * * *"
prompt = """
Check remaining OpenCode Go quota. If quota > 5%, run a code review
on recent git changes. Focus on: logic bugs, security issues, performance.
Write findings to /refs/review-{date}.md
"""
```

---

## 方案三：Kodus (专注代码审查)

| 维度           | 评价                                                           |
| -------------- | -------------------------------------------------------------- |
| **定位**       | 自托管 AI 代码审查平台                                         |
| **开源**       | ✅ AGPLv3                                                      |
| **容器化**     | ✅ Docker Compose 一键部署                                     |
| **代码审查**   | ✅ 专业级：多 Agent 并行（Bug/Security/Performance/KodyRules） |
| **定时调度**   | ❌ 无内置 cron，靠 webhook 触发或外部 cron 调用 CLI            |
| **自定义 API** | ✅ BYO LLM（OpenAI 兼容接口即可）                              |
| **配额感知**   | ❌ 需外部脚本配合                                              |
| **适用场景**   | 需要完整 PR 审查平台 + 自托管 + 数据主权                       |

> Kodus 适合作为审查引擎，但调度层仍需 Agent Oven 或 cron 触发。

---

## 方案四：Hermes Agent

| 维度           | 评价                                        |
| -------------- | ------------------------------------------- |
| **定位**       | 开源 AI Agent 框架（记忆+技能+cron+多平台） |
| **定时调度**   | ✅ 内置 cron job                            |
| **Agent 支持** | ✅ GitHub workflows、多平台                 |
| **容器化**     | ✅ 可容器化部署                             |
| **劣势**       | 更偏通用 Agent 框架，代码审查能力需自行编排 |

---

## 配额检查方案：opencode-quota

这是整个方案中**配额感知**的关键组件：

| 功能             | 说明                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| **CLI 检查**     | `opencode-quota show --json` 输出机器可读 JSON                         |
| **阈值判断**     | `--threshold 5` 当剩余配额 < 5% 时 exit code 1                         |
| **支持计划**     | OpenCode Go、Cursor、GitHub Copilot、OpenAI 等                         |
| **Go Plan 配置** | 需设置 `OPENCODE_GO_WORKSPACE_ID` + `OPENCODE_GO_AUTH_COOKIE` 环境变量 |

**Shell 集成示例**：

```bash
# 检查配额，有则执行，无则跳过
opencode-quota show --json --threshold 5 --provider opencode-go
if [ $? -eq 0 ]; then
  echo "✅ Quota available, starting review..."
  opencode run "review recent changes"
else
  echo "⏭️ Quota exhausted, skipping review."
fi
```

---

## 方案对比矩阵

| 维度             | Agent Oven  | Switchboard | Kodus      | Hermes    |
| ---------------- | ----------- | ----------- | ---------- | --------- |
| 定时调度         | ✅ Cron     | ✅ Cron     | ❌ 需外部  | ✅ Cron   |
| Docker 隔离      | ✅ 原生     | ✅ 原生     | ✅ Compose | ⚠️ 可配   |
| 代码审查能力     | ⚠️ 靠 Agent | ⚠️ 靠 Agent | ✅ 专业    | ⚠️ 靠编排 |
| 配额前置检查     | ✅ 脚本     | ⚠️ 需包装   | ❌         | ❌        |
| 开源协议         | MIT         | MIT         | AGPLv3     | 开源      |
| 成熟度           | ⭐⭐⭐      | ⭐⭐        | ⭐⭐⭐⭐   | ⭐⭐      |
| 学习成本         | 低          | 低          | 中         | 中高      |
| 与 OpenCode 集成 | ✅ CLI      | ✅ CLI      | ⚠️ API 层  | ⚠️ 需适配 |

---

## OpenCode 多 Agent 代码审查系统设计

基于 JP Caparas 的"Multi-Lens Review"方案和 Martin Alderson 的 CI/CD 实践，审查能力完全由 OpenCode 原生 Agent 系统提供：

### 审查 Agent 架构：1 Orchestrator + 3 Specialist

```
opencode run @review-lead
         │
         ├─ git diff → 判断涉及哪些领域
         │
         ├─ 并行调度 ─┬─ @review-frontend  (tsx/jsx/css)
         │            ├─ @review-backend   (go/api/db)
         │            └─ @review-devops    (Dockerfile/yaml/caddy)
         │
         └─ 汇总 → /refs/review-{timestamp}.md
```

### Agent 配置文件（放入 .opencode/agent/ 目录）

**review-lead.md** (Orchestrator)：

```markdown
---
description: "Multi-lens code review coordinator"
mode: subagent
permission:
  edit: deny
  bash: "git diff*": allow
  task: "*": deny "review-frontend": allow "review-backend": allow "review-devops": allow
---

Analyze git diff against main, categorize changes (frontend/backend/devops),
invoke only relevant specialist agents in parallel, synthesize findings.
Output to /refs/review-{date}.md
```

### 关键优势对比

| 对比维度   | OpenCode 多 Agent         | 外部审查工具 (Kodus 等)                 |
| ---------- | ------------------------- | --------------------------------------- |
| 审查引擎   | OpenCode 原生 Agent       | 需额外 Docker Compose (5+ 容器)         |
| 模型使用   | 直接用 Go Plan 模型 ✅    | 需配 API key，Go Plan 模型不直接可用 ❌ |
| 配额消耗   | 直接消耗 Go Plan 配额 ✅  | 无法消耗 Go Plan 配额 ❌                |
| 定制灵活性 | Agent markdown 即改即生效 | 需修改源码或配置文件                    |
| 多专家并行 | 原生 Task 并行调度        | 部分支持                                |
| 部署复杂度 | 单容器                    | Postgres+Mongo+RabbitMQ+...             |
| 开源协议   | MIT 全栈                  | AGPLv3                                  |

---

## 🏆 最终推荐（修订版：Go Plan API Key 可外部使用）

### 核心洞察

Go Plan 的 API key 可以在外部直接使用（OpenAI 兼容协议），因此**不限于 OpenCode CLI 内部调用**。这打开了使用更成熟的专业代码审查工具的可能性。

### 最成熟方案：Alibaba Open Code Review (OCR) + Agent Oven + opencode-quota

| 组件                               | 作用                 | 成熟度                                    |
| ---------------------------------- | -------------------- | ----------------------------------------- |
| **Alibaba Open Code Review (OCR)** | 专业代码审查引擎     | ⭐⭐⭐⭐⭐ 阿里内部 2 年+，数万开发者验证 |
| **Agent Oven**                     | Cron 定时调度        | ⭐⭐⭐⭐ MIT，Docker 原生                 |
| **opencode-quota**                 | Go Plan 配额前置检查 | ⭐⭐⭐⭐ MIT，支持 threshold 退出码       |

### 为什么是 OCR 而不是 PR-Agent / Kodus？

| 对比维度     | OCR                                   | PR-Agent                       | Kodus            |
| ------------ | ------------------------------------- | ------------------------------ | ---------------- |
| 设计理念     | **CLI-first**，任意 git diff          | PR workflow 中心（需 webhook） | PR workflow 中心 |
| 定时运行     | ✅ `ocr review --from main --to HEAD` | ⚠️ 需 PR URL                   | ⚠️ 需 PR 触发    |
| 全文件审计   | ✅ `ocr scan` 无 diff 也能审          | ❌                             | ❌               |
| 自定义 API   | ✅ custom provider (OpenAI 兼容)      | ✅                             | ✅               |
| Token 消耗   | **1/9** of Claude Code                | 标准                           | 标准             |
| 精度 (F1)    | **高于 Claude Code**                  | 标准                           | AST+LLM 混合     |
| 审查规则     | 内置 NPE/线程安全/XSS/SQL 注入        | 靠 prompt                      | 靠 prompt        |
| JSON 输出    | ✅ `--format json`                    | ✅                             | ✅               |
| CI/CD 集成   | ✅ GitHub Actions/GitLab CI 示例      | ✅                             | ✅               |
| GitHub Stars | ~3K (快速增长)                        | 10K+                           | ~1K              |
| 生产验证     | **阿里 2 年/数万开发者/百万缺陷**     | 广泛使用                       | 早期             |
| 许可证       | Apache 2.0                            | Apache 2.0                     | AGPLv3           |
| 定时适用性   | ⭐⭐⭐⭐⭐                            | ⭐⭐                           | ⭐⭐             |

### 结论

**PR-Agent 是 PR 审查之王，OCR 是 CLI 审查之王。** 对于"定时触发、无 PR 依赖"的场景，OCR 是唯一正确选择。

OCR 是阿里内部官方代码审查助手，服务数万开发者两年，发现数百万缺陷后开源。它的"确定性工程 + LLM Agent"混合架构在 benchmark 上比 Claude Code 精度更高、token 消耗仅 1/9。

### OCR 集成架构

```
┌─────────────────────────────────────────────────────────┐
│  Agent Oven (Cron Scheduler, MIT)                       │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Job: "ocr-code-review"                             ││
│  │  schedule: "0 */6 * * *"  (每6小时)                 ││
│  │  image: ocr-review:latest (node + ocr + git)        ││
│  │  command:                                           ││
│  │    1. opencode-quota show --json --threshold 5      ││
│  │       → Go Plan 剩余 > 5%?                          ││
│  │    2. [有配额] ocr review --from main --to HEAD \   ││
│  │         --format json --audience agent \             ││
│  │         --background "定时审查" \                    ││
│  │         > /refs/review-$(date +%Y%m%d-%H%M).json    ││
│  │    3. [无配额] echo "skipped" > /refs/skip.log       ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### OCR 配置（Go Plan API Key）

```bash
# 添加 Go Plan 为 custom provider（OpenAI 兼容协议）
ocr config set provider go-plan
ocr config set custom_providers.go-plan.url "https://api.opencode.ai/v1"
ocr config set custom_providers.go-plan.protocol openai
ocr config set custom_providers.go-plan.api_key "sk-go-plan-xxx"
ocr config set custom_providers.go-plan.model "go-plan-default"

# 测试连通性
ocr llm test

# 单次运行验证
ocr review --from main --to HEAD --preview   # 先看哪些文件会被审查
ocr review --from main --to HEAD             # 执行审查
```

### Dockerfile

```dockerfile
FROM node:20-slim
RUN npm install -g @alibaba-group/open-code-review @slkiser/opencode-quota
RUN apt-get update && apt-get install -y git
WORKDIR /workspace
```

### Agent Oven jobs.json 配置

```json
{
  "type": "docker",
  "id": "ocr-scheduled-review",
  "name": "OCR Scheduled Code Review",
  "image": "ocr-review:latest",
  "command": ["sh", "-c",
    "opencode-quota show --json --threshold 5 --provider opencode-go 2>/dev/null
     if [ $? -eq 0 ]; then
       echo '=== Review started ==='
       ocr review --from main --to HEAD --format json --audience agent > /refs/review-$(date +%Y%m%d-%H%M).json
       echo '=== Review complete ==='
     else
       echo '[SKIP] Go Plan quota exhausted at '$(date) >> /refs/quota-skip.log
     fi"
  ],
  "volumes": [
    "/Users/corn/Code/vanblog:/workspace:rw"
  ],
  "schedule": { "type": "cron", "cron": "0 */6 * * *" },
  "resources": { "timeout": 1800, "memory": "2g" },
  "enabled": true
}
```

### 两种运行模式

| 模式          | 命令                                  | 用途                           |
| ------------- | ------------------------------------- | ------------------------------ |
| **Diff 审查** | `ocr review --from main --to HEAD`    | 审查近期代码变更               |
| **全量审计**  | `ocr scan --max-tokens-budget 500000` | 全仓库深度审计（首次/周期性）  |
| **单目录**    | `ocr scan --path app/src`             | 审查特定目录                   |
| **预览模式**  | `ocr review --preview`                | 不消耗 token，看哪些文件会被审 |

---

## 参考链接

- Agent Oven: https://github.com/FRE-Studios/Agent-Oven
- Switchboard: https://switchboard-oss.net/
- opencode-quota: https://github.com/slkiser/opencode-quota
- OpenCode Go: https://opencode.ai/go
- Kodus: https://kodus.io/self-hosted-ai-code-review/
- CodeReview Agent: https://github.com/SuperscriptSystems/codereview-agent
- Hermes Agent: https://hermes-agent.ai/
