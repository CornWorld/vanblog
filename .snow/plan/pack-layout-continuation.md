# Pack 清理继续推进

## Context
用户要求继续推进 Pack。刚复核 `.snow/plan/pack-layout-lint-cli-cleanup.md` 与当前代码后发现：Pack v0 主链路大部分已完成（根 `packs/bookmarks/`、Go `Builtins(fs.FS)`、Docker 显式 COPY、`pack add`、无 `plugins/bookmarks`、无旧 builtin 分裂目录），但当前工作区的 `eslint.config.js` 又处于旧状态，只覆盖 `vault/pb_hooks/**/*.js`，导致 `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js` 仍失败。

本轮目标不是实现 `cms-theme-portability-analysis.md` 的长期主题可移植性体系，而是把既有 Pack v0 清理收尾：先修复当前仍存在的 lint blocker，再补齐回归断言与文档状态，让后续 Pack 工作有稳定基线。

## Analysis
- **Affected files**:
  - `eslint.config.js`：当前 PB JSVM override 仍只匹配 `vault/pb_hooks/**/*.js`，需要恢复/应用 Pack hook glob。
  - `vault/internal/packcli/command_test.go`：已有 `add` 测试，但缺少 `eject` 明确 unknown command 的回归断言，可补齐以锁定 Phase 3。
  - `.snow/plan/pack-layout-lint-cli-cleanup.md`：计划状态仍为未勾选，需要更新为实际完成度和剩余项。
  - `docs/future-pack-architecture.md`、`docs/plugin-authoring.md`：如仍含过时 `eject` 或 legacy Bookmarks 状态，需要小范围同步。
  - `plugins/moments/**`、`vault/pb_hooks/moments.pb.js`：保留为 Moments legacy compatibility boundary，不删除。
- **Already verified / current state**:
  - `plugins/bookmarks` 不存在。
  - `app/packs-builtin` 不存在。
  - `vault/internal/pack/builtin` 不存在。
  - Go API 已是 `Add`，`vault/internal/pack/eject.go` 不存在，`vault/internal/pack/add.go` 存在。
  - CLI 已有 `pack add <name> [destination]`。
  - `pack eject` smoke 曾通过 unknown command，但测试文件中尚无专门断言。
  - 当前 `eslint.config.js` 仍旧，实际 lint 失败，需要优先修复。
- **New files**: 无。
- **Dependencies**: pnpm/ESLint、Go tests、Astro build/test、Docker buildx check；不新增依赖。
- **Complexity**: medium
- **Risk areas**:
  - ESLint glob 修复若过宽，会降低普通 JS lint 精度；应限定 `packs/*/hooks/**/*.pb.js`。
  - 文档清理如果范围过大，可能误改未来计划内容；只改与当前事实冲突的状态/命令。
  - Moments 仍是 legacy consumer，不能删除 `plugins/moments` 或 `$vanblog.servePlugin("moments")`。

## Phases

### Phase 1: 恢复 Pack hook ESLint 覆盖
- **Goal**: 解除当前 `packs/bookmarks/hooks/bookmarks.pb.js` lint blocker。
- **Files**: `eslint.config.js`
- **Steps**:
  - [ ] 将 PB JSVM override 的 `files` 扩展为 `vault/pb_hooks/**/*.js` 与 `packs/*/hooks/**/*.pb.js`。
  - [ ] 保持现有 globals/rules 不变，仅修改 glob 与注释措辞。
  - [ ] 运行 `node --check eslint.config.js` 与 `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js`。
- **Done when**: ESLint config 语法与 Pack hook lint 均通过，无新增 lint error。

### Phase 2: 锁定 CLI 与目录清理回归
- **Goal**: 用测试/检查固定当前 Pack v0 清理成果，避免回退到 `eject` 或旧目录布局。
- **Files**: `vault/internal/packcli/command_test.go`, `vault/internal/pack/**`, `app/integrations/packs/**`, `packs/bookmarks/**`
- **Steps**:
  - [ ] 在 CLI tests 中增加 `pack eject` 返回错误的断言，确保不保留隐藏 alias。
  - [ ] 运行 `go test ./internal/pack ./internal/packcli`。
  - [ ] 运行 `pnpm --filter vanblog-app test:packs`。
  - [ ] 检查旧目录不存在：`plugins/bookmarks`、`app/packs-builtin`、`vault/internal/pack/builtin`。
- **Done when**: 定向 Go/Pack resolver tests 通过，旧目录不存在，`eject` 断言稳定。

### Phase 3: 文档与计划状态同步
- **Goal**: 把计划和文档更新到当前实现事实，减少后续误判。
- **Files**: `.snow/plan/pack-layout-lint-cli-cleanup.md`, `docs/future-pack-architecture.md`, `docs/plugin-authoring.md`
- **Steps**:
  - [ ] 更新 `.snow/plan/pack-layout-lint-cli-cleanup.md` 的完成摘要：标记 Phase 1-3 已完成，Phase 4 的 Bookmarks 删除已完成，Moments 保留为 legacy boundary。
  - [ ] 搜索并修正仍把 Bookmarks 描述为 legacy plugin 残留、或仍建议 `pack eject` 的过时文字。
  - [ ] 保留 `cms-theme-portability-analysis.md` 为未来分析，不纳入当前执行范围。
- **Done when**: 文档不再与当前 `pack add` / root `packs/bookmarks` / no `plugins/bookmarks` 事实冲突。

### Phase 4: 最终回归
- **Goal**: 确认清理收尾后 Pack v0 baseline 可继续推进。
- **Files**: 全仓相关入口
- **Steps**:
  - [ ] 运行 `pnpm exec eslint packs/bookmarks/hooks/bookmarks.pb.js`。
  - [ ] 运行 `pnpm --filter vanblog-app test:packs`。
  - [ ] 运行 `go test ./internal/pack ./internal/packcli`。
  - [ ] 运行 `pnpm --filter vanblog-app build`。
  - [ ] 运行 `git diff --check`。
- **Done when**: 上述全部通过；若 IDE diagnostics 仍不可用，记录为环境限制。

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| ESLint glob 过宽 | 放过普通 JS 未定义变量 | 只匹配 `packs/*/hooks/**/*.pb.js` |
| 错删 Moments legacy | `/p/moments` 或管理页回归 | 本轮只审计/记录，不删除 `plugins/moments` 与 core moments hook |
| 文档误改未来架构分析 | 混淆长期方向与当前 v0 | 只修当前事实冲突，不实现主题可移植性体系 |
| 回归命令耗时 | 阻塞推进 | 先定向测试，再做 Astro build；不跑 Docker 全构建，除非前述命令通过后需要进一步确认 |

## Rollback Strategy
本轮改动集中在 `eslint.config.js`、CLI test 和文档/计划。若出现问题，可逐文件回退对应改动；不执行自动 Git 回滚。业务代码不做 destructive migration，不触碰 `pb_data`。
