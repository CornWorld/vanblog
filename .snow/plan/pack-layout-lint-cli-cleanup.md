# Pack 目录、Lint、旧插件与 CLI 整理

## Context

Pack v0 已跑通，但当前实现仍有四类工程化债务：PocketBase JSVM 全局变量在根 ESLint 配置中声明不完整；内置 Pack 被拆在 Go 内部目录与 Astro 目录两处；已迁移的 Bookmarks 仍保留 legacy plugin 资源；CLI `eject` 的命名不利于未来扩展本地/远程来源。

本轮采用已确认的方向：

- 使用仓库根目录 `packs/` 作为 builtin Pack 的唯一源码位置。
- 暂时取消 Go `embed`，不使用软链接；开发、测试和 Docker 都显式提供 builtin Packs 路径。
- 将 `pack eject` 全局重命名为 `pack add`，底层 Go API 同步由 `Eject` 改为 `Add`。
- 删除已经被 Pack 完整替代的 legacy Bookmarks plugin；Moments 尚未完成 Pack 前端迁移，因此只清理重复 hook/过时说明，不假装删除仍被兼容路由使用的资源。

## Analysis

- **Affected files**:
  - `eslint.config.js`：补齐 PocketBase JSVM hook globals，并让 `.pb.js` 规则实际覆盖 Pack hook。
  - `packs/bookmarks/**`：新的 Bookmarks builtin Pack 唯一源码（由现有 Go/ Astro 两份资源合并而来）。
  - `vault/internal/pack/source.go`：移除 `embed.FS`，从显式 builtin Packs 根目录加载。
  - `vault/internal/pack/{eject.go,pack_test.go,hooks_test.go,v0_test.go}`：重命名复制 API、适配基于目录的 builtin fixture。
  - `vault/internal/packcli/{command.go,command_test.go}`：`eject` 改成 `add`，增加默认目标与冲突验证。
  - `vault/main.go`：增加/统一 builtin Packs 路径配置，并确保只有需要解析 Pack 的命令读取它。
  - `app/integrations/packs/index.mjs`：Astro route 改为根 `packs/bookmarks/pages/index.astro`。
  - `Dockerfile`、开发脚本/compose（若引用相关目录）：两个 build stage 和运行镜像显式复制 `packs/`。
  - `plugins/bookmarks/**`：删除已被 Pack 取代的 legacy Bookmarks 文件。
  - `plugins/moments/**`、`vault/pb_hooks/moments.pb.js`：保留目前仍工作的 Moments compatibility boundary，去掉重复/误导内容（如存在）。
  - `docs/future-pack-architecture.md`、`docs/plugin-authoring.md`：更新目录、`add` 命令及 legacy 状态。
- **New files**:
  - `packs/bookmarks/pack.json`
  - `packs/bookmarks/hooks/bookmarks.pb.js`
  - `packs/bookmarks/pages/index.astro`
  - 可选根级 JSVM 类型声明（仅当 ESLint globals 不能覆盖编辑器类型提示时），例如 `types/pocketbase-jsvm.d.ts`；不把 JS lint 问题错误归因于 Astro `tsconfig`。
- **Dependencies**: Go `os.DirFS`/现有 immutable snapshot 边界、Cobra、Astro `injectRoute`、根 ESLint flat config；不新增第三方依赖。
- **Complexity**: complex
- **Risk areas**:
  - 取消 embed 后，二进制不再完全自包含；启动与 CLI 必须在缺失 builtin 目录时 fail-closed，并由 Docker 明确携带资源。
  - `go test` 的工作目录与生产二进制工作目录不同，不能依赖脆弱的相对路径猜测。
  - 根 `packs/` 同时是 builtin 源码；用户本地 override 目录不能默认指向同一个目录，否则 Source 语义混淆。
  - Moments 仍依赖 legacy manifest/frontend；本轮不能直接删除整个 `plugins/` 子系统。

## Phases

### Phase 1: 收敛 JSVM lint 与单一 Pack 源码
- **Goal**: 消除 `.pb.js` 的误报，并把 Bookmarks Pack 收敛到根 `packs/`。
- **Files**: `eslint.config.js`, `packs/bookmarks/**`, `vault/internal/pack/builtin/bookmarks/**`, `app/packs-builtin/bookmarks/**`, `app/integrations/packs/index.mjs`
- **Steps**:
  - [ ] 在 `eslint.config.js` 的 `**/*.pb.js` override 中补齐当前 PocketBase 使用的事件 globals，至少包含 `onRecordBeforeCreateRequest`；运行 ESLint 验证而不是仅依赖 tsconfig。
  - [ ] 合并 hook、manifest 与 Astro page 到 `packs/bookmarks/`，删除两份旧源码目录，不引入 symlink。
  - [ ] 修改 Astro integration 从根 `packs/` 注入静态 `/p/bookmarks` route，并更新 resolver 测试 fixture/path。
- **Done when**: `npx eslint packs/bookmarks/hooks/bookmarks.pb.js`、Pack resolver tests、`astro check`、Astro build 均通过，无新增 diagnostics 或运行时崩溃。

