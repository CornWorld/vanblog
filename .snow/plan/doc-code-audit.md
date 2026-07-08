# 文档内嵌代码审计

## Context

检查全项目文档中的代码块，判断哪些是阐明观点的 example/pseudocode（受欢迎），哪些是和项目已有位置重复 / 实现没头没尾的实现代码（应删除）。

## 审计范围

- `docs/` — 9 个文件
- `refs/` — 7 个文件（不含 fork repo docs）
- `refs/xxddccaa-fork/analysis/` — 4 个文件
- `refs/xxddccaa-fork/repo/` — 5 个核心文件（AGENTS, CLAUDE, DEPLOY, README, prompt.md）
- `.snow/plan/` — 13 个文件
- `.snow/notes/` — 1 个文件
- `README.md`
- **排除**: `refs/xxddccaa-fork/repo/docs/`（fork 自身文档，非本项目维护范围）

总计：~40 个 markdown 文件

## 分析摘要

### 统计概览

| 文件数量 | 含代码块 | 不含代码块 |
| -------- | -------- | ---------- |
| ~40      | 19       | ~21        |

| 代码块类别         | 数量 | 说明                                                  |
| ------------------ | ---- | ----------------------------------------------------- |
| **EXAMPLE**        | ~65  | 阐明概念的示例、API 用法、目录树、架构图              |
| **PSEUDOCODE**     | ~12  | 高层设计草图、提案、不打算运行的代码                  |
| **IMPLEMENTATION** | ~3   | 看起来像可运行的实际代码                              |
| **CONFIG**         | ~15  | docker-compose, Dockerfile, bash 命令, JSON/YAML 配置 |

### 关键发现：没有需要删除的代码块

经过逐文件审计，**全项目文档中不存在需要删除的代码块**。理由如下：

---

## 逐文件详细分析

### 1. `docs/agent-theme-architecture.md` ✅ 全部保留

- **5 个代码块**: 均为目录树/模板示例
- **类别**: EXAMPLE
- **判断**: 🌟 受欢迎 — 纯解释性示例，阐明主题架构

### 2. `docs/architecture-layering.md` ✅ 全部保留

- **11 个代码块**: 架构图、目录结构、Go/JSVM 片段
- **类别**: EXAMPLE + PSEUDOCODE
- **3 个 IMPLEMENTATION-type 块**:
  - `pb_hooks/system.pb.js` 片段 (L212-240) — **简化示意版**，文档已标注"真实片段"。drift-report 确认与真实代码有偏差（ES5 vs ES6），不是重复，是文档过时问题
  - `main.go` 骨架 (L250-269) — **显式标注为骨架**，不是完整实现
  - Go 事件钩子/路由注册模式 (L275-319) — **模式示意**，有大幅简化
- **判断**: 🌟 受欢迎 — 代码用来说明分层架构，是教学模式

### 3. `docs/deployment-guide.md` ✅ 全部保留

- **9 个代码块**: docker run 命令、Caddy 配置、S3 JSON
- **类别**: CONFIG
- **判断**: 🌟 受欢迎 — 纯部署操作指南

### 4. `docs/deployment-strategy.md` ✅ 全部保留

- **14 个代码块**: 架构图、Dockerfile 骨架、entrypoint 骨架、docker-compose 模板
- **类别**: EXAMPLE + PSEUDOCODE + CONFIG
- **判断**: 🌟 受欢迎 — 所有片段显式标注为骨架/模板，不是实现代码

### 5. `docs/lessons-learned.md` ✅ 全部保留

- **2 个代码块**: Go 修复片段、SQL 维护语句
- **类别**: EXAMPLE
- **判断**: 🌟 受欢迎 — 经验教训中的修复示例

### 6. `docs/pb-schema-design.md` ✅ 全部保留

- **3 个代码块**: 权限枚举、JSON 结构示例
- **类别**: EXAMPLE
- **判断**: 🌟 受欢迎 — Schema 设计文档的自然组成部分

