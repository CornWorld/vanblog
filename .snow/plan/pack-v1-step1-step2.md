# Pack v1 Step 1/2 基建推进

## Status: ✅ Completed

## Context

用户确认继续沿用当前 `packs/` 结构推进 Pack 基建，并修正之前关于 Go embedded validator 的判断：Go 侧已经有 `ModelSource` / `PackSource` 边界，`schema.js` 可从 Pack `fs.FS` 或后续外部 resolved artifact 加载，`go:embed` 只是默认 fallback，不应在文档中继续表述为永久必需路径。

本轮只执行两个基础步骤：

1. **Step 1**：解除 Pack v0 中的 `bookmarks` 硬编码，改为通用 `packs/` discovery。
2. **Step 2**：建立 Astro-side Pack registry / metadata 基础，保持 `pack.json` 最小，只把展示元数据放在 Pack 的 Astro 层。

调色盘 / palette 不纳入 Pack；它属于后续 Astro lib + Van API appearance 能力。

## Analysis

- **Affected files**:
  - `vault/internal/pack/source.go`：当前 `Builtins(root fs.FS)` 硬编码 `bookmarks`，需改为扫描 `packs/*/pack.json`。
  - `vault/internal/pack/*_test.go`：需要补充 builtin 多 Pack、排序、目录名与 identity 不一致、无效 pack 的测试。
  - `app/integrations/packs/resolver.mjs`：当前只验证调用方传入的 definitions，需新增从 `packs/` 发现 pages 与 metadata 的能力。
  - `app/integrations/packs/index.mjs`：当前硬编码 `bookmarksPage`，需改成读取 `packs/*` 后注入 route。
  - `app/src/env.d.ts`：需要声明新的 virtual module，例如 `virtual:vanblog/packs`，并保留 `vanblog:theme`。
  - `packs/bookmarks/pack.ts`：新增 Astro-side metadata，保存 title/nav 等展示信息，不污染 `pack.json`。
  - `docs/future-pack-architecture.md`：更新 schema loading 方向，明确 embedded validator 只是 fallback，外部 / Pack resolved schema bundle 是可行路径；同时记录 v1 step1/step2 的当前方向。
- **New files**:
  - `packs/bookmarks/pack.ts`：Pack Astro metadata。
  - 可能新增 `app/integrations/packs/resolver.test.mjs` 或扩展已有测试（若项目已有 Node test 约定则遵循）。
- **Dependencies**:
  - Go stdlib `io/fs`。
  - Astro integration `injectRoute`。
  - Vite virtual module plugin API。
  - 当前 `@vanblog/sdk` 与 `Astro.locals.pb` 数据访问保持不变。
- **Complexity**: medium
- **Risk areas**:
  - Astro route injection 必须在 config setup 阶段得到确定 entrypoint，不能运行时扫描。
  - Vite virtual module 不能泄露绝对路径到 client-safe metadata。
  - Go builtin discovery 与 local discovery 的语义要保持一致：`pack.json` 仍只允许 `name/version`。
  - docs 中不能把 schema loading 重新写死为 `go:embed`。

## Phases

### Phase 1: 通用 Pack discovery（Go + Astro）

- **Goal**: 当前 `packs/` 目录下的 builtin Packs 自动被 Go 与 Astro 发现，不再硬编码 `bookmarks`。
- **Files**:
  - `vault/internal/pack/source.go`
  - `vault/internal/pack/pack_test.go` 或新增/修改相关测试
  - `app/integrations/packs/resolver.mjs`
  - `app/integrations/packs/index.mjs`
- **Steps**:
  - [ ] 将 Go `Builtins(root fs.FS)` 改为扫描 root 直接子目录，读取每个 `pack.json`，校验 name/version、目录名匹配、排序稳定。
  - [ ] 将 Astro integration 的 `bookmarksPage` 硬编码改为 resolver 扫描 `packs/*/pages/index.astro`。
  - [ ] 保持 v1 只支持 `pages/index.astro -> /p/<pack>`，非法页面类型暂不支持并给出明确错误。
  - [ ] 补充测试或最小验证覆盖排序、非法名称、重复/冲突、缺 entrypoint。
- **Done when**:
  - `/p/bookmarks` 仍由 Pack Astro 页面注入。
  - 新 discovery 不依赖硬编码 `bookmarks`。
  - `go test ./internal/pack/...` 通过。
  - `pnpm --filter vanblog-app exec astro check` 与 `pnpm --filter vanblog-app build` 通过。

### Phase 2: Astro Pack registry / metadata 与文档修正

- **Goal**: 建立 Pack Astro-side metadata 边界，并更新文档明确 embedded validator 只是 fallback。
- **Files**:
  - `packs/bookmarks/pack.ts`
  - `app/integrations/packs/resolver.mjs`
  - `app/integrations/packs/index.mjs`
  - `app/src/env.d.ts`
  - `docs/future-pack-architecture.md`