### Phase 2: 取消 Go embed 并显式装配 builtin Packs
- **Goal**: Go、CLI、Docker 都从明确的 builtin Packs 目录读取同一份资源。
- **Files**: `vault/internal/pack/source.go`, `vault/internal/pack/*_test.go`, `vault/main.go`, `Dockerfile`, `docker/**`, `docker-compose.yml`
- **Steps**:
  - [ ] 将 `Builtins()` 改为接收显式 filesystem/path（优先 `Builtins(fs.FS)` 或等价依赖注入），移除 `embed` 与隐式 cwd 探测。
  - [ ] 为服务和 CLI 增加一致的 builtin Packs 根目录装配；缺失、symlink、非法 Pack 必须 fail-closed，并保持本地 override 的 immutable snapshot 与 whole-Pack replacement。
  - [ ] Docker Go/Astro build stage 与最终镜像复制根 `packs/`，开发环境传入可预测路径；测试使用 `os.DirFS`/fixture 明确注入。
  - [ ] 验证 `pack`、`serve`、`migrate` 的 flag 顺序与非 serve 无 staging 副作用。
- **Done when**: Pack/CLI tests、全量 `go test ./...`、`go build ./...`、fresh binary CLI/runtime smoke、`docker buildx build --check .` 通过；无缺失资源或 cwd 依赖。

### Phase 3: 将 eject 重命名为 add
- **Goal**: 使用可扩展的 `pack add` 用户语义，彻底移除 eject 命名。
- **Files**: `vault/internal/pack/eject.go`, `vault/internal/pack/pack_test.go`, `vault/internal/packcli/command.go`, CLI tests, docs
- **Steps**:
  - [ ] 将文件/API/错误文本从 `Eject` 全局重命名为 `Add`，保留原子复制、拒绝覆盖与 symlink 防护。
  - [ ] CLI 改为 `pack add <name> [destination]`；省略 destination 时使用 `<packsDir>/<name>`，若未给可写的 `packsDir` 则给出明确错误，不偷偷写 cwd。
  - [ ] 不保留隐藏 `eject` alias，避免新 API 继续背负旧术语；更新文档与 smoke commands。
- **Done when**: `pack add bookmarks <temp>/bookmarks` 后可 `pack validate`；`pack eject` 明确为未知命令；CLI tests、build 和 diagnostics 通过。

### Phase 4: 清除已迁移旧插件并完成回归
- **Goal**: 删除 Bookmarks legacy 残留，同时明确 Moments 的暂时兼容边界。
- **Files**: `plugins/bookmarks/**`, `plugins/moments/**`, `vault/pb_hooks/moments.pb.js`, `vault/internal/plugins/**`, `app/src/pages/**`, `app/src/lib/plugin-loader.ts`, `Dockerfile`, docs
- **Steps**:
  - [ ] 删除 `plugins/bookmarks/**`，增加回归断言：Bookmarks owner callback 与页面只来自 `packs/bookmarks`，不注册 `/_plugin/bookmarks/*`。
  - [ ] 审计 Moments 实际依赖；保留其 manifest/frontend 和 core compatibility hook，去除确实重复的 hook 文件，并在代码/文档标记为最后一个 legacy consumer。
  - [ ] 若 `internal/plugins` 仍只服务 Moments，则收窄默认注册与 Docker COPY 范围；不在本轮破坏 `/p/moments`、管理页或静态资源兼容。
  - [ ] 执行 Go、模型、Astro、Docker、runtime 全链路回归并更新计划完成摘要。
- **Done when**: 仓库不存在 `plugins/bookmarks` 或 `servePlugin("bookmarks")`；Moments 兼容 smoke 通过；Go build/tests、模型 checks、Astro checks/build/cache E2E、Docker check、`git diff --check` 全通过，无运行时崩溃。

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 非 embed 二进制找不到根 `packs/` | 服务或 CLI 启动失败 | 显式依赖注入/flag，Docker 固定绝对路径，缺失时清晰 fail-closed |
| build context 未复制根 Packs | Go tests 通过但 Docker/Astro 构建失败 | 分别在 Go、Astro、prod stage 显式 COPY，并执行 Docker check/runtime smoke |
| 将 builtin 与 local override 指向同目录 | Source 标记和 whole-Pack replacement 错乱 | 使用两个明确配置：builtin source 与 local overrides，禁止同一路径或记录清晰优先级 |
| ESLint globals 与 PocketBase API 漂移 | 编辑器持续误报或放过拼写错误 | 只声明实际使用的 JSVM globals，新增 hook lint 命令/测试；类型声明作为补充而非替代 lint |
| 一次删除整个 plugins 系统 | Moments 页面回归 | 只删除 Bookmarks；先证明 Moments 依赖，再逐步收窄 legacy manager |
| `add` 默认目标造成意外覆盖 | 用户文件损坏 | destination 必须不存在，省略目标只允许在显式 `packsDir` 下写入 |

## Rollback Strategy

- 每阶段保持可独立回滚：先建立根 `packs/` 并通过 Astro，再切换 Go source，再删除旧目录。
- 若非 embed 装配失败，可临时恢复原 `source.go` 与内部 builtin 目录，但不恢复软链接方案。
- 若 legacy 清理导致 Moments 回归，仅恢复 Moments 相关文件；Bookmarks 不恢复重复 owner hook。
- `Add` 使用原子 staging + rename，失败时删除临时目录且不修改已有 destination。
