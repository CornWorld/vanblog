# 修复 live2d-companion Pack 的代码质量问题

## Status: ✅ Completed

## Context

经复核，前一轮指出的 4 个"卡点"中，3 个不是 vanblog 契约缺口，而是 pack 作者代码质量问题：

1. 鉴权绕过 SDK 公开 API（`isAuthenticated`/`getAuthUser`），直接翻 `window.__pb.authStore.model.role`
2. 配置只存 localStorage，不走 SSR 后端通道（`Astro.locals.pb.collection(...)`）
3. 文案/认知错误：作者没意识到 BaseLayout 已对 `scope:'public'` 的 frontend 做全站注入，但其实代码本身没写错——这条无需改代码，仅在本计划里澄清

第 4 个（`#waifu` id 耦合）是第三方 widget 约束，不在本修复范围。

本修复目标：把 pack 的鉴权和配置持久化改造到 SDK 官方契约上，消除"代码质量"层面的卡点。

## Analysis

- **Affected files**:
  - `packs/live2d-companion/pages/index.astro` — 把鉴权改 SSR frontmatter，客户端不再翻 `window.__pb`；新增"从后端读取配置 / 写回后端"逻辑
  - `packs/live2d-companion/frontend/live2d-companion.js` — 公共 API 从"仅 localStorage"改为"后端优先，localStorage 作离线兜底"；删除 `CONFIG.minWidth === 'disable'` 的死分支
  - `packs/live2d-companion/pack.ts` — 不变（契约元数据正确）
  - `packs/live2d-companion/pack.json` — 不变
  - `packs/live2d-companion/frontend/live2d-companion.css` — 删除死代码变量 `--l2dc-accent-hover`、`--l2dc-surface-alt` 和永不命中的 `.live2d-companion__toolbar/tool/toggle/message` 规则
- **New files**: 无
- **Dependencies**:
  - `@vanblog/sdk` 已有 `getAuthUser`、`isAuthenticated`、`hasPermission`（`sdk/src/server.ts`，server-safe，无 Node 依赖）
  - PocketBase collection `live2d_config` — 需要确认是否已存在；不存在则 pack 以"collection 不存在时静默降级到 localStorage"的方式工作，不阻塞
- **Complexity**: medium
- **Risk areas**:
  - 改 SSR frontmatter 要保留 `prerender = false`（参考 bookmarks/moments）
  - 客户端 `window.__pb` 当前还被 `live2d-companion.js` 间接依赖（通过 index.astro 的 `initClient()`）——改造后应让 pack 脚本完全自洽，不假设 `window.__pb` 存在
  - 后端配置 collection 缺失时不能让页面崩

## Phases

### Phase 1: 鉴权改走 SDK 公开 API（SSR）

- **Goal**: `pages/index.astro` 在 SSR frontmatter 里用 `Astro.locals.pb` + `getAuthUser` 判定管理员，把 `isAdmin` 当 props 下发到客户端；客户端不再访问 `window.__pb.authStore.model`。
- **Files**:
  - `packs/live2d-companion/pages/index.astro`
- **Steps**:
  - [ ] 在 frontmatter 加 `export const prerender = false;`
  - [ ] 加 `import { getAuthUser } from '@vanblog/sdk';`
  - [ ] 加 `const user = getAuthUser(Astro.locals.pb); const isAdmin = user?.role === 'admin';`
  - [ ] 用 Astro 模板变量替换客户端 `const pb = window.__pb; ...; const isAdmin = ...`，改为 `const isAdmin = JSON.parse('{...astro-rendered...}')` 之类传值
  - [ ] 保留 `initClient()` 调用（其他客户端 SDK 调用仍需要 pb 实例）
  - [ ] 客户端不再出现 `window.__pb.authStore`
- **Done when**:
  - `pages/index.astro` 没有 `window.__pb.authStore` 字符串
  - `pnpm --filter app build` 通过
  - `ide-get_diagnostics` 在该文件无 error

### Phase 2: 配置只走后端 collection（无 localStorage）

