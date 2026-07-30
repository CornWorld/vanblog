# Pack v1 Schema Builder CLI

## Status: ✅ Completed

## Context

Pack v1 已经完成通用 `packs/` discovery、Astro-side metadata registry、`virtual:vanblog/packs` 消费，以及 Go 侧 `PackSource` / `ResolveModelSource` 从 Pack `fs.FS` 读取预编译 `schema.js` 的能力。当前缺口是：文档约定 Pack 作者通过 dev image / builder 把 `schema.ts` 编译成 `schema.js`，但仓库还没有 `vanblog pack build` 命令或对应构建入口。

本阶段目标是补齐最小闭环：为本地 Pack 提供一个受控的 schema artifact builder，把 `packs/<name>/schema.ts` 编译为 Pack 目录内的 `schema.js`，供生产 runtime 的 `validation.PackSource` 读取。继续保持 Source / Artifact / Runtime 三层边界：production runtime 不安装依赖、不运行 pnpm/npm、不编译 TypeScript。

## Analysis

- **Affected files**:
  - `vault/internal/packcli/command.go`：新增 `pack build <directory>` 子命令，负责校验 Pack identity、定位 `schema.ts`、调用受控 builder，并输出 artifact 状态。
  - `vault/internal/packcli/command_test.go`：补充 CLI 行为测试，包括无 `schema.ts`、构建成功、错误路径、生成 `schema.js` 后 validate/list 状态变化。
  - `models.config.mjs` / 新增 builder config：现有根 `models.config.mjs` 只构建 core SDK models 到 `vault/internal/validation/models.js`；Pack schema builder 应避免复用该 outDir，建议新增专用 Node 脚本或 Vite config。
  - `package.json`：可能新增内部脚本或保持 CLI 直接调用 `pnpm exec vite` / `node`；需避免影响现有 `build:models`。
  - `docs/future-pack-architecture.md`：更新 schema loading / lifecycle，说明 `pack build` 是 tool/dev-image 阶段能力，runtime 只消费 `schema.js`。
  - `.snow/plan/pack-v1-schema-builder-cli.md`：记录执行结果和验证。
- **New files**:
  - `scripts/pack-schema-build.mjs` 或 `pack-schema.config.mjs`：用于把单个 Pack 的 `schema.ts` 构建成 CJS `schema.js`，输出格式必须兼容 `validation.PackSource`：`exports.models = ...`。
  - 可选：`packs/bookmarks/schema.ts` 测试夹具。如果当前 Bookmarks Pack 没有 schema 扩展，可在测试中创建临时 Pack fixture，避免扩大 builtin Pack scope。
- **Dependencies**:
  - 已有 Vite、TypeScript workspace、Zod model bundle 构建经验。
  - Go CLI 使用 Cobra；可以通过 `os/exec` 调用本地 Node/Vite builder，但必须只发生在 `vanblog pack build` tool path，不在 `serve` runtime path。
  - Go runtime 已有 `validation.PackSource` 读取 Pack `schema.js`。
- **Complexity**: medium
- **Risk areas**:
  - Builder 输出格式不兼容 Goja / `exports.models`。
  - CLI 调用 Node/Vite 的路径、cwd、跨平台行为不稳定。
  - 把构建逻辑误放入 runtime，破坏 Source / Artifact / Runtime 边界。
  - `schema.js` 写入 Pack source 目录可能覆盖用户文件；需要明确 overwrite 策略。
  - 多 Pack schema 合并仍未实现；本阶段只构建单 Pack artifact，不解决多 Pack merge。

## Phases

### Phase 1: 定义并实现最小 Pack schema builder

- **Goal**: 提供一个可由 CLI 调用的受控 builder，将单个 Pack 的 `schema.ts` 编译为 CJS `schema.js`。
- **Files**:
  - `scripts/pack-schema-build.mjs`（或等价新文件）
  - `package.json`（如需增加脚本）
  - 临时测试 fixture 由 Go tests 创建，默认不要求改 builtin `packs/bookmarks/`
- **Steps**:
  - [x] 设计 builder 输入参数：Pack 目录、可选输出路径，默认输出 `<packDir>/schema.js`。
  - [x] 校验 `schema.ts` 存在；不存在时输出明确 “nothing to build / no schema.ts” 状态。
  - [x] 使用 Vite Node API 构建 CJS artifact，target 与 `models.config.mjs` 保持 Goja 已验证兼容范围。
  - [x] 约束输出格式必须暴露 `exports.models`；构建后做轻量文本校验。
- **Done when**:
  - 对临时 Pack fixture 执行 builder 后生成 `schema.js`。
  - `schema.js` 可被 `validation.RegisterWithSource` / `compileProgram` / `loadModels` 测试路径接受。

### Phase 2: 接入 `vanblog pack build`

- **Goal**: 在 Pack CLI 增加 `build <directory>` 命令，作为 dev-image/tooling 阶段入口。
- **Files**:
  - `vault/internal/packcli/command.go`
  - `vault/internal/packcli/command_test.go`
