# Pack 清理继续推进（含 Moments legacy 删除）

## Context

用户要求继续推进 Pack，并明确补充：**Moments legacy 允许删除**。这比原 `.snow/plan/pack-layout-continuation.md` 的范围更大：原计划为了避免 `/p/moments` 回归，保留 `plugins/moments`、`vault/pb_hooks/moments.pb.js` 中的 `$vanblog.servePlugin("moments")`、Astro 动态 plugin fragment renderer 与 Go `internal/plugins` 兼容层；新范围允许删除这些 legacy UI/fragment 兼容路径。

本轮仍不实现 `cms-theme-portability-analysis.md` 的主题可移植性体系。目标是完成 Pack v0 收尾：Bookmarks 由 Pack 独立承载；legacy plugin compatibility（包括 Moments UI fragment 机制）可移除；Moments collection/model/migration 作为已有数据模型保留，避免 destructive data rollback。

## Analysis

- **Affected files**:
  - `eslint.config.js`：当前仍只覆盖 `vault/pb_hooks/**/*.js`，导致 Pack hook lint 失败；需恢复 Pack hook glob。
  - `vault/pb_hooks/moments.pb.js`：当前同时承担 `$vanblog.servePlugin("moments")` 和 moments author 自动填充。删除 legacy UI 时，应移除 `servePlugin`，但保留或迁移 author 自动填充，避免破坏创建数据。
  - `plugins/moments/**`：legacy manifest + HTML fragment，可删除。
  - `app/src/pages/p/[plugin].astro`、`app/src/pages/admin/plugins/[plugin].astro`、`app/src/lib/plugin-loader.ts`：只服务 PB HTML fragment legacy plugin；删除 Moments legacy 后无已知消费者，可删除。
  - `vault/internal/plugins/plugins.go`：`$vanblog.servePlugin`、manifest/template/static/nav helper 兼容层；若只剩 Moments 使用，移除 `servePlugin` 后可删除该 package 及 `main.go` 绑定。
  - `vault/main.go`：移除 `pluginsDir` flag、`plugins.New(...)`、`pluginMgr.Bind()`；JSVM `OnInit` 不再注入 `$vanblog` plugin helper。
  - `vault/pb_hooks/lib/vanblog.d.ts`：若 `$vanblog` 不再提供 plugin helper，需要删除或收窄对应类型声明。
  - `vault/pb_hooks/plugins.pb.js`、`sdk/src/server.ts`：`/_plugin/nav` 聚合入口可能依赖 plugin nav；删除 legacy plugin 后需审计是否可移除或保持空响应。
  - `Dockerfile`：不再 COPY `plugins /plugins`，也无需 `/plugins` runtime resource。
  - `vault/internal/packcli/command_test.go`：补 `pack eject` unknown command 回归断言。
  - Docs/plans：同步 `pack add`、root `packs/bookmarks`、无 legacy Bookmarks/Moments fragment 的状态。
- **New files**: 预计无；如果保留 moments author hook，直接编辑 `vault/pb_hooks/moments.pb.js` 即可。
- **Dependencies**: PocketBase JSVM、Go compile/tests、Astro route discovery、Dockerfile check；不新增第三方依赖。
- **Complexity**: complex
- **Risk areas**:
  - 删除 `internal/plugins` 会影响 `$vanblog` 全局；必须确认 `vault/pb_hooks/**/*.pb.js` 没有其它 `$vanblog.*` 调用。
  - 删除动态 Astro plugin pages 会移除 `/p/moments` 与 `/admin/plugins/moments`，这是本轮接受的行为变化。
  - 若完全删除 `moments.pb.js`，创建 moments 时 author 自动填充会消失；建议只删除 `servePlugin` legacy UI，保留 author hook，除非后续明确删除 moments feature/data。
  - `sdk/src/server.ts` 若仍请求 `/_plugin/nav`，需要保证前端不会因 404 崩溃，或改为不依赖该接口。

## Phases

### Phase 1: 修复 Pack hook ESLint 覆盖

- **Goal**: 先恢复当前已知 lint blocker，确保后续清理建立在可验证基线上。
- **Files**: `eslint.config.js`
- **Steps**:
  - [ ] 将 PB JSVM override `files` 扩展为 `vault/pb_hooks/**/*.js` 与 `packs/*/hooks/**/*.pb.js`。
  - [ ] 保持 globals/rules 不变，仅修改 glob 与注释。
  - [ ] 运行 `node --check eslint.config.js` 与 `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js`。
