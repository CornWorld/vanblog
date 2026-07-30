# Pack Phase 3: Pack-side Schema Loading

## Status: ✅ Completed

## Context

Pack v0 完成了 kernel / hook staging / Astro page injection / CLI / runtime skip+warn。Schema validation 有 `ModelSource` 接口和 `EmbeddedSource` 实现，但 `main.go` 只用 embedded bundle（`go:embed models.js`），不从 Pack FS 读 schema。

文档 `future-pack-architecture.md` §Schema loading direction 的 resolution rules：

1. Load a validated external resolved bundle when configured.
2. Otherwise load the embedded default bundle.
3. Compile once and validate through fresh Goja runtimes as today.
4. Atomically retain the last known-good bundle if generating a replacement fails.

本 Phase 实现规则 1 的第一切片：从 resolved loadable Pack 的 `fs.FS` 读取预编译的 `schema.js` CJS bundle，替代 `EmbeddedSource` 作为 validation source。

## 架构验证发现

### 问题：validation.Register 调用时机

当前 `main.go` 结构：

```
main() {
  app := pocketbase.New()
  app.OnServe().BindFunc(func(event) {  // ← Pack resolution 在这里
    builtins := pack.Builtins(...)
    locals := pack.DiscoverLocal(...)
    resolved := pack.Resolve(...)
    loadable := pack.RuntimeLoadableV0(...)
    pack.StageHooks(...)
    return event.Next()
  })
  // ↓ validation.Register 在 OnServe 外面，用 EmbeddedSource
  validation.Register(app)  // ← line 121，此时 Pack 还没 resolve
}
```

`validation.Register(app)` 调用 `RegisterWithSource(app, EmbeddedSource{})`，立即 bind `OnRecordValidate` hook。此时 `OnServe` 还没执行，Pack 不可用。

### 解决方案：把 validation 注册移到 OnServe 内

```go
app.OnServe().BindFunc(func(event *core.ServeEvent) error {
    // ... existing Pack resolution ...

    // 从 loadable Packs 查找 schema.js
    source := resolveModelSource(loadable)  // PackSource 或 EmbeddedSource
    if err := validation.RegisterWithSource(app, source); err != nil {
        return err
    }

    return event.Next()
})
```

**安全性**：`OnRecordValidate` 在 `OnServe` 之后才会触发（用户请求时），所以在 `OnServe` 内注册 validation 是安全的。PocketBase 的生命周期是 Bootstrap → Migrate → Serve，validation 不会在 Bootstrap/Migrate 阶段触发。

## Analysis

- **Affected files**:
  - `vault/internal/validation/validation.go`：新增 `PackSource` struct
  - `vault/internal/validation/validation_test.go`：测试 `PackSource`
  - `vault/main.go`：移动 `validation.Register` 到 `OnServe` 内，用 resolved Pack 构建 source
- **New files**: 无
- **Dependencies**: goja（已在用）、`io/fs`（标准库）
- **Complexity**: medium
- **Risk areas**:
  - `OnRecordValidate` 注册时机后移到 `OnServe` — 需验证 Bootstrap/Migrate 阶段不会触发 record validation
  - Pack `schema.js` 格式必须与 `models.js` 一致（CJS，`exports.models = { ... }`）
  - 多 Pack 各自带 schema 的情况 — 第一切片只从第一个找到 schema.js 的 Pack 读取，不做合并

## Phases

### Phase 1: PackSource 实现

- **Goal**: 新增 `PackSource` struct，从 `fs.FS` 读取 `schema.js`，实现 `ModelSource` 接口
- **Files**: `vault/internal/validation/validation.go`, `vault/internal/validation/validation_test.go`
- **Steps**:
  - [ ] 在 `validation.go` 新增 `PackSource` struct，持有 `fs.FS` 和 pack name
  - [ ] 实现 `Load() ([]byte, error)`：从 FS 读 `schema.js`，文件不存在返回 `fs.ErrNotExist`
  - [ ] 新增 `ResolveModelSource(packs []pack.Pack) ModelSource`：遍历 loadable packs，找第一个有 `schema.js` 的，返回 `PackSource`；否则返回 `EmbeddedSource{}`
  - [ ] 测试：正常加载、文件缺失 fallback、损坏 JS fail-closed、exports.models 缺失 fail-closed
  - [ ] 测试：多 Pack 场景（第一个有 schema.js 的优先）
- **Done when**: `go test ./internal/validation/...` 通过；`go build ./...` 通过