- **Goal**: 配置完全由后端 collection 承载；读失败 / collection 不存在 → 使用 DEFAULT_CONFIG。不再读写 localStorage。
- **Files**:
  - `packs/live2d-companion/pages/index.astro`, `packs/live2d-companion/frontend/live2d-companion.js`
- **Decision（用户确认）**: 不保留 localStorage 降级。离线 / collection 缺失 → 走默认值。
- **Steps**:
  - [ ] index.astro SSR frontmatter 里尝试 `Astro.locals.pb.collection('live2d_config').getFirstListItem('1=1')`，try/catch 失败返回 `null`（参考 bookmarks 模式）
  - [ ] 把读到的配置（或 null）作为 SSR props 下发到客户端
  - [ ] JS 侧 `CONFIG` 初始化：SSR 注入的配置 ∪ DEFAULT_CONFIG（浅合并）；删掉 `STORAGE_KEY`、`loadUserConfig`、`saveUserConfig`、所有 `localStorage.*` 调用
  - [ ] `saveConfig` 改为 async：通过 `window.__pb.collection('live2d_config')` 做 upsert（若无记录则 create，有则 update）；对 index.astro 的 form submit handler 做 await
  - [ ] `resetConfig` 改为 async：后端清空配置记录或写回 DEFAULT_CONFIG 快照
  - [ ] `reload()` 重新 `location.reload()` 让 SSR 重读后端（最简单、可靠）
  - [ ] 公共 API 的 `getConfig` 保持同步（返回当前内存 CONFIG）
- **Done when**:
  - 代码里不再出现 `localStorage` 字符串
  - collection 不存在时页面不崩，看板娘用 DEFAULT_CONFIG
  - 管理员改配置 → 刷新后保留
  - `pnpm --filter app build` 通过

### Phase 3: 清理死代码与可疑防御

- **Goal**: 删除永不生效的 CSS 规则、未使用的 CSS 变量、`minWidth === 'disable'` 死分支。
- **Files**:
  - `packs/live2d-companion/frontend/live2d-companion.css`
  - `packs/live2d-companion/frontend/live2d-companion.js`
- **Steps**:
  - [ ] CSS 删 `--l2dc-accent-hover`、`--l2dc-surface-alt` 两个未使用变量（light + dark 块）
  - [ ] CSS 删 `.live2d-companion__toolbar`、`.live2d-companion__tool`（含 :hover/:focus-visible）、`.live2d-companion__toggle`（含响应式）、`.live2d-companion__message`（含 .is-visible / ::after）——这些 class 由第三方 widget 自己渲染，pack 从不生成对应 DOM
  - [ ] JS `checkMobile()` 删除 `if (CONFIG.minWidth === 'disable') return;` 分支（minWidth 始终是数字）
  - [ ] 不改 `#waifu` 相关逻辑（第三方约束，不在本修复范围）
- **Done when**:
  - `pnpm --filter app build` 通过
  - 浏览器手动打开 `/p/live2d-companion`，看板娘仍正常加载/降级，工具栏样式不受影响（因为本就没命中 pack 自己的 CSS）

## Risks & Mitigations

| Risk                                        | Impact         | Mitigation                                                               |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `live2d_config` collection 在数据库中不存在 | 配置无法持久化 | Phase 2 的 try/catch 降级到 localStorage，不阻塞                         |
| 改 saveConfig 为 async 可能漏掉某处调用     | 运行时错误     | 全文搜索 `saveConfig(` / `resetConfig(` 调用点，逐一 await               |
| 删除 CSS 规则可能误删生效中的样式           | 看板娘视觉退化 | 逐一核对 class 是否在 JS 中生成；保留 fallback 相关样式（pack 自己生成） |
| SSR frontmatter 改动破坏 Astro 编译         | build 失败     | 每个 Phase 都跑 `pnpm --filter app build` + `ide-get_diagnostics`        |

## Rollback Strategy

`git restore packs/live2d-companion/` 一次性回滚所有改动。本修复不碰 vanblog 宿主代码（`app/`、`sdk/`），风险面已隔离在 pack 目录内。

## Completion Summary