- **Done when**: ESLint config 语法与 Pack hook lint 均通过。

### Phase 2: 删除 Moments legacy UI/fragment 机制

- **Goal**: 移除 legacy plugin UI fragment 路径，同时保留非破坏性的 moments collection/model/migration 与 author hook。
- **Files**: `plugins/moments/**`, `vault/pb_hooks/moments.pb.js`, `app/src/pages/p/[plugin].astro`, `app/src/pages/admin/plugins/[plugin].astro`, `app/src/lib/plugin-loader.ts`, `vault/internal/plugins/plugins.go`, `vault/main.go`, `vault/pb_hooks/lib/vanblog.d.ts`, `vault/pb_hooks/plugins.pb.js`, `sdk/src/server.ts`, `Dockerfile`
- **Steps**:
  - [ ] 删除 `plugins/moments/**` 与 Astro dynamic plugin fragment pages/loader。
  - [ ] 从 `vault/pb_hooks/moments.pb.js` 移除 `$vanblog.servePlugin("moments")`，保留 `onRecordBeforeCreateRequest(..., "moments")` author 自动填充。
  - [ ] 移除 Go `internal/plugins` package 绑定、`pluginsDir` flag、Docker `COPY plugins /plugins`；如果 package 无其它引用则删除源码。
  - [ ] 处理 `/_plugin/nav` 相关入口：若仅服务 legacy nav，则删除或改为无害空响应，并同步 `sdk/src/server.ts` 调用方。
- **Done when**: 仓库不再存在 `plugins/moments`、动态 plugin fragment pages、`$vanblog.servePlugin("moments")`、`COPY plugins /plugins`；Go build 通过。

### Phase 3: 锁定 Pack v0 清理回归

- **Goal**: 用测试固定 root Pack、`pack add`、无 `eject`、无旧 Bookmarks/Moments legacy 的状态。
- **Files**: `vault/internal/packcli/command_test.go`, `vault/internal/pack/**`, `app/integrations/packs/**`, `packs/bookmarks/**`
- **Steps**:
  - [ ] 增加 `pack eject` unknown command 测试。
  - [ ] 检查旧目录不存在：`plugins/bookmarks`、`plugins/moments`、`app/packs-builtin`、`vault/internal/pack/builtin`。
  - [ ] 检查 legacy route 字符串不再出现：`servePlugin("bookmarks")`、`servePlugin("moments")`、`/_plugin/moments`。
- **Done when**: 相关 grep/测试断言稳定，Pack resolver 与 Go Pack/CLI tests 通过。

### Phase 4: 文档与计划同步

- **Goal**: 把文档从 legacy plugin 兼容状态更新为 Pack v0 当前事实。
- **Files**: `.snow/plan/pack-layout-lint-cli-cleanup.md`, `.snow/plan/pack-layout-continuation-with-moments-removal.md`, `docs/future-pack-architecture.md`, `docs/plugin-authoring.md`, `docs/architecture-layering.md`（如引用已删除 plugin helper）
- **Steps**:
  - [ ] 更新计划完成摘要：Bookmarks Pack/root packs/add/非 embed/Docker 已完成，legacy Bookmarks 与 Moments fragment 已删除。
  - [ ] 更新 docs 中仍把 `$vanblog.servePlugin` 描述为推荐路径的内容，标注为已删除 legacy 或历史参考。
  - [ ] 保留 moments collection/model/migration 说明，明确只是删除 legacy UI/fragment compatibility，不 drop 数据。
- **Done when**: 文档不再与当前代码事实冲突。

### Phase 5: 最终回归

- **Goal**: 验证删除 legacy 后 Pack v0 baseline 可继续推进。
- **Files**: 全仓相关入口
- **Steps**:
  - [ ] `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js`
  - [ ] `pnpm --filter vanblog-app test:packs`
  - [ ] `go test ./internal/pack ./internal/packcli`
  - [ ] `go test ./...`
  - [ ] `go build ./...`
  - [ ] `pnpm test:models:types` 与 `pnpm test:models:fixtures`
  - [ ] `pnpm --filter vanblog-app build`
  - [ ] `pnpm --filter vanblog-app test:e2e:cache`
  - [ ] `docker buildx build --check .`
  - [ ] `git diff --check`
- **Done when**: 全部通过；IDE diagnostics 若仍 unavailable，则记录环境限制。

## Risks & Mitigations

