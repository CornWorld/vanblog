# Pack v1 Registry Consumption

## Status: ✅ Completed

## Context

上一阶段已经完成通用 `packs/` discovery、`virtual:vanblog/packs` client-safe metadata module、`packs/bookmarks/pack.ts` 和文档修正。当前 registry 还没有被前端布局消费：`BaseLayout.astro` 仍调用 `Astro.locals.getNavItems()`，而 SDK middleware 里的 `getNavItems()` 当前只返回空数组。下一步应让内置 frontend 直接消费 build-time Pack registry，把 Pack 导航从旧 plugin nav cache 迁移到 Astro-side registry。

本阶段继续沿用当前 `packs/` 结构，不引入 palette/theme full profile，不扩展 `pack.json`，不改数据库 migration。

## Analysis

- **Affected files**:
  - `app/src/layouts/BaseLayout.astro`：当前 header nav 使用 `pluginNavItems`，来源是 `Astro.locals.getNavItems()`；应改为 import `packs` from `virtual:vanblog/packs` 并渲染 `pack.nav`。
  - `app/src/env.d.ts`：已有 `virtual:vanblog/packs` 声明，可能需要补充字段或保持不变。
  - `sdk/src/server.ts`：`PluginNavItem` 和 `getNavItems()` 仍可保留兼容，但 BaseLayout 不再依赖旧 plugin nav；本阶段尽量不改 SDK，避免扩大影响面。
  - `app/integrations/packs/resolver.mjs` / `resolver.test.mjs`：如果 BaseLayout 需要更明确的 nav semantics，补充 metadata 过滤和测试。
  - `docs/future-pack-architecture.md`：补充 v1 baseline：Pack 导航来自 build-time virtual registry，不再通过 PB/runtime plugin nav。
- **New files**: 无必需新文件。
- **Dependencies**:
  - 已存在 `virtual:vanblog/packs` virtual module。
  - Astro SSR build-time imports。
- **Complexity**: simple / medium
- **Risk areas**:
  - `BaseLayout` 是所有前台/admin 页面共享布局，错误会影响全站。
  - `virtual:vanblog/packs` metadata 必须只含 client-safe 数据，不能泄露 entrypoint paths。
  - 旧 `getNavItems()` 若直接删除可能影响外部调用或类型，暂不删除。

## Phases

### Phase 1: BaseLayout 消费 Pack registry

- **Goal**: Header 导航使用 `virtual:vanblog/packs` 的 build-time Pack metadata，替代旧 runtime plugin nav cache。
- **Files**:
  - `app/src/layouts/BaseLayout.astro`
  - `app/integrations/packs/resolver.mjs`
  - `app/integrations/packs/resolver.test.mjs`
- **Steps**:
  - [x] 在 `BaseLayout.astro` import `{ packs as packMetadata }` from `virtual:vanblog/packs`。
  - [x] 删除或旁路 `Astro.locals.getNavItems()` 调用，生成 `packNavItems = packMetadata.flatMap((pack) => pack.nav ? [pack.nav] : [])`。
  - [x] 在 header nav 中渲染 `{packNavItems.map((item) => <a href={item.href}>...)}`。
  - [x] 增强 resolver 测试，确保 nav href 被规范化到 `/p/<pack>`，不会输出任意路径。
- **Done when**:
  - `/p/bookmarks` 对应导航项“收藏”出现在 header。
  - `BaseLayout` 不再依赖 middleware 的空 `getNavItems()` 来显示 Pack 导航。
  - `pnpm --filter vanblog-app test:packs`、`astro check` 和 `astro build` 通过。

### Phase 2: 文档与兼容边界收口

- **Goal**: 文档明确 Pack 导航 registry 的所有权与旧 plugin nav 的兼容状态。
- **Files**:
  - `docs/future-pack-architecture.md`
  - `.snow/plan/pack-v1-registry-consumption.md`
- **Steps**:
  - [x] 更新 Pack v1 baseline direction：Pack nav 来源是 Astro `pack.ts` → `virtual:vanblog/packs` → BaseLayout。
  - [x] 明确 `getNavItems()` / `PluginNavItem` 是旧 plugin runtime nav 兼容壳，本阶段不删除。
  - [x] 更新计划完成总结与验证结果。
- **Done when**:
  - 文档与实现一致。
  - 计划文件记录完成结果、偏差和验证。

## Risks & Mitigations

| Risk                                  | Impact                       | Mitigation                                                    |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| BaseLayout import virtual module 失败 | 全站 build/check 失败        | 保持 `env.d.ts` module declaration；用 astro check/build 验证 |
| Pack nav href 可指向任意路径          | Pack 可污染核心 nav 或跳外链 | resolver 将 nav.href 规范化为 `/p/<pack>`，测试覆盖           |
| 删除 getNavItems 破坏兼容             | SDK/其他页面类型受影响       | 本阶段不删除 SDK API，只让 BaseLayout 不再消费                |
| Scope 扩大到 Admin Pack UI            | 工作量增大                   | 本阶段只做 header nav + docs                                  |

## Rollback Strategy

本阶段不涉及数据和 migration。若 virtual registry 消费导致布局问题，可恢复 `BaseLayout.astro` 中旧的 `Astro.locals.getNavItems()` 渲染逻辑；`virtual:vanblog/packs` 和 `packs/bookmarks/pack.ts` 可保留，不影响运行。任何 Git 级回滚都需要用户明确授权。

## Completion Summary

**Status**: Completed
**Phases**: 2 / 2

### Results

- `BaseLayout.astro` now imports `virtual:vanblog/packs` and renders Pack public navigation from build-time metadata.
- `Astro.locals.getNavItems()` is no longer used by `BaseLayout` for Pack nav; the SDK/runtime plugin nav shell remains untouched for compatibility.
- Resolver coverage now includes nav href normalization to the Pack-owned `/p/<pack>` namespace.
- `docs/future-pack-architecture.md` documents the Pack nav ownership chain and legacy compatibility boundary.

### Deviations

- The implementation uses `packMetadata.flatMap((pack) => pack.nav ? [pack.nav] : [])` instead of filtering packs and dereferencing `pack.nav` in the template. This avoids non-null assertions in Astro markup while preserving the same behavior.

### Verification

- [x] `pnpm --filter vanblog-app test:packs` passes: 10 tests, 10 pass.
- [x] `pnpm --filter vanblog-app exec astro check` passes: 0 errors, 0 warnings, 0 hints.
- [x] `pnpm --filter vanblog-app build` passes.
- [x] `/p/bookmarks` nav metadata remains normalized to `/p/bookmarks` and is rendered as the `收藏` header link.

### Follow-up

- Future work can replace the current restricted `pack.ts` object-literal parsing with a builder-generated metadata artifact if Pack metadata becomes more expressive.