**Status**: Completed
**Phases**: 3 / 3

### Results

- **Phase 1（鉴权）**：`pages/index.astro` 加 SSR frontmatter（`prerender=false`、`getAuthUser(Astro.locals.pb)`），把 `{ isAdmin, serverConfig }` 通过 `<script type="application/json" id="l2d-ssr-data">` 下发。客户端从 JSON 读取，完全不再访问 `window.__pb.authStore`。
- **Phase 2（配置）**：`live2d-companion.js` 删除所有 localStorage 代码（`STORAGE_KEY`/`loadUserConfig`/`saveUserConfig`）；新增 `upsertConfig()` 通过 `window.__pb.collection('live2d_config')` 做 getFirstListItem → update/create；`saveConfig`/`resetConfig` 改 async；`reload()` 改 `location.reload()` 让 SSR 重读后端。index.astro 的 submit/reset handler 加 await + try/catch + 错误提示。
- **Phase 3（清理）**：CSS 删除 `--l2dc-accent-hover`、`--l2dc-surface-alt` 两个死变量，删除 `.live2d-companion__toolbar/tool/toggle/message` 所有规则（第三方 widget 自渲染，pack 从不生成这些 class）。JS 中 `minWidth === 'disable'` 死分支在 Phase 2 重写时已一并删除。

### Deviations

- 原计划 Phase 2 保留 localStorage 兜底；用户明确改为"只走后端，无 localStorage"。计划已更新。
- 子代理进程崩了（Node 工具自身错误），全部改动由主会话直接完成。

### Verification

- [x] `pnpm --filter vanblog-app build` 通过（两次：Phase 2 后 + Phase 3 后）
- [x] `grep "window.__pb.authStore\|authStore.model\|authModel" packs/live2d-companion/` 无输出
- [x] `grep "localStorage\|STORAGE_KEY\|loadUserConfig\|saveUserConfig\|CONFIG_RECORD_ID_KEY" packs/live2d-companion/` 无输出
- [x] `grep "'disable'" packs/live2d-companion/` 无输出
- [ ] ide-get_diagnostics：本会话 IDE 未连接，未跑（build 通过替代保证类型/语法层正确）
- [ ] 浏览器手动验证：未跑（需要运行中的 PocketBase + live2d_config collection）

### Follow-up

### Follow-up（2026-07-17 追加：Phase 4 — 后端 collection migration）

- **决策**：Pack 契约本身**不能**创建 collection（schema.js 仅用于 `OnRecordValidate` zod 校验，不建表；collection 只能由 `vault/pb_migrations/*.go` 创建）。用户选择走 vanblog 官方路径：在 vault 加 Go migration。
- **新增文件**：`vault/pb_migrations/1783000002_create_live2d_config_collection.go`
  - 仿 `1783000000_create_moments_collection.go` 的幂等写法（FindCollectionByNameOrId 存在则 skip）
  - 字段：`widgetPath`/`cdnPath` (URLField, required)、`modelId`/`modelTexturesId`/`minWidth` (NumberField, required)、`tools` (JSONField, optional)、`created`/`updated` (AutodateField)
  - **只有 admin 可读写**（ListRule/ViewRule/CreateRule/UpdateRule/DeleteRule 全部 `@request.auth.role = "admin"`），因为这是全局单例配置；普通访客浏览器侧只走 DEFAULT_CONFIG，不碰这个 collection
- **验证**：`cd vault && go build ./...` 通过；`go run scripts/verify_mig3.go` 输出 `✅ live2d_config (9 fields, type=base)`，moments/bookmarks 也一并 ✅
- **脚本临时改动已还原**：`verify_mig3.go` 的 collection 清单改回原样（不把 pack collection 混进 core 验证脚本）
- **影响面**：迁移跑一次即幂等；老用户（无 live2d_config）启动后自动建表；已有该表的环境 skip。
- **遗留**：`loadWidgetScript` 的轮询+多重定时器结构依然脆弱（10s 超时但 widget 可能后渲染），但属于第三方 widget 异步约束，不在本修复范围。