### Phase 2: main.go 集成

- **Goal**: 把 validation 注册移到 `OnServe` 内，使用 resolved Pack 的 schema
- **Files**: `vault/main.go`
- **Steps**:
  - [ ] 删除 `main()` 顶层的 `validation.Register(app)` 调用
  - [ ] 在 `OnServe` 回调内，`StageHooks` 之后，调用 `validation.ResolveModelSource(loadable)` 获取 source
  - [ ] 调用 `validation.RegisterWithSource(app, source)`
  - [ ] 确保 `app.OnServe()` 回调返回 error 时正确传播
- **Done when**: `go build ./...` 通过；`go test ./...` 通过；`go vet ./...` 通过

### Phase 3: 文档与回归验证

- **Goal**: 更新文档，运行完整回归
- **Files**: `docs/future-pack-architecture.md`
- **Steps**:
  - [ ] 更新 §Schema loading direction，标注 Phase 3 已实现 Pack-side schema loading
  - [ ] 运行 `go test ./internal/pack ./internal/packcli ./internal/validation`
  - [ ] 运行 `go test ./...`
  - [ ] 运行 `go build ./...`
  - [ ] 运行 `pnpm test:models:types` 和 `pnpm test:models:fixtures`
  - [ ] 运行 `pnpm --filter vanblog-app build`
  - [ ] 运行 `pnpm --filter vanblog-app test:e2e:cache`
  - [ ] 运行 `docker buildx build --check .`
  - [ ] `git diff --check`
- **Done when**: 全部通过

## Risks & Mitigations

| Risk                                   | Impact                                 | Mitigation                                                                                                                                |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `OnRecordValidate` 在 `OnServe` 前触发 | validation 不生效                      | PocketBase 生命周期保证 Bootstrap→Migrate→Serve，record validate 只在 Serve 阶段的 HTTP 请求中触发                                        |
| Pack `schema.js` 格式不匹配            | goja 运行时错误                        | `RegisterWithSource` 已有 `loadModels` 验证 + fail-closed；`PackSource.Load` 返回的 bytes 经过同样的 `compileProgram` + `loadModels` 检查 |
| 多 Pack 各自带 schema                  | 只用第一个，后续 Pack 的 schema 被忽略 | 第一切片接受这个限制；未来可做合并 builder                                                                                                |
| Builtin Pack 没有 `schema.js`          | 不影响——fallback 到 `EmbeddedSource`   | `ResolveModelSource` 找不到 `schema.js` 时返回 `EmbeddedSource{}`                                                                         |

## Rollback Strategy

如果 `OnServe` 内注册 validation 导致问题，恢复 `main()` 顶层的 `validation.Register(app)` 调用，删除 `PackSource` 和 `ResolveModelSource`。不影响 Pack v0 的其他功能。

## Completion Summary

**Status**: Completed
**Phases**: 3 / 3

### Results

- `vault/internal/validation/validation.go`：新增 `PackSource` struct（从 `fs.FS` 读 `schema.js`）、`ResolveModelSource` 函数（遍历 loadable packs，返回第一个有 `schema.js` 的 `PackSource`，否则 fallback `EmbeddedSource`）。
- `vault/internal/validation/validation_test.go`：5 个新测试覆盖正常加载、缺失文件、fallback、多 Pack 优先级、空 packs fallback。
- `vault/main.go`：删除顶层 `validation.Register(app)` 调用，在 `OnServe` 回调内 `StageHooks` 之后调用 `validation.ResolveModelSource` + `RegisterWithSource`。
- `docs/future-pack-architecture.md`：§Schema loading direction 标注 Phase 3 已实现。

### Verification

- [x] `go test ./internal/validation/...`（11 tests pass）
- [x] `go test ./internal/pack ./internal/packcli`
- [x] `go test ./...`
- [x] `go build ./...`
- [x] `go vet ./...`
- [x] `pnpm test:models:types`
- [x] `pnpm test:models:fixtures`
- [x] `pnpm --filter vanblog-app build`
- [x] `pnpm --filter vanblog-app test:e2e:cache`
- [x] `docker buildx build --check .`
- [x] `git diff --check`

### Deviations

- 无偏差。实现与计划完全一致。

### Follow-up

1. `vanblog pack build` CLI 命令：把 `schema.ts` 编译为 `schema.js`（dev image builder）
2. 多 Pack schema 合并：多个 Pack 各自带 schema 时合并为一个 models registry
3. schema hash 校验：防止 schema bundle 与 migration 不匹配
