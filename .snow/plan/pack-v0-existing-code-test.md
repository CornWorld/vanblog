# Pack v0 现有代码与功能测试

## Context

用户希望判断 Pack 是否可以继续推进，但当前先不实现 `cms-theme-portability-analysis.md` 里的产品级主题可移植性体系，而是先测试已有 Pack v0 代码与功能，确认现状是否稳定、是否存在阻塞点。

已有信息显示：

- Pack v0 的主线目标仍是以 `bookmarks` 为纵向 proof。
- 当前已有执行计划 `.snow/plan/pack-layout-lint-cli-cleanup.md`，并且仓库已出现根 `packs/bookmarks/`、Astro Pack route resolver、Go 侧 `pack.Builtins(os.DirFS(...))`、`pack add/validate` 方向的代码。
- `cms-theme-portability-analysis.md` 属于未来产品级架构分析，不纳入本次实现范围。

## Analysis

- **Affected files**:
  - `package.json`：根级 build、模型测试入口。
  - `app/package.json`：Astro build、Pack resolver test、cache E2E 入口。
  - `sdk/package.json`：模型类型与 fixtures 测试入口。
  - `eslint.config.js`：Pack hook `.pb.js` lint 覆盖可能存在风险；当前只匹配 `vault/pb_hooks/**/*.js`，需要用实际 lint 命令验证 `packs/bookmarks/hooks/bookmarks.pb.js` 是否被正确覆盖。
  - `app/integrations/packs/resolver.mjs` 与 `resolver.test.mjs`：Pack public route 解析的现有单测目标。
  - `app/integrations/packs/index.mjs`：Astro 注入 `/p/bookmarks` 的集成路径。
  - `packs/bookmarks/**`：当前 builtin Bookmarks Pack 源码与 hook/page/manifest。
  - `vault/main.go`：服务启动时解析 builtin/local Packs 并 stage hooks。
  - `vault/internal/pack/**`、`vault/internal/packcli/**`：Go Pack kernel、runtime loadable、hook staging、CLI 行为测试对象。
  - `Dockerfile`：根 `packs/` 在 Go/Astro/prod/dev stage 中的复制与运行时路径。
- **New files**: 无；本轮只测试与记录结果，不修改业务代码。仅在计划文件追加测试结果。
- **Dependencies**: pnpm 10.x、Node >=18、Go 1.26、Docker/buildx（仅做 build check，不构建完整镜像除非命令本身要求）、本地已安装依赖。
- **Complexity**: medium
- **Risk areas**:
  - 测试命令可能耗时，尤其 Astro build、Go 全量测试、Docker check。
  - `go test ./...` 可能包含需要外部服务或较慢的 integration tests；需要优先跑 Pack 相关包，再决定是否跑全量。
  - 当前 `eslint.config.js` 的 `.pb.js` override 可能没有覆盖 `packs/bookmarks/hooks/**/*.pb.js`，这是重点验证项。
  - 运行时 smoke 若启动 PocketBase/Astro 需避免污染现有 `pb_data`，必须使用临时目录。

## Phases

### Phase 1: 静态入口与轻量测试

- **Goal**: 快速确认 Pack v0 的 JS/Astro resolver、lint、模型基础测试是否能通过。
- **Files**: `eslint.config.js`, `packs/bookmarks/hooks/bookmarks.pb.js`, `app/integrations/packs/resolver.mjs`, `app/integrations/packs/resolver.test.mjs`, `sdk/src/models/**`
- **Steps**:
  - [ ] 运行 `pnpm --filter vanblog-app test:packs` 验证 Pack public route resolver。
  - [ ] 运行 `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js` 验证 Pack hook lint 覆盖与 JSVM globals。
  - [ ] 运行 `pnpm test:models:types` 与 `pnpm test:models:fixtures` 验证模型类型/fixtures 未被 Pack 改动破坏。
- **Done when**: 上述命令通过；若失败，记录失败命令、错误摘要、是否阻塞继续推进。

### Phase 2: Go Pack kernel、CLI 与构建验证