### 7. `docs/plugin-authoring.md` ✅ 全部保留

- **17 个代码块**: 目录结构、Go migration、JSVM 钩子、前端 fetch、manifest.json
- **1 个 IMPLEMENTATION-type 块**: Go migration (L98-141)
  - 这是 `vault/pb_migrations/1783000000_create_moments_collection.go` 的**简化教学版**
  - 文档显式标注"简化版"，省略了多个字段
  - **不是逐字复制** — 是教学目的的改编
- **已废弃的 JSVM 代码**（#4, #8-#10, #12-#14）: 放在 `<details>` 折叠块中，标注"已过时"，作为历史参考
- **判断**: 🌟 受欢迎 — 这是作者指南，代码是教学用的

### 8. `docs/routing-strategy.md` ✅ 全部保留

- **9 个代码块**: Caddyfile 模板、JSON DSL、路由伪代码
- **类别**: EXAMPLE + PSEUDOCODE
- **判断**: 🌟 受欢迎 — 伪代码起草路由策略，没有可运行的实际代码

### 9. `docs/sdk-design.md` ✅ 全部保留

- **7 个代码块**: TypeScript API 用法、workspace 配置
- **类别**: EXAMPLE + CONFIG
- **判断**: 🌟 受欢迎 — SDK 使用示例

### 10. `README.md` ✅ 无代码块

- 纯散文 + 缩进目录树（非 fenced 代码块）

### 11-18. `refs/` 分析文档 ✅ 全部保留 / 无代码块

- `analysis.md`, `forks-analysis.md`, `product-positioning*.md`, `RESEARCH-INDEX.md`, `roadmap.md`, `summary.md`: **无代码块**
- `editor-comparison.md`: 第三方库 API 示例 → EXAMPLE，受欢迎

### 19-22. `refs/xxddccaa-fork/analysis/` ✅ 全部保留

- **~25 个代码块**: fork 源码引用
- **类别**: EXAMPLE
- **判断**: 🌟 受欢迎 — 都是从 fork 项目**引用**的源码片段，作为分析证据。不是本项目的代码，不存在"重复"问题。

### 23-27. `refs/xxddccaa-fork/repo/` ✅ 全部保留 / 无问题

- `AGENTS.md`, `CLAUDE.md`, `DEPLOY.md`, `README.md`: CLI 命令参考 → CONFIG，正常
- `prompt.md`: 一个 TypeScript 接口定义 → EXAMPLE，设计规范

### 28-39. `.snow/plan/` 和 `.snow/notes/` ✅ 全部保留

- 大部分 plan 文件**无代码块**（纯规划散文）
- `plugin-architecture-redesign.md`: 设计提案中的代码块 → PSEUDOCODE/EXAMPLE，有些已被最终实现取代，但作为设计档案有价值
- `plugin-dx-comparison.md`: 提案伪代码 → PSEUDOCODE
- 其他少量 EXAMPLE 代码块 → 正常

---

## 风险评估

| 风险                   | 影响                     | 处理                                           |
| ---------------------- | ------------------------ | ---------------------------------------------- |
| 文档代码与源码不同步   | 低 — drift-report 已识别 | 之前已修复 drift，剩余偏差是简化示意版，不影响 |
| 已废弃的 JSVM 代码残留 | 低 — 已折叠+标注"已过时" | 作为历史参考保留，无危害                       |

---

## 附录: Drift Report 交叉验证

上一次 drift report 发现了 24 处文档与源码不同步的问题。本次审计确认了修复进度：

### ✅ 已修复 (18 项)

