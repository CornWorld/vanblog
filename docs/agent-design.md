# 内置 Agent 设计:pi 编码代理 + Zen free 模型 + 需求方嵌入入口

> **依据**:完整选型调研见 [`refs/agent-platform-selection.md`](../refs/agent-platform-selection.md)(调研/竞品对比,不进 docs);本文是**决策落地 + 现状实现**,供 agent 动手前读。
>
> **核心原则**:
>
> - **官方 agent = dev 容器 + pi + vanblog skill 包**(不自研 golang agent 引擎)
> - **默认 LLM 走 OpenCode Zen free 模型**(0 API key、0 登录,启动时动态解析)
> - **agent 入口是「各需求方嵌入」而非全局侧边栏主动入口**
> - **支持多 profile sys prompt**(迁移/主题/pack/升级等场景各有专属提示词)

> - **认证强度:仅 admin**(PB 是唯一认证边界,Go 直接管理 pi 子进程)
> - **session 由 PB 持久化元数据**(Go 只缓存运行时,pi 保存对话历史)

---

## 1. 为什么要内置 agent

VanBlog 的 dev 容器本质是「面向用户的可编程环境」。用户需要用 AI 完成四类任务:

| 场景                       | 用户诉求                             |
| -------------------------- | ------------------------------------ |
| 开发新主题 / 微调已有内容  | 「帮我看主题结构,给定制建议」        |
| 迁移 mereithh VanBlog 数据 | 「把旧站数据迁过来」                 |
| 升级 / 降级版本            | 「升级后帮我检查 override 是否适配」 |
| 开发 Pack 扩展能力         | 「帮我写一个 PoW 防刷 pack」         |

用户画像分两类(参考 git-for-windows 的 msys2 模型):

- **有 agent 环境的用户**(Claude Code / Snow CLI / Cursor)→ 自带完整 agent,只需领域能力
- **没有 agent 环境的用户** → 需要一个「0 配置、开箱即用」的官方入口

**关键决策**:官方 agent 不造引擎,而是「pi(现成 agent)+ vanblog skill(领域知识)+ Zen free(0 配置 LLM)」三件套装进 dev 容器。高手平移能力走 MCP/skill,小白直接 `pi` 或 admin 里的入口。

## 2. 为什么是 pi(而非自研 / opencode)

| 方案                           | 结论    | 否决/入选原因                                                                           |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| **自研 golang agent**          | ❌ 放弃 | 完整 agent(tool-calling loop)与 Claude Code / Snow CLI 完全重复,且 LLM key 谁出无法自洽 |
| **anomalyco/opencode**         | ⚠️ 备选 | star 是 pi 的 2 倍,但内置权限系统 + 更重的插件体系,与「精简」冲突                       |
| gemini-cli / codex / qwen-code | ❌ 排除 | 模型绑定(各自厂商),违背「模型无关」                                                     |
| plandex / aider                | ❌ 排除 | 无现代 skill/extension 生态                                                             |
| **earendil-works/pi**          | ✅ 入选 | 极简核心(不占资源)、SKILL.md 原生、75+ provider 模型无关、容器即沙盒、RPC mode 可嵌入   |

> pi 的三个决定性优势:① 极简 npm 包,dev 容器本有 node runtime,零额外开销;② Agent Skills 标准与 vanblog docs-driven 理念同构;③ `--mode rpc` 有官方嵌入方案,后续网页 UI 不是野路子。

## 3. Zen free 模型:0 配置的关键

### 3.1 为什么默认 Zen free

用户起 dev 容器即用,**不需要注册、不需要 API key、不需要付费**。Zen 的 free 模型($0/1M tokens)恰好满足——skill 编排的中小 agentic 循环够用。

### 3.2 认证陷阱(已验证)

Zen free 模型**不能带任何 Authorization header**(任何 key 都返回 401),但 pi 的 openai-completions provider 只要配了 apiKey 就强制注入 header,且要求 apiKey 非空才暴露模型。**`authHeader: false` 是死字段,实测仍 401。**

三方冲突:

- pi 要求「必须有 key」→ 给了 key 就发 header
- Zen 要求「绝不能有 key」→ 有 key 就 401
- 无任何配置能解开

**解法**:`scripts/pi-zen-proxy.mjs` 提供一个独立的反向代理,剥掉 Authorization header 再转发 Zen。pi 配假 key(满足 pi),baseUrl 指向本地 proxy(满足 Zen)。若未来 pi 去掉 apiKey 强制要求,proxy 可删。

### 3.3 模型动态解析

Zen 模型列表**会轮换**(promo 模型下架)。模型名不能硬编码。`scripts/resolve-zen-free-models.mjs` 启动时 `GET /zen/v1/models` → filter `-free` 后缀 → 选当前可用最佳模型写入配置。

## 4. 系统架构