- **Goal**: 验证 Go 侧 Pack 解析、builtin/local precedence、hook staging、CLI `pack add/validate` 相关行为是否稳定。
- **Files**: `vault/internal/pack/**`, `vault/internal/packcli/**`, `vault/main.go`, `packs/bookmarks/**`
- **Steps**:
  - [ ] 在 `vault/` 下优先运行 Pack 相关测试：`go test ./internal/pack ./internal/packcli`。
  - [ ] 运行 `go test ./...` 获取全量 Go 回归结果；若外部依赖导致非 Pack 失败，单独分类记录。
  - [ ] 运行 `go build ./...` 验证 Go 编译通过。
  - [ ] 构建临时二进制后执行 CLI smoke：`pack list/inspect bookmarks/validate packs/bookmarks/add bookmarks <temp>`，确认 `eject` 不再可用（如当前代码已移除）。
- **Done when**: Pack 相关 Go tests、Go build、CLI smoke 通过；全量 Go test 的失败如存在需要能明确归因。

### Phase 3: Astro build 与前端 Pack route 验证

- **Goal**: 验证 Astro 集成可以编译 `/p/bookmarks`，并且缓存 E2E/SSR 输出不崩溃。
- **Files**: `app/integrations/packs/index.mjs`, `app/src/layouts/PackPage.astro`, `packs/bookmarks/pages/index.astro`, `app/src/pages/**`
- **Steps**:
  - [ ] 运行 `pnpm --filter vanblog-app build` 或根 `pnpm build` 验证 Astro 编译。
  - [ ] 如 build 成功，运行 `pnpm --filter vanblog-app test:e2e:cache` 验证现有 cache E2E。
  - [ ] 检查 build 日志中是否存在 Pack route、虚拟模块、entrypoint 路径相关 warning/error。
- **Done when**: Astro build 与 cache E2E 通过；无 `/p/bookmarks` entrypoint 缺失或 SSR 运行时崩溃。

### Phase 4: Docker/运行时路径与最终汇总

- **Goal**: 确认非 embed 后的 root `packs/` 在 Docker 与 runtime staging 路径上没有明显装配缺口，并形成是否可继续推进 Pack 的结论。
- **Files**: `Dockerfile`, `docker/**`, `vault/main.go`, `packs/bookmarks/**`, `.snow/plan/pack-v0-existing-code-test.md`
- **Steps**:
  - [ ] 运行 `docker buildx build --check .` 验证 Dockerfile 静态 build check（若本地 Docker 不可用则记录为环境阻塞而非代码失败）。
  - [ ] 使用临时 `pb_data`、`packRuntimeDir` 做最小 runtime smoke（优先不污染仓库数据）：确认服务能进入启动阶段并 stage hooks；如需要端口则使用随机/高位端口并及时停止。
  - [ ] 检查 `git diff --check`，确保现有改动没有 whitespace/patch 格式问题。
  - [ ] 更新本计划的 Completion Summary，给出“可继续推进 / 需先修复 / 环境无法判断”的结论。
- **Done when**: Docker check 或环境归因完成；runtime smoke 不出现 Pack 资源缺失；最终摘要包含命令结果、失败归因、下一步建议。

## Risks & Mitigations

| Risk                          | Impact                    | Mitigation                                                                 |
| ----------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| 测试污染现有 `pb_data`        | 本地数据被迁移或覆盖      | runtime smoke 使用临时目录和临时 runtime staging，不直接复用仓库 `pb_data` |
| Go 全量测试包含外部依赖       | 假失败影响判断            | 先跑 Pack 定向测试；全量失败按 Pack 相关/环境相关/既有非相关分类           |
| Docker 不可用或 buildx 未启用 | 无法完成 Docker check     | 记录为环境阻塞，不把它误判为代码失败；仍完成非 Docker 验证                 |
| ESLint 配置未覆盖 Pack hook   | Pack hook lint 误报或漏报 | 作为 Phase 1 重点验证；若失败，记录最小修复建议但不直接改代码              |
| runtime smoke 需要长驻服务    | 阻塞流程或占用端口        | 使用 timeout/后台进程清理策略；仅做最小启动与日志检查                      |