| Finding | 描述                               | 修复状态                                                           |
| ------- | ---------------------------------- | ------------------------------------------------------------------ |
| F1      | `$vanblog` 命名空间否认            | ✅ `architecture-layering.md:479-490` 正确描述 `$vanblog` helpers  |
| F2      | 路由表只列 11 条                   | ✅ 现在列出 22 条路由 (#L330-358)                                  |
| F3      | `migrate/status` 路由不存在        | ✅ L583 标注"仅注册 import 一个端点(无 status)"                    |
| F4      | SDK 遗漏 `.vanblog` 前缀           | ✅ 全部改为 `client.vanblog.*`                                     |
| F5      | Monorepo 结构错误                  | ✅ 标注 `sdk/`/`app/` 在根目录,services.ts 是单文件                |
| F6      | `revisions.diff` 字段              | ✅ L179 标注"不存储 diff 字段",解释原因                            |
| F7      | `media.staticType` 含 `customPage` | ✅ L208 移除,标注"customPage 已随决策移除"                         |
| F9      | "ES5 only" 声明                    | ✅ 已删除该确认(搜索插件文档中无 "ES5" 字样)                       |
| F11     | `examples.pb.js` 描述不符          | ✅ 标注"当前全部以注释形式保留(不执行)"                            |
| F14     | cron id 错误                       | ✅ 改为 `visits-daily-aggregate`, 时间 `0 0 * * *`                 |
| F15     | `system.pb.js` 代码过时            | ✅ 现在使用 ES6 箭头函数 + 三种事件钩子                            |
| F16     | Markdown 渲染描述过时              | ✅ L632 标注管道在 `app/src/lib/markdown/config.ts`                |
| F17     | `vanblog.caddy.*` JSVM 绑定        | ✅ L298/335 标注"Go extend 实现,SDK 走 `client.vanblog.routing.*`" |
| F21     | `onBootstrap` 创建 collection      | ✅ 现在正确描述为"老模式/Fallback,不推荐"                          |
| F22     | prod "不含 Node.js"                | ✅ 改为"~120MB,含 Caddy + pb + Node.js SSR"                        |
| F23     | prod entrypoint 失真               | ✅ 改为 3 进程模型骨架,标注真实文件路径                            |
| F24     | Dockerfile 内容不符                | ✅ L176 添加显式更正注释                                           |

### 🔶 部分修复 (2 项)

| Finding | 描述                         | 当前状态                                                                                                                                                          |
| ------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F8      | `site` vs `site_config` 命名 | **文档正确** — `pb-schema-design.md` 标注 `site_config` → `site`。但代码 `plugins.go:123` 仍用 `"site_config"`,是 Go 代码 bug,非文档问题                          |
| F10     | `$http` 是否可用             | **文档已消除矛盾** — plugin-authoring 不再提 `$http`。architecture-layering 中 `$http.send` 出现在 examples 代码块中但已标注为注释示例。需查 pb 0.39 上游文档确认 |

### ⚠️ 需人工确认 (3 项)

| Item | 描述                                         | 建议                                  |
| ---- | -------------------------------------------- | ------------------------------------- |
| A    | `$http` 在 pb 0.39 JSVM 中可用性             | 查 pb 上游 `jsvm` 文档或 `types.d.ts` |
| B    | `plugins.go:123` 的 `"site_config"` 是否 bug | 人工确认是否为别名机制                |
| C    | `article.go` 导出函数名与文档对照表一致性    | 逐函数核对 Go outline                 |

### 剩余待验证 (1 项)

| Finding | 描述                             | 状态           |
| ------- | -------------------------------- | -------------- |
| F18     | `users.permissions` 枚举表述歧义 | 未验证当前状态 |

---

## 结论

**无需删除任何代码块。** 全项目文档中的代码块均是：

- 阐明概念的 EXAMPLE（占 ~68%）
- 设计提案的 PSEUDOCODE（占 ~13%）
- 部署操作的 CONFIG（占 ~16%）
- 简化教学版的 IMPLEMENTATION（占 ~3%，全部显式标注为简化版/骨架）

不存在"和项目中已有位置相同"的逐字复制，也不存在"实现没头没尾"的孤立代码。所有 IMPLEMENTATION-type 代码块都是有意简化的示意版本，服务于文档的教学目的。