- **Steps**:
  - [x] 新增 `pack build <directory>`，先复用 `pack.LoadLocal` / `pack.ValidateV0` 校验 Pack source。
  - [x] 如果没有 `schema.ts` 且没有其他本阶段支持的 artifact 输入，输出稳定提示并成功返回 no-op 状态。
  - [x] 如果存在 `schema.ts`，调用 builder 生成 `schema.js`；builder 使用临时目录输出后 rename 到 Pack 目录。
  - [x] 测试 CLI 成功构建、无 schema no-op、生成 artifact 可被 `validation.PackSource` 读取。
- **Done when**:
  - `go test ./internal/packcli ./internal/validation` 通过。
  - `vanblog pack build <temp-pack>` 能生成 runtime 可消费的 `schema.js`。

### Phase 3: 文档、计划总结与回归验证

- **Goal**: 文档与实现对齐，验证 Pack builder 不破坏现有 Pack/Astro/validation 路径。
- **Files**:
  - `docs/future-pack-architecture.md`
  - `.snow/plan/pack-v1-schema-builder-cli.md`
- **Steps**:
  - [x] 更新 lifecycle / schema loading 文档：`pack build` 属于 tool/dev-image 阶段，runtime 只消费 artifact。
  - [x] 明确本阶段只处理单 Pack `schema.ts -> schema.js`，不做多 Pack schema merge / hash manifest / signed artifact。
  - [x] 运行 Go 定向测试、模型测试、Astro Pack 测试、Astro check/build。
  - [x] 更新计划 Completion Summary。
- **Done when**:
  - `go test ./internal/pack ./internal/packcli ./internal/validation` 通过。
  - `pnpm test:models:types`、`pnpm test:models:fixtures` 通过。
  - `pnpm --filter vanblog-app test:packs`、`pnpm --filter vanblog-app exec astro check`、`pnpm --filter vanblog-app build` 通过。
  - 文档明确不把 palette/theme/admin SPA 混入本阶段。

## Risks & Mitigations

| Risk                      | Impact                            | Mitigation                                                                        |
| ------------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| Builder 输出不兼容 Goja   | Pack schema artifact runtime 失败 | 复用 `validation` 测试路径校验 `exports.models`，构建 target 保守选择             |
| CLI 调用 Node/Vite 不稳定 | `pack build` 在不同 cwd 下失败    | 使用绝对路径、显式 cwd，并在测试覆盖临时目录调用                                  |
| Runtime 被引入构建依赖    | 破坏生产边界                      | 只在 `packcli` build 子命令中调用 builder；`serve` 路径不变                       |
| 写坏用户已有 `schema.js`  | 本地 Pack artifact 丢失           | 使用临时文件 + rename；如需覆盖，输出明确提示；失败时保留旧文件                   |
| 多 Pack schema 仍不可合并 | 多个 Pack schema 不能同时生效     | 文档标为下一阶段；当前继续保持 `ResolveModelSource` 选择第一个 `schema.js` 的限制 |

## Rollback Strategy

本阶段不涉及数据库 migration。若 `pack build` 引入问题，可删除新增 CLI 子命令和 builder 文件，恢复文档到仅说明外部/dev-image builder 的状态；已生成的 `schema.js` 是 Pack source/artifact 文件，可由用户删除或重新生成。任何 Git 级回滚都需要用户明确授权。

## Completion Summary

**Status**: Completed
**Phases**: 3 / 3

### Results

- Added `scripts/pack-schema-build.mjs`, a controlled Node/Vite builder that compiles a single Pack `schema.ts` into CJS `schema.js` and checks that the artifact exposes `exports.models`.
- Added `vanblog pack build <directory>` through `vault/internal/packcli/command.go`; it validates local Pack source, resolves the repository builder script from varying cwd values, and invokes Node only in the CLI/tooling path.
- Extended `vault/internal/packcli/command_test.go` to cover no-schema no-op and schema artifact generation readable by `validation.PackSource`.
- Updated `docs/future-pack-architecture.md` to document `pack build` as a tool/dev-image phase, while production runtime continues to consume artifacts only.

### Deviations

- The test fixture uses a minimal `safeParse` model object rather than importing Zod. This keeps the CLI test focused on artifact shape and `PackSource` readability, while existing model tests continue to cover Zod schemas.
- The current builder remains a single-Pack artifact builder. Multi-Pack schema merge, hash manifests, compatibility fingerprints and signed remote artifacts are explicitly deferred.

### Verification

- [x] `go test ./internal/pack ./internal/packcli ./internal/validation`
- [x] `go build ./...`
- [x] `pnpm test:models:types`
- [x] `pnpm test:models:fixtures`
- [x] `pnpm --filter vanblog-app test:packs`
- [x] `pnpm --filter vanblog-app exec astro check`
- [x] `pnpm --filter vanblog-app build`

### Follow-up

- Implement multi-Pack schema merge so multiple Packs can contribute schema models simultaneously.
- Add schema/artifact hash metadata to detect stale or mismatched Pack artifacts.
- Decide whether `pack build` should later emit a managed artifact directory instead of writing `schema.js` into the Pack source tree.