```
┌─ 官方 agent(0 配置入口,dev 容器内)─────────────────┐
│  dev 容器(VANBLOG_MODE=dev)                          │
│  = 天然 sandbox + pi + vanblog skill 包               │
│                                                       │
│  用户: docker exec pi / admin 内嵌入口                │
│  默认 LLM: OpenCode Zen free(0 key)                  │
│  能力:   skill 编排 → CLI 脚本(迁移/升级/主题)       │
│  知识:   skill 只做编排,领域知识读 docs/             │
└───────────────────────────────────────────────────────┘

┌─ 宿主机 agent(面向有 agent 环境的用户)──────────────┐
│  Claude Code / Snow CLI / Cursor / ...               │
│  = 通过 MCP 获得 vanblog 领域能力                     │
│  文件: volume 映射 / docker exec                     │
└───────────────────────────────────────────────────────┘

共享层: vault/internal/* (领域逻辑唯一实现)
        docs/ (权威知识源,skill 指向它)
```

### 4.1 Web 接入链路

```
浏览器(admin UI) → PB /api/vanblog/agent/chat (admin-only 认证)
  → Go agent manager
  → 每个 PB session 独占一个 pi --mode rpc 子进程
  → `scripts/pi-zen-proxy.mjs` (:4330, 剥 Authorization)
  → Zen free 模型
  → SSE 流式返回 pi 事件
```

**关键安全设计**:

- Go 只允许管理员访问 agent 路由,**PB 是唯一认证边界**——pi 子进程不暴露网络端口,Caddy 无需新增规则(`/api/*` 已系统路由到 PB)
- `/api/vanblog/agent/chat` 校验 `e.Auth.GetString("role") == "admin"`,非 admin 返回 403
- 不经 Caddy 直连 pi,避免「任何访客驱动你的 agent」风险

## 5. 入口形态:需求方嵌入 + 多 profile

> **产品决策**(2026-08):agent **不是** admin 侧边栏的主动入口,而是**在各需求方嵌入**。

### 5.1 为什么不放全局侧边栏

- 侧边栏主动入口会**暗示「agent 是常驻功能」**,但 agent 是「任务型助手」——用户只在特定场景需要
- 全局入口割裂了「场景上下文」:用户在迁移页面,却要点一个全局 agent 按钮,再手动描述上下文
- 需求方嵌入让 agent **天生带上下文**:迁移页面里的 agent 入口,自动带「迁移」profile

### 5.2 各需求方入口 + profile

| 需求方页面            | 嵌入入口         | 对应 profile(system prompt)               |
| --------------------- | ---------------- | ----------------------------------------- |
| `/admin/migrate`      | 「AI 迁移助手」  | `migration`:只谈数据迁移,读 docs 迁移章节 |
| `/admin/themes`(如有) | 「AI 主题助手」  | `theme`:主题开发/定制/override 适配       |
| `/admin/packs`(如有)  | 「AI Pack 助手」 | `pack`:pack 结构/开发/前端注入            |
| `/admin/agent`        | 通用入口         | `general`:综合助手,可自由提问             |

**多 profile sys prompt** = 同一 chat 端点,不同预设 system prompt。实现上,`/api/vanblog/agent/chat` 的请求体增加可选 `profile` 字段,后端映射到对应 prompt 注入 pi 的首条上下文。preset 提示词(agent.astro 里的快捷任务)与 profile 一一对应。

### 5.3 实现现状

- ✅ `vault/internal/agent/agent.go` — PB handler,admin-only + SSE 代理
- ✅ `app/src/pages/admin/agent.astro` — 通用聊天页 + 6 个快捷任务(主题定制/pack 开发/升级/排查/优化/性能)
- ⏳ 各需求方页面嵌入 + profile 字段区分(profile 目前为单一 general)
- ⏳ admin 侧边栏**不加** agent 入口(按本决策)

## 6. 文件与命令

| 文件                                                      | 作用                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `scripts/resolve-zen-free-models.mjs`                     | 动态解析 Zen free 模型(启动时调用)                            |
| `scripts/init-pi-config.mjs`                              | 写 pi 全局配置(models.json/trust/settings)                    |
| `vault/internal/agent/agent.go`                           | PB session 元数据 + Go 直接管理 pi 原生 RPC 子进程 + SSE 透传 |
| `scripts/test-agent-rpc.sh`                               | Go + pi 原生 RPC smoke/E2E 测试                               |
| `scripts/pi-zen-proxy.mjs`                                | Zen auth-stripping proxy(:4330)                               |
| `vault/pb_migrations/1783600000_create_agent_sessions.go` | agent_sessions collection                                     |
| `vault/internal/agent/agent.go`                           | PB `/api/vanblog/agent/chat`(admin-only + SSE)                |
| `app/src/pages/admin/agent.astro`                         | admin 聊天 UI                                                 |
| `.agents/skills/vanblog/SKILL.md`                         | pi 加载的 dev skill(编排,指向 docs/)                          |
| `.pi/settings.json`                                       | pi 项目配置(Zen 模型占位符)                                   |

```bash
# dev 容器内直接用 pi
pi                    # 交互模式
pi -p "帮我 review"   # 单次提问

# 通过 API(admin token)
curl -X POST /api/vanblog/agent/chat -H 'Authorization: Bearer <token>' \
  -d '{"message":"...", "profile":"migration"}'
```