## Rollback Strategy

本轮不修改业务代码；若测试生成临时文件或临时目录，测试结束删除。若计划文件追加了错误信息，只保留作为审计记录。若发现本地已有未提交改动，本轮不执行破坏性回滚，只报告受影响文件与建议。

## Completion Summary

**Status**: Completed with one blocking hygiene issue
**Phases**: 4 / 4 completed

### Results

- Pack resolver 单测通过：`pnpm --filter vanblog-app test:packs`，5/5 pass。
- 模型类型与 fixtures 通过：`pnpm test:models:types`、`pnpm test:models:fixtures`。
- Go Pack 定向测试通过：`go test ./internal/pack ./internal/packcli`。
- Go 全量测试通过：`go test ./...`。
- Go 全量编译通过：`go build ./...`。
- CLI smoke 通过：`pack list`、`pack inspect bookmarks`、`pack validate ../packs/bookmarks`、`pack add bookmarks <temp>`、对新增目录再次 `pack validate` 均可用；`pack eject` 返回 unknown command，符合计划方向。
- Astro build 通过：`pnpm --filter vanblog-app build`。
- Astro cache E2E 通过：`pnpm --filter vanblog-app test:e2e:cache`，6/6 pass。
- Dockerfile 静态检查通过：`docker buildx build --check .`，无 warning。
- runtime smoke 通过：使用临时 `pb_data` 与 `packRuntimeDir` 启动 `serve` 约 8 秒，服务可进入启动阶段，Pack hook staging 生成了 bookmarks hook；未污染仓库 `pb_data`。
- `git diff --check` 通过。

### Deviations

- IDE diagnostics 无法获取：`ide-get_diagnostics` 返回 IDE connection not available，因此本次以命令行 build/test/lint 结果为准。
- 第一次 runtime smoke 使用 GNU `timeout`，macOS 环境无该命令；已改用后台进程 + sleep + kill 策略重跑并通过。

### Verification

- [x] Pack resolver tests pass
- [x] Model type/fixture tests pass
- [x] Go Pack targeted tests pass
- [x] Go full tests pass
- [x] Go build passes
- [x] CLI smoke passes
- [x] Astro build passes
- [x] Astro cache E2E passes
- [x] Docker buildx check passes
- [x] Runtime smoke passes
- [x] `git diff --check` passes
- [ ] ESLint Pack hook lint passes
- [ ] IDE diagnostics checked

### Blocking Finding

- `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js` 失败：
  - `1:1 'onRecordBeforeCreateRequest' is not defined no-undef`
  - `7:1 'console' is not defined no-undef`
- 归因：`eslint.config.js` 的 PB JSVM globals override 当前只匹配 `vault/pb_hooks/**/*.js`，没有覆盖 `packs/bookmarks/hooks/**/*.pb.js`。这与既有 `.snow/plan/pack-layout-lint-cli-cleanup.md` Phase 1 的风险判断一致。

### Conclusion

Pack v0 的核心代码和功能基本可继续推进：Go kernel/CLI、Astro route/build、Docker 装配、runtime staging 都通过现有验证。继续推进前建议先修复 ESLint override 覆盖范围，把 `packs/*/hooks/**/*.pb.js` 或更通用的 Pack hook glob 纳入 PB JSVM globals；这是小范围工程化修复，不影响当前 Pack v0 主链路正确性。

### Follow-up

1. 优先修复 `eslint.config.js`：让 PB JSVM globals 同时覆盖 `vault/pb_hooks/**/*.js` 与 `packs/*/hooks/**/*.pb.js`（或等价安全 glob）。
2. 修复后重跑：`pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js`、`pnpm --filter vanblog-app test:packs`、`go test ./internal/pack ./internal/packcli`。
3. 若要继续 Pack 实现，建议回到 `.snow/plan/pack-layout-lint-cli-cleanup.md`，先完成 Phase 1 的 lint 覆盖修复，再推进下一项。