- **Steps**:
  - [ ] 新增 `packs/bookmarks/pack.ts`，导出 JSON-safe metadata（例如 `title`, `nav`），`pack.json` 继续只保留 `name/version`。
  - [ ] 在 integration 中生成 `virtual:vanblog/packs` client-safe metadata module，供后续 BaseLayout/admin 使用；本阶段可先不改布局消费，避免扩大 scope。
  - [ ] `vanblog:theme` 继续只提供当前 `Page` host，不在本阶段扩展完整 theme contract。
  - [ ] 更新 `docs/future-pack-architecture.md` 的 schema loading 章节：`go:embed models.js` 是默认内置 fallback；Pack/external resolved `schema.js` 已具备实现基础，后续可以不依赖 embedded 作为唯一 validator 来源。
- **Done when**:
  - `virtual:vanblog/packs` 可被 TypeScript/Astro 识别，且不泄露 server-only path/secret。
  - `packs/bookmarks/pack.ts` metadata 可被 integration 读取。
  - 文档与当前实现一致，不再暗示 Go embedded validator 是唯一方向。
  - Astro check/build 通过，无新增 diagnostics。

## Risks & Mitigations

| Risk                               | Impact                             | Mitigation                                                                                |
| ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Astro integration 扫描时机不对     | Pack route 未注入或 dev HMR 不稳定 | 在 `astro:config:setup` 同步扫描 filesystem；只支持简单 `pages/index.astro`               |
| client virtual module 泄露绝对路径 | 暴露镜像/宿主路径                  | `virtual:vanblog/packs` 只输出 JSON-safe `name/version/nav/routes`，entrypoint 仅内部使用 |
| Go discovery 接受无效目录          | builtin Pack 启动不确定            | 严格复用 `validateIdentity`、目录名匹配、`Validate(p)` 和稳定排序                         |
| 文档与实现再次漂移                 | 后续设计误判 embedded validator    | 在同一阶段更新 `future-pack-architecture.md`，明确 fallback/外部 source 关系              |
| Scope 膨胀到 palette/theme         | 影响 Pack 基建收敛                 | 本轮不实现 palette，不实现 full theme，只保留 `vanblog:theme.Page` host                   |

## Rollback Strategy

本轮变更不涉及数据库 migration、数据删除或 Pack uninstall。若 Astro discovery 失败，可临时恢复 `app/integrations/packs/index.mjs` 中的硬编码 `bookmarks` route；若 Go builtin discovery 失败，可恢复 `source.go` 的单 builtin bookmarks 逻辑。文档修改可独立回退，不影响运行时。任何 Git 级回滚都需要用户另行明确授权。

## Completion Summary

**Status**: Completed
**Phases**: 2 / 2

### Results

- `vault/internal/pack/source.go` 的 builtin Pack 加载已从硬编码 `bookmarks` 改为扫描 `packs/` 直接子目录，并保持 `pack.json` 仅 `name/version`、目录名匹配和稳定排序。
- `app/integrations/packs/index.mjs` 已改为通过 `discoverPacks()` 扫描 `packs/*/pages/index.astro` 并注入 `/p/<pack>` route。
- `app/integrations/packs/resolver.mjs` 增加 Pack discovery、identity 校验、metadata 读取和 client-safe metadata 生成。
- 新增 `virtual:vanblog/packs` 类型声明，virtual module 只暴露 JSON-safe metadata，不暴露 entrypoint 绝对路径。
- 新增 `packs/bookmarks/pack.ts`，把 title/nav 等展示元数据放在 Astro adapter 层，`pack.json` 继续保持最小身份文件。
- 更新 `docs/future-pack-architecture.md`，明确 `go:embed models.js` 只是 fallback，不是唯一 validator；当前 `PackSource` / `EmbeddedSource` 选择边界已经支持后续外部或 Pack-provided `schema.js` artifact。

### Deviations

- 为避免 Node 直接 import `.ts` metadata 的运行时兼容问题，`resolver.mjs` 对 `pack.ts` 使用受限 `export default <object>` 读取方式；当前 metadata 文件必须是 JSON-safe object literal，不执行任意复杂 TS 逻辑。
- 本阶段没有改 BaseLayout 消费 `virtual:vanblog/packs`，只建立 registry 边界，符合原计划避免扩大 scope。

### Verification

- [x] `cd vault && go test ./internal/pack/...` 通过。
- [x] `pnpm --filter vanblog-app test:packs` 通过，9 个 resolver 测试全部通过。
- [x] `pnpm --filter vanblog-app exec astro check` 通过，0 errors / 0 warnings / 0 hints。
- [x] `pnpm --filter vanblog-app build` 通过。
- [x] IDE diagnostics 尝试获取失败：IDE connection not available；已由 Go/Astro/Node 测试覆盖。

### Follow-up

- 后续可让 `BaseLayout` 或 Admin UI 消费 `virtual:vanblog/packs` 生成导航/诊断视图。
- 后续可把 Pack metadata 读取从受限 object literal 升级为 builder 产物，继续避免 client 泄露 build/server 路径。
- Palette/appearance 仍应走 Astro appearance lib + Van API，不进入 Pack kernel。
