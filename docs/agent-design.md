# 内置 Agent 设计:pi 编码代理 + Zen free 模型 + 需求方嵌入入口

> **依据**:完整选型调研见 [`refs/agent-platform-selection.md`](../refs/agent-platform-selection.md)(调研/竞品对比,不进 docs);本文是**决策落地 + 现状实现**,供 agent 动手前读。
>
> **核心原则**:
>
> - **官方 agent = dev 容器 + pi + vanblog skill 包**(不自研 golang agent 引擎)
> - **LLM provider 从设计起即插拔**(pi models.json 任意 OpenAI 兼容端点);Zen free 只是选项清单里的「零成本开箱」项,不是绑定
> - **引擎程序同样可插拔**(`agent-config/engine.json`:pi 默认 / omp / 桥接脚本)
> - **agent 入口是「各需求方嵌入」而非全局侧边栏主动入口**
> - **支持多 profile sys prompt**(迁移/主题/pack/升级等场景各有专属提示词;`profile` 请求字段尚未实现,见 §7)
>
> - **认证强度:仅 admin**(PB 是唯一认证边界,Go 直接管理引擎子进程)
> - **session 由 PB 持久化元数据**(Go 只缓存运行时,引擎保存对话历史)
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

### 3.1 Zen free 的定位:零配置选项,而非默认绑定

Zen free 是 provider 选项清单里「零成本开箱」的一项:用户起 dev 容器即用,
**不需要注册、不需要 API key、不需要付费**——skill 编排的中小 agentic 循环够用。
配置自己的 provider(见 §3.4)后完全取代它,两者互不干扰。

### 3.2 认证陷阱(已验证)

Zen free 模型**不能带任何 Authorization header**(任何 key 都返回 401),但 pi 的 openai-completions provider 只要配了 apiKey 就强制注入 header,且要求 apiKey 非空才暴露模型。**`authHeader: false` 是死字段,实测仍 401。**

三方冲突:

- pi 要求「必须有 key」→ 给了 key 就发 header
- Zen 要求「绝不能有 key」→ 有 key 就 401
- 无任何配置能解开

**解法**:`scripts/runtime/pi-zen-proxy.mjs` 提供一个独立的反向代理,剥掉 Authorization header 再转发 Zen。pi 配假 key(满足 pi),baseUrl 指向本地 proxy(满足 Zen)。若未来 pi 去掉 apiKey 强制要求,proxy 可删。

### 3.3 模型动态解析

Zen 模型列表**会轮换**(promo 模型下架)。模型名不能硬编码。`scripts/runtime/resolve-zen-free-models.mjs` 启动时 `GET /zen/v1/models` → filter `-free` 后缀 → 选当前可用最佳模型写入配置。

### 3.4 agent-config/:声明式配置目录(优先于 Zen)

`<workspace>/agent-config/`(gitignored、随工作区同步树分发)是引擎配置的
**体面放置位置**:

| 文件          | 作用                                                            |
| ------------- | --------------------------------------------------------------- |
| `models.json` | 正式 provider 定义(如 zhipu coding plan / openrouter),覆盖 Zen |
| `auth.json`   | 引擎内置 provider 的 API key                                     |
| `engine.json` | 引擎程序选择:`{"bin": "...", "extraArgs": []}`,默认 pi           |

`init-pi-config.mjs` 启动时**先查该目录**:存在 `models.json` 即原样拷入引擎
全局配置并跳过 Zen 解析/生成——Zen 只在没有任何外部配置时才启用。引擎选择的
解析顺序(env `VANBLOG_AGENT_BIN` > `engine.json` > 内置默认)见
`vault/internal/agent/agent.go` 的 `loadEngineConfig`。

