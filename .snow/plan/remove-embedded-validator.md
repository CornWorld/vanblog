# Remove Embedded Core Validator

## Status: ✅ Completed

## Context

当前 Pack runtime 已支持从 Pack artifact 加载 schema，但 `vault/internal/validation/validation.go` 仍通过 `go:embed models.js` 提供 `EmbeddedSource`，`main.go` 也把它作为 core fallback。这样只是“解耦了接口”，没有真正完成最初的 core schema artifact 化目标。

本阶段将把 core models 也纳入 artifact pipeline：core schema 在 Node/Vite 构建阶段生成独立的 runtime artifact，Go/PocketBase 只从 artifact 加载，不再 embed `models.js`。

## Analysis

- **Affected files**:
  - `models.config.mjs`：core schema artifact 的生成目标从 `vault/internal/validation/models.js` 迁移到受控 artifact 目录。
  - `vault/internal/validation/validation.go`：删除 `go:embed`、`modelsScript`、`EmbeddedSource`；保留通用 `ModelSource`、`PackSource` 和多 source registry。
  - `vault/internal/validation/validation_test.go`：测试 source-based core loading，删除对 embedded bundle 的直接依赖。
  - `vault/main.go`：启动时从 core artifact source 加载 core schema，再加载所有 Pack schema；core artifact 缺失或非法时明确失败。
  - `Dockerfile`：增加 core schema artifact build stage，并把 artifact 复制到 Go build stage 和最终 runtime image；Go build 不再复制 embedded `models.js`。
  - `scripts/pack-schema-build.mjs` 或新增 core builder config：复用受控 Vite 构建能力，生成 core CJS artifact。
  - `docs/future-pack-architecture.md`：把 embedded 描述改为已移除，说明 core artifact 与 Pack artifacts 的生产边界。
  - `.snow/plan/complete-zod-business-schema-integration.md`：同步旧的 models.js/embed 方案说明，避免文档互相矛盾。
- **New files**:
  - 候选：`core-schema.config.mjs` 或 `schemas/core/schema.ts`，用于声明 core artifact 输入；具体形态在实施阶段依据现有 SDK 构建配置确定。
  - 候选：`packs/core/` 仅用于 artifact ownership，不应自动注册为 public Pack，除非实现明确将 core 与 public Pack discovery 分离。
- **Dependencies**: Vite/Node build stage、`@vanblog/sdk` models、Goja、Docker multi-stage copy。
- **Complexity**: complex。
- **Risk areas**:
  - core schema artifact 必须在 Go compilation 之前生成，否则 Go build 无法验证/运行。
  - core schema 不能误变成 public Pack route/nav，也不能改变 Pack whole-replacement 语义。
  - 当前 `moments` Pack schema 与 core models 重名；移除 embedded 后应改为 core artifact fallback + Pack override policy，或明确 ownership，不能继续依赖隐式 embedded。
  - 本地非 Docker Go build 的开发体验需要明确：先运行 core schema builder，还是提供显式 dev bootstrap 命令。
  - 删除 `models.js` 后所有测试、文档、脚本和 CI 引用都必须清理。

## Target Contract

```text
Node/Vite build stage:
  core schema source -> core schema.js artifact
  packs/<name>/schema.ts -> packs/<name>/schema.js

Go/PocketBase runtime:
  core schema.js artifact + Pack schema.js artifacts
  -> validation registry

Forbidden in final design:
  go:embed models.js
  EmbeddedSource fallback
  production Node/Vite compilation
```

Core artifact is mandatory for serve/runtime. Unlike an optional local Pack, a missing or invalid core artifact is a build/runtime error, not a warning-and-skip condition.

## Phases

### Phase 1: Lock core artifact ownership and build contract

- **Goal**: decide where core schema source/artifact lives without exposing it as a public Pack.
- **Files**: `models.config.mjs`, Dockerfile, SDK model registry, docs.
- **Steps**:
  - [ ] Trace current model entrypoint and package resolution.
  - [ ] Choose a non-public core artifact path and generated output path.
  - [ ] Define local build command and Docker stage ordering.
- **Done when**: core artifact can be generated before Go build and is not discovered as a public route Pack.

### Phase 2: Remove Go embedded source

