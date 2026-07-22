# Pack v1 下一阶段：多 Pack Schema 与产品边界

## Context

`moments` 已证明 Pack v1 的 discovery、metadata、route、hook staging、schema builder、Goja validation、Docker production build 可以被第二个 Pack 复用，且不需要 Pack kernel 特殊处理。

当前瓶颈是旧的 `ResolveModelSource` first-wins 语义：多个 Pack 的 schema 不能同时参与 runtime validation。本轮将其替换为确定性的多 source registry；Pack 生命周期仍是后续产品计划，不在本轮实现。

## Contract

- Pack schema 按 Pack name 稳定排序。
- 两个 Pack 声明同名 model 时 fatal，错误包含两个 Pack 名称。
- Pack model 优先于 embedded core model，以兼容当前 moments schema 与 embedded fallback 同名的现实。
- embedded core model 作为 Pack 未声明模型的 fallback。
- 每个 Pack 保留独立 `schema.js`；runtime 逻辑聚合，不增加生产 Node/Vite 步骤。
- 生命周期（install/enable/disable/upgrade/uninstall）单独设计。

## Phases

### Phase 1: Contract

- [x] 识别 first-wins 瓶颈。
- [x] 锁定排序、冲突、override 和 fallback 语义。

### Phase 2: Deterministic aggregation

- [x] 新增 `NamedModelSource`。
- [x] 新增 `RegisterWithSources`，按 Pack 名称排序并校验 Pack-to-Pack 冲突。
- [x] 保持 embedded core fallback，并允许单 Pack override core。
- [x] main runtime 加载全部可用 Pack schema。

### Phase 3: Build/production contract

- [x] 保持单 Pack `pack build` 和 Docker per-Pack schema build。
- [x] 确认生产 runtime 不启动 Node/Vite。

### Phase 4: Documentation and verification

- [x] 更新 architecture 文档，移除 runtime first-wins 描述。
- [x] 添加多 source、排序、冲突和 override 测试。
- [x] 完成全量验证（含 `docker buildx build --check .`，无 warning）。

## Risks & Mitigations

| Risk                                  | Impact                              | Mitigation                                                                   |
| ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| Pack-to-Pack model collision          | 不确定的 validation semantics       | fatal error with both Pack names                                             |
| Pack silently changes core validation | core behavior changes unexpectedly  | document explicit v1 override rule; lifecycle/trust policy remains follow-up |
| Runtime starts Node/Vite              | production complexity/security risk | independent per-Pack artifacts, Goja-only runtime                            |
| Local Pack schema unavailable         | Pack model skipped                  | existing runtime loadability warnings and build guidance                     |

## Completion Summary

**Status**: Completed
**Phases**: 4 / 4

### Results

- Replaced runtime first-wins schema selection with `RegisterWithSources`.
- Added stable Pack-name ordering and explicit Pack-to-Pack model collision errors.
- Preserved embedded core models as fallback and allowed one Pack to override an embedded model for the current moments compatibility case.
- Kept independent per-Pack artifacts and the existing Docker per-Pack build path; production runtime remains Goja-only.
- Recorded Pack lifecycle as a separate follow-up rather than expanding this change.

### Verification

- [x] `cd vault && go test ./...`
- [x] `cd vault && go build ./...`
- [x] `cd vault && go vet ./...`
- [x] `pnpm test:models:types && pnpm test:models:fixtures`
- [x] `pnpm --filter vanblog-app test:packs`
- [x] `pnpm --filter vanblog-app exec astro check`
- [x] `pnpm --filter vanblog-app build`
- [x] `docker buildx build --check .`
- [x] `git diff --check`

### Follow-up

- Pack lifecycle remains a separate product design task: install, enable, disable, upgrade, uninstall and version conflict handling.
- The compatibility rule allowing Pack override of embedded core models should become stricter once core/Pack ownership is fully separated.