`engine.json` 的 `bin` 可以是任意 stdio 可执行:容器内 pi(默认)、宿主 omp 经
`scripts/dev/agent-rpc-bridge.sh`(ssh stdio 桥,session-dir 重写到引擎侧)、
或任何兼容 rpc JSONL 协议的程序。pi 与 omp 协议同源,差异(`--approve` flag、
settled 事件名 `agent_settled` vs `agent_end`)已在 Manager 内兼容。

## 4. 系统架构

```
┌─ 官方 agent(0 配置入口,dev 容器内)─────────────────┐
│  dev 容器(VANBLOG_MODE=dev)                          │
│  = 天然 sandbox + 引擎(pi 默认)+ vanblog skill 包     │
│                                                       │
│  用户: docker exec pi / admin「AI 终端」(同一会话目录)   │
│  LLM:    agent-config/ 正式 provider,或 Zen free(0 key)│
│  引擎:   agent-config/engine.json(pi / omp / 桥接)    │
│  能力:   skill 编排 → CLI 脚本(迁移/升级/主题)       │
│  知识:   skill 只做编排,领域知识读 docs/             │
└───────────────────────────────────────────────────────┘

┌─ 宿主机 agent(面向有 agent 环境的用户)──────────────┐
│  Claude Code / Snow CLI / Cursor / omp / ...          │
│  = 通过 MCP 获得 vanblog 领域能力                     │
│  文件: volume 映射 / docker exec                     │
└───────────────────────────────────────────────────────┘

共享层: vault/internal/* (领域逻辑唯一实现)
        docs/ (权威知识源,skill 指向它)
```

### 4.1 Web 接入链路(终端桥)

```
浏览器 admin「AI 终端」页(xterm.js)
  → WebSocket /api/vanblog/agent/terminal(PB admin 认证,dev 容器限定)
  → Go terminal 桥:每连接 spawn 一个引擎 TUI 进程(PTY)
     引擎由 agent-config/engine.json 决定(默认容器内 pi)
  → 会话文件统一落 <pb_data>/agent-sessions(随数据卷持久)

docker exec 进容器的 pi 用同一 --session-dir:
  网页聊过的对话,终端 --resume 接得上;反之亦然(同一文件,无同步)
```

**关键安全与边界**:

- PB 是唯一认证边界:WS 握手走 admin 会话(cookie),非 admin 403
- **prod 不注册任何 agent/MCP 路由**(`agent.Enabled()`:显式 `VANBLOG_MODE=dev` 才开,默认关闭)。
  迁移数据等 AI 需求 = 用相同数据卷临时启动同版本 dev 容器完成,见 §7
- 网页终端 = 容器内 TUI = admin 拿到容器 shell 级权限(pi 内可执行命令);这是 dev 容器的固有权限模型,prod 不受影响
## 5. 入口形态:需求方嵌入 + 多 profile

> **产品决策**(2026-08):agent **不是** admin 侧边栏的主动入口,而是**在各需求方嵌入**。

### 5.1 为什么不放全局侧边栏

- 侧边栏主动入口会**暗示「agent 是常驻功能」**,但 agent 是「任务型助手」——用户只在特定场景需要
- 全局入口割裂了「场景上下文」:用户在迁移页面,却要点一个全局 agent 按钮,再手动描述上下文
- 需求方嵌入让 agent **天生带上下文**:迁移页面里的 agent 入口,自动带「迁移」profile

### 5.2 预设任务(profile 助手的收敛形态)

原设计的「独立 chat 端点 + profile system prompt」随 SSE 移除而废弃。收敛形态:

- **终端页内置预设**:6 个快捷任务(主题/pack/升级/排查/优化/性能),点击后经确认条送入 TUI——
  等效用户手输,无 system prompt 注入
- **需求方页面跳转**:`/admin/terminal?name=<标签>&prompt=<urlencoded 任务描述>`;
  迁移页已有「AI 迁移助手」入口。带上下文引导的 prompt 前缀即 profile 语义
- 确认条(显示全文+手动发送)防误触发

### 5.3 实现现状(2026-08-30 重构后)