## 7. 已知限制与后续

| 项目             | 状态                                                           |
| ---------------- | -------------------------------------------------------------- |
| Zen free 限流    | 分钟级限流,大 agentic 循环受影响;skill 编排的中小循环够用      |
| Zen free context | 小于付费版;vanblog 单仓场景大概率够                            |
| 模型轮换         | 动态解析已规避                                                 |
| 多 profile       | profile 字段已预留,各需求方嵌入待实现                          |
| pi session       | PB `agent_sessions` 保存元数据,pi `--session-dir` 保存对话历史 |

## 8. 两层评价与 Artifact 存档

Pi 生成 pack 的测试流程采用**两层评价** + **artifact 存档**架构,确保每次 agent 运行的结果可复现、可审计、可重新评估。

### 8.1 架构

```
┌─ Layer 1: 现场生成 (test-pi-pack.sh) ──────────────────────────┐
│  1. Build dev image (或 --no-build 跳过)                        │
│  2. 启动 dev 容器,挂载空 user-packs 卷                          │
│  3. 等待 PB 健康 + pi 就绪                                      │
│  4. docker exec pi -p "<prompt>" --approve 现场创建 pack         │
│  5. 存档: 复制 pack 产物 + 容器日志 + 转录文本到 artifact 目录   │
│  6. 调用 evaluator 对 artifact 做第二层评价                      │
│  7. 按 --cleanup/--keep-evidence 决定是否清理容器                │
└──────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─ Layer 2: 独立评价 (evaluate-agent-pack.mjs) ───────────────────┐
│  静态检查 (无需 Docker):                                          │
│    • pack.json 存在、JSON 合法、name/version/frontend 字段正确     │
│    • hooks/*.pb.js 存在,包含 challenge/verify 路由引用            │
│    • frontend/pow-guard.js 存在,含 localStorage/overlay/cache    │
│                                                                   │
│  运行时检查 (启动临时 Docker 容器,挂载 artifact 只读):             │
│    • PB 健康检查                                                  │
│    • GET /api/vanblog/pow-guard/challenge → {challenge,difficulty}│
│    • PoW 求解 (SHA-256 leading zeros, node crypto 实现)           │
│    • 正样例: POST verify 正确 nonce → token                       │
│    • 负样例: POST verify 错误 nonce → 拒绝                        │
│    • 首页注入: GET / 含 pow-guard.js 脚本标签                     │
│                                                                   │
│  输出: score.json (status/score/static/runtime 清单)              │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 关键设计

- **两层分离**:Layer 1 只管现场生成 + 存档;Layer 2 只看 artifact,不依赖 layer 1 的容器状态。可在任意时间对同一 artifact 重新运行 evaluator。
- **Artifact 永远不删**:即使 pi 超时/失败,artifact 目录仍保留初始存档(transcript + container.log + 部分产物),evaluator 仍被调用并输出报告。
- **AGENT_TIMEOUT**:pi 生成时设置 `AGENT_TIMEOUT` 环境变量(默认 300s),同时外部由 shell 脚本强制 kill 超时进程。超时后 artifact 不删除,转 evaluator。
- **Evaluator 不崩溃**:对不完整的 artifact(缺少 pack.json 等)不会崩溃,而是输出 `status: "incomplete"` 的报告。
- **Evaluator 不写提示词**:evaluator 的检查规则不出现在 pi prompt / env / argv 中,保证 pi 生成时不知道评价标准。

### 8.3 Artifact 目录结构

```
.snow/artifacts/<run-id>/
├── run.json          # 运行元数据:时间戳、镜像、参数、pi 状态
├── artifact/         # 完整 pack 产物(从 user-packs 卷复制)
│   └── pow-guard/
│       ├── pack.json
│       ├── hooks/pow-guard.pb.js
│       └── frontend/pow-guard.js
├── transcript        # pi 的标准输出/错误全文
├── container.log     # docker logs 输出
└── score.json        # evaluator 评分报告
```

### 8.4 文件

| 文件                              | 作用                                         |
| --------------------------------- | -------------------------------------------- |
| `scripts/test-pi-pack.sh`         | Layer 1:现场生成 + 存档 + 调用 evaluator     |
| `scripts/evaluate-agent-pack.mjs` | Layer 2:独立确定性 evaluator,输出 score.json |
| `.snow/artifacts/`                | 存档目录(已加入 `.gitignore`)                |

### 8.5 使用

```bash
# 完整测试
./scripts/test-pi-pack.sh

# 跳过 Docker 构建,保留容器和证据
./scripts/test-pi-pack.sh --no-build --keep-evidence

# 只对已有 artifact 运行 evaluator(不经过 layer 1)
node scripts/evaluate-agent-pack.mjs \
  --artifact-dir .snow/artifacts/pi-pack-20260818-090807/artifact \
  --image vanblog:dev-test \
  --port 8890 \
  --report-dir .snow/artifacts/pi-pack-20260818-090807
```