| Risk                                       | Impact                      | Mitigation                                                            |
| ------------------------------------------ | --------------------------- | --------------------------------------------------------------------- |
| 删除 `$vanblog` 后仍有 hook 调用           | JSVM 启动失败               | 删除前全仓搜索 `$vanblog`；保留仅无 `$vanblog` 的 moments author hook |
| `/p/moments` 消失                          | 用户访问旧 Moments 页面 404 | 这是用户明确允许的 legacy 删除；文档中标注行为变化                    |
| 删除 plugin nav 导致 SDK/server fetch 失败 | 页面导航异常                | 审计 `/_plugin/nav` 调用方，删除调用或保证空结果兼容                  |
| 误删 moments 数据模型                      | 数据/API 回归               | 不删除 migration、SDK model、collection；只删除 legacy UI/fragment    |
| Docker 仍 COPY 不存在目录                  | Docker check/build 失败     | 同步删除 `COPY plugins /plugins`                                      |

## Rollback Strategy

本轮不执行自动 Git 回滚。若 legacy 删除造成不可接受回归，可逐项恢复：`plugins/moments/**`、Astro dynamic plugin pages/loader、`vault/internal/plugins/**`、`main.go` 中 `pluginMgr.Bind()` 与 `COPY plugins /plugins`。不执行 down migration，不删除 moments/bookmarks collections 或数据。

## Completion Summary

**Status**: Completed with documentation follow-up
**Phases**: 5 / 5 implementation and verification completed

### Results

- `eslint.config.js` 已覆盖 `packs/*/hooks/**/*.pb.js`，Pack hook lint blocker 解除。
- 删除 Moments legacy UI/fragment：`plugins/moments/**`、`app/src/pages/p/[plugin].astro`、`app/src/pages/admin/plugins/[plugin].astro`、`app/src/lib/plugin-loader.ts`。
- 删除 Go legacy plugin compatibility package：`vault/internal/plugins/**`，并从 `vault/main.go` 移除 `pluginsDir` flag、`plugins.New(...)` 与 JSVM `OnInit` 注入。
- 删除 `vault/pb_hooks/plugins.pb.js` 与 `/_plugin/nav` 依赖；`sdk/src/server.ts` 的 `getNavItems()` 改为返回空数组，避免请求已删除 endpoint。
- `vault/pb_hooks/moments.pb.js` 已移除 `$vanblog.servePlugin("moments")`，保留 moments author 自动填充 hook。
- `vault/pb_hooks/lib/vanblog.d.ts` 已移除 `$vanblog` plugin helper namespace，仅保留 core hook 使用的数据类型声明。
- `Dockerfile` 已删除 `COPY plugins /plugins`。
- `vault/internal/packcli/command_test.go` 增加 `pack eject` unknown command 回归断言。
- 搜索确认代码路径中不再存在 `servePlugin("moments")`、`/_plugin/moments`、`COPY plugins`、`plugins/moments`、`internal/plugins` 等 legacy 入口（仅计划/历史文档中仍有文字记录）。

### Verification

- [x] `node --check eslint.config.js`
- [x] `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js`
- [x] `pnpm --filter vanblog-app test:packs`
- [x] `go test ./internal/pack ./internal/packcli`
- [x] `go test ./...`
- [x] `go build ./...`
- [x] `pnpm test:models:types`
- [x] `pnpm test:models:fixtures`
- [x] `pnpm --filter vanblog-app build`
- [x] `pnpm --filter vanblog-app test:e2e:cache`
- [x] `docker buildx build --check .`
- [x] `git diff --check`

### Deviations

- 文档大范围改写尚未执行；当前代码已完成删除，后续仍需清理 `docs/plugin-authoring.md`、`docs/architecture-layering.md`、`docs/future-pack-architecture.md` 中关于 `$vanblog.servePlugin` 与 legacy plugin 的历史表述，避免读者误解。
- `.snow/settings.json` 显示为已修改，但本轮未主动编辑该文件；需要后续确认是否为环境/工具状态变化。

### Follow-up

1. 文档同步：把 `$vanblog.servePlugin` 从推荐路径改为已删除 legacy/historical reference。
2. 若需要恢复 `/p/moments`，应走新的 Pack/Astro composition 方案，而不是恢复 PB HTML fragment legacy。
3. 可增加 runtime smoke 专门验证删除 `$vanblog` 后 JSVM hooks 启动不再需要 OnInit 注入。