- ✅ `vault/internal/agent/terminal.go` — WS→PTY 桥,xterm.js 后端,每连接一个引擎 TUI
- ✅ `app/src/pages/admin/terminal.astro` — 网页终端(xterm.js + fit 自适应 + resize 同步)
- ✅ 会话共享存储:`<pb_data>/agent-sessions`(网页/终端同一目录)
- ❌ 已移除:SSE chat API、agent.astro 聊天页、PB 侧 session 记录、`vanblog agent` CLI、test-agent-rpc.sh——全部能力收敛进 TUI
- ⏳ 需求方嵌入(profile 助手)暂缓:若未来做,形态为「预设任务 → 跳终端页自动发送」,不再有独立聊天端点

## 6. 文件与命令

| 文件                                              | 作用                                                          |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `vault/internal/agent/agent.go`                   | agent 开关(`Enabled()`,默认关)、engine.json 解析、validate 端点 |
| `vault/internal/agent/terminal.go`                | WS→PTY 桥:每连接一个引擎 TUI,resize/输入透传                  |
| `app/src/pages/admin/terminal.astro`              | 网页终端(xterm.js,CJK/IME 内建,fit 自适应)                 |
| `agent-config/`(gitignored,不入库)               | models/auth/engine.json(§3.4)                                |
| `scripts/runtime/init-pi-config.mjs`              | 引擎配置初始化;外部配置优先,Zen 仅兜底                        |
| `scripts/runtime/pi-zen-proxy.mjs`                | Zen auth-stripping proxy(:4330,仅 Zen 路径)                  |
| `sdk/src/models/agentSessions.ts`                 | agent_sessions schema(collection 留存,代码已不再写它)        |
| `.agents/skills/vanblog/SKILL.md`                 | 引擎加载的 dev skill(编排,指向 docs/)                        |

```bash
# 网页:admin →「AI 终端」(pi 原生 TUI 的全部能力:审批/工具可见/会话树)

# dev 容器内(与网页共享会话目录 <pb_data>/agent-sessions):
pi                    # 交互模式(TUI)
pi -p "帮我 review"   # 单次提问
pi -r                 # 恢复历史会话(含网页里聊过的)
```
## 7. 已知限制与后续

| 项目                | 状态                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| prod 禁用           | agent/MCP 路由仅 `VANBLOG_MODE=dev` 注册;**迁移等 AI 需求 = 相同数据卷临时起同版本 dev 容器** |
| Zen free 限流       | 分钟级限流;配置 `agent-config/models.json` 正式 provider 即完全绕开   |
| 模型轮换            | 动态解析已规避(仅 Zen 路径)                                          |
| 会话引擎归属        | 同一 sessionDir 不要混用 pi/omp(会话文件格式 fork 后不互通)          |
| 并发连接            | 每个 WS 连接独立引擎进程;同一会话文件同时被两个进程写未定义——先关一个再开另一个 |
| 需求方嵌入助手      | 暂缓(§5.3);未来形态为预设任务跳终端页                               |
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
| `scripts/test/test-pi-pack.sh`         | Layer 1:现场生成 + 存档 + 调用 evaluator     |
| `scripts/test/evaluate-agent-pack.mjs` | Layer 2:独立确定性 evaluator,输出 score.json |
| `.snow/artifacts/`                | 存档目录(已加入 `.gitignore`)                |

### 8.5 使用

```bash
# 完整测试
./scripts/test/test-pi-pack.sh

# 跳过 Docker 构建,保留容器和证据
./scripts/test/test-pi-pack.sh --no-build --keep-evidence

# 只对已有 artifact 运行 evaluator(不经过 layer 1)
node scripts/test/evaluate-agent-pack.mjs \
  --artifact-dir .snow/artifacts/pi-pack-20260818-090807/artifact \
  --image vanblog:dev-test \
  --port 8890 \
  --report-dir .snow/artifacts/pi-pack-20260818-090807
```