- **Goal**: make Go validation consume only explicit sources.
- **Files**: `vault/internal/validation/validation.go`, `validation_test.go`, `vault/main.go`.
- **Steps**:
  - [ ] Remove `go:embed models.js`, `modelsScript`, and `EmbeddedSource`.
  - [ ] Add an explicit filesystem core source, using `PackSource` or a named equivalent.
  - [ ] Keep Pack-to-Pack deterministic ordering and collision behavior.
  - [ ] Make missing/invalid core artifact fatal.
- **Done when**: no runtime code or test depends on `EmbeddedSource` or embedded model bytes.

### Phase 3: Migrate build and production images

- **Goal**: produce and ship core artifact through the same controlled pipeline.
- **Files**: `models.config.mjs` or core builder config, Dockerfile, package scripts, `.gitignore`.
- **Steps**:
  - [ ] Build core `schema.js` in a Node/Vite stage.
  - [ ] Validate artifact with Goja before Go compilation or image promotion.
  - [ ] Copy core artifact into Go build context and final runtime image.
  - [ ] Preserve independent Pack artifact builds.
- **Done when**: Docker build/check passes and production runtime contains core + Pack artifacts without Node/Vite runtime compilation.

### Phase 4: Tests, docs, and migration cleanup

- **Goal**: remove stale embedded assumptions and prove the new contract.
- **Files**: validation tests, docs, plans, scripts.
- **Steps**:
  - [ ] Add missing/invalid core artifact tests.
  - [ ] Update all docs that describe `go:embed` as fallback/current behavior.
  - [ ] Run Go, model, Astro, Docker, and diff verification.
  - [ ] Record any deliberate compatibility behavior for moments/core model overlap.
- **Done when**: repository has no active `EmbeddedSource`/`go:embed models.js` path, all verification passes, and no unrelated dirty files are changed.

## Risks & Mitigations

| Risk                                             | Impact                                         | Mitigation                                                                                               |
| ------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Go build starts before core artifact exists      | Build failure or stale schema                  | Dedicated build stage and explicit artifact copy before `go build`                                       |
| Core artifact accidentally becomes public Pack   | Unexpected nav/routes or replacement semantics | Keep core artifact outside public `packs/` discovery or add explicit non-public filtering                |
| Local Go developer workflow becomes confusing    | Frequent failed builds                         | Document `pnpm build:models`/core artifact command and add a clear missing-artifact error                |
| Removing embedded reveals stale references       | Test/CI regressions                            | Search all `modelsScript`, `EmbeddedSource`, `models.js`, and embed references before final verification |
| Pack/core duplicate model names remain ambiguous | Validation semantics change                    | Preserve explicit v1 policy temporarily and document future ownership tightening                         |

## Rollback Strategy

Revert the artifact-path, Docker, Go source, tests, and documentation changes together. Do not restore generated `models.js` as a new source of truth; if rollback is required, restore the prior commit's complete embedded path consistently.

## Completion Summary

**Status**: Completed
**Phases**: 4 / 4

### Results

- Core schema now builds to `runtime/core-schema/models.js` and is passed explicitly via `--coreSchemaPath`.
- Go runtime no longer embeds model bytes or uses `EmbeddedSource`.
- Docker builds and ships `/core/models.js`; Pack artifacts remain independent.
- Documentation and generated-artifact ignore rules reflect the new ownership contract.

### Verification

- [x] Go tests, build, and vet pass
- [x] Core model artifact builds successfully
- [x] Core/Pack ownership collision policy is enforced
- [x] Dockerfile static check passes
- [x] `git diff --check` passes
- [x] No active Go `EmbeddedSource`, `modelsScript`, or `go:embed models.js` references
- [x] Moments is Pack-owned and removed from core `models` aggregation

## Acceptance Criteria

- [x] No `//go:embed models.js` remains in active validation code.
- [x] No `EmbeddedSource` remains in active runtime code.
- [x] Core schema is generated as an explicit CJS artifact before Go build.
- [x] Runtime loads core artifact plus all Pack artifacts.
- [x] Missing/invalid core artifact fails clearly and deterministically.
- [x] Pack discovery does not expose core artifact as a public Pack.
- [x] `go test ./...`, `go build ./...`, `go vet ./...`, model tests, Docker check, and `git diff --check` pass.
- [x] Palette/theme ownership and current `packs/` structure remain unchanged.
