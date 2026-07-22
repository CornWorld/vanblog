# Pack v1 Lifecycle 产品化方案

## 状态

**Status**: Phase 4 startup observability and documentation verified
**Scope**: lifecycle contract plus read-only derived Pack status; no runtime install/enable/disable/uninstall behavior.

## 1. 现有产品与用户事实

### 现有产品形态

VanBlog 当前是单实例、自托管、Docker 优先的博客/CMS：

- PocketBase + SQLite 数据与鉴权由单个实例持有。
- Astro SSR / Caddy / PocketBase 共同组成 prod 镜像；dev 镜像提供 Node、pnpm、源码、HMR 和构建能力。
- 新用户主要通过 `vanblog.sh` 或 `docker compose up -d` 部署，不是通过 Web marketplace 安装扩展。
- Pack 代码在构建期被信任：Astro 页面、前端 JS/CSS、PocketBase hooks、schema artifact 都可能进入镜像或受控的 local override。
- prod 当前只消费已构建产物；dev 才适合修改 Pack source、安装依赖和执行 `pack build`。

### 用户分层

1. **开箱即用用户（主用户）**

   - 目标是尽快拥有稳定、好看的个人博客。
   - 不应看到 Node/pnpm、schema artifact、migration、hook staging 等概念。
   - 需要升级可预测、失败可恢复，不需要运行时插件市场。

2. **自托管维护者 / NAS / VPS 用户**

   - 能修改 compose、挂载 volume、查看日志并执行升级脚本。
   - 需要明确的 Pack 状态、版本和诊断，但不应被迫管理复杂依赖。

3. **主题与功能开发者**

   - 使用 dev image 或本地仓库开发 Pack。
   - 需要 `validate`、`build`、构建产物检查和稳定的 source/artifact/runtime 边界。
   - 可以接受重建镜像或重启，而不是要求生产实例动态执行 TypeScript。

4. **高级自定义用户**
   - 可能维护 local Pack override。
   - 需要 whole-Pack replacement、版本可见、可回退到上一个镜像/源目录。
   - 不应通过 Admin UI 上传并执行任意 JS/TS。

## 2. 关键架构事实

当前 Pack 不是独立进程，也不是安全沙箱：

- builtin Pack 随镜像发布，资源在 `/packs`，与 VanBlog 版本绑定。
- local Pack 通过 `VANBLOG_PACKS_DIR` / `--packsDir` 参与 Go runtime 的 whole-Pack override。
- Astro registry 在 build time 发现 Pack；修改页面、metadata 或前端贡献通常需要 dev restart / production rebuild。
- schema 由 `schema.ts -> schema.js` 生成，Goja 在 promote 前验证；runtime 不安装依赖、不编译 TypeScript。
- migration 只追加，不存在安全的通用 down migration；uninstall 不能隐式删除数据。
- hook、route、schema、frontend 不是可以独立热插拔的资源，它们共同属于一个 Pack build profile。

因此，生命周期不能设计成“在生产 Web UI 点击开关，马上安装/卸载代码”。

## 3. 产品决策

### 3.1 采用：构建期声明 + 部署期激活

Pack v1 lifecycle 采用 **immutable image + managed local source + build profile**：

```text
Pack source
  -> validate
  -> build artifacts
  -> image / managed deployment bundle
  -> restart / deploy
  -> discover -> resolve -> migrate/load hooks -> compose -> serve
```

核心规则：

- **builtin Pack**：镜像内置、随版本发布、默认启用；不允许运行时删除。
- **local Pack**：由 dev/tooling 准备，放在受控的 local Pack directory；通过下一次 build/deploy 进入运行态。
- **启用**：表示 Pack 被纳入当前 build profile。v1 不做 runtime toggle；启用/禁用通过 profile 配置 + 重建/重启完成。
- **禁用**：只停止下一次 build 中的 Pack frontend/hook/schema/route 组合，不执行 down migration，不删除数据。
- **卸载**：v1 仅定义 source removal / profile removal；不删除 Pack-owned collection、文件或 migration 历史。若 Pack 仍拥有已存在数据，工具必须提示“source removed, data retained”。
- **升级**：替换 local source 或升级镜像后，先 validate/build，再部署；migration 只允许 append-only forward migration。失败时保留旧 image / 旧 artifact / 旧 source。
- **版本冲突**：builtin 与 local 同名采用现有 whole-Pack local override；同一 local directory 内重复 identity、Pack-Pack model collision、非法 artifact 直接 fail closed。v1 不支持多版本共存和依赖求解。

### 3.2 不采用的模型

- 不做远程 marketplace、运行时下载、签名仓库或 instance npm registry。
- 不做 Admin UI 上传 Pack 代码。
- 不做生产容器内 `npm install`、TypeScript 编译或动态 Astro route 替换。
- 不做独立的 `enable`/`disable` API 去改变已运行进程的局部 adapter；Pack 是 whole unit。
- 不做 uninstall/down migration 自动删库。
- 不为单个 Pack 引入独立 Node/Go 服务或多进程协调。

这些取舍直接匹配主用户的开箱即用目标，也保留开发者和高级用户的扩展能力。

## 4. 建议的 lifecycle 状态

状态是诊断/部署状态，不是可由 Pack 自己修改的 PB 数据：

```text
builtin-enabled
local-staged
validated
artifact-ready
active
needs-rebuild
disabled-next-deploy
source-removed-data-retained
failed
```

状态来源应尽量可重建：

- source identity/version：读取 `pack.json`
- source hash / artifact metadata：由 builder 生成
- active set：由当前 build profile / resolved Pack set 推导
- runtime loadability：由启动时 discovery、Goja validation 和 adapter resolution 推导
- 不把 lifecycle 状态写入 SQLite，避免恢复时出现“数据库说启用但镜像没有代码”的分裂状态。

## 5. v1 用户操作模型

### 面向普通用户

普通用户只接触：

```text
升级镜像 -> 备份 -> 重启/迁移 -> 查看启动日志
```

Pack 随镜像版本发布，不要求用户理解 Pack CLI。

### 面向维护者/开发者

沿用现有 CLI，并收敛语义：

```text
vanblog pack list
vanblog pack inspect <name>
vanblog pack validate <directory>
vanblog pack add <name> [destination]
vanblog pack build <directory>
```

后续可增加只读诊断命令：

```text
vanblog pack status
vanblog pack plan <directory-or-profile>
```

暂不增加 `install`、`enable`、`disable`、`upgrade`、`uninstall` 作为会修改生产运行态的命令；它们容易制造“代码已换但前端/迁移/数据未同步”的假状态。

## 6. 设计边界与安全规则

- Pack 代码是可信构建期代码，不是沙箱；只有仓库维护者、镜像构建者或管理员明确挂载的 dev/local source 才能进入构建。
- `/packs` 镜像内容 root-owned、默认只读；local override 目录必须由部署者显式配置。
- lifecycle 操作不得自动执行数据库删除、down migration 或数据清理。
- migration preflight 必须在未来实现 upgrade 前确认：迁移编号、重复执行安全性、备份点、旧版本恢复策略。
- 前端变更、hook 变更、schema 变更和 route 变更以 whole-Pack 原子部署；不能只替换其中一类文件。
- 运行态只能加载当前 resolved set；缺 artifact 的 Pack 被跳过并给出可操作的 `pack build` 诊断，builtin artifact 缺失则 fail closed。
- local override 保持现有 whole-Pack precedence，不做逐文件 overlay，避免 builtin 与 local 资源混合导致不可诊断状态。

## 7. 后续实现阶段

### Phase 1：只读 lifecycle 状态与 profile 解析

- [x] 定义当前 resolved Pack set 作为 active profile 的最小来源，不引入 PB migration。
- [x] 新增 `pack status`，输出 source、version、artifact、derived state 和诊断原因。
- [x] 增加 `pack.Statuses` / `HasSchemaArtifact` 只读诊断契约；不改变 runtime 行为。
- [x] 增加 deterministic source SHA-256 fingerprint；忽略生成的 `schema.js`，避免重建 artifact 误报 source 变化。
- [x] artifact freshness / source-to-artifact metadata 对比：`schema.js.meta.json` 记录 source fingerprint，`pack status` 输出 `fresh|stale|unknown|missing|invalid`。

### Phase 2：安全的 staging / activation

- [x] 增加 schema artifact 与 freshness metadata 的独立 staging 文件，并在 promotion 失败时恢复旧 bundle。
- [x] `validate -> build -> validate artifact -> stage metadata -> promote` 全部成功后才更新 `schema.js` 与 `schema.js.meta.json`。
- [x] active profile 变更仍要求显式 rebuild/restart；构建失败保留 last-known-good artifact 与 metadata。
- [ ] 后续再增加真正的 local Pack staging 目录与原子目录替换。
- [x] 覆盖 schema Pack 的成功 promotion、无 schema Pack，以及 promotion 失败时旧 bundle 保留。

### Phase 3：upgrade preflight（撤回的里程碑，2026-07-21）

此前在此处声明了 backup contract、callback-based executor 与"forward migration 按序执行"的 `ExecutePlan` 实现。
经过 `find_references` 核实：`ExecutePlan` / `ValidateExecutionPlan` / `ExecutionCallbacks` 从未在生产代码（`vault/main.go`、`vault/internal/packcli`）中被调用，仅被 `deploy_test.go` 自测试覆盖。
当前也没有任何 builtin Pack 携带 `migrations/` 目录，`pack plan` 中的 migration 字段对运行时毫无影响。

继续保留这套"看起来 ready 但实际不会执行"的代码会让后续维护者误以为 Pack 已具备 migration 执行能力，从而在真实场景中踩到"日志说 ready、实际没跑 migration"的假状态。
因此在 2026-07-21 一次性撤回以下承诺：

- 删除 `vault/internal/pack/deploy.go`（`ExecutePlan` / `ValidateExecutionPlan` / `ExecutionCallbacks`）。
- 删除 `vault/internal/pack/deploy_test.go`。
- `pack plan` 的 `BackupRequired` / `BackupStrategy` / `BackupScope` / `MigrationFiles` 等诊断字段保留，它们只是**只读 preflight 信号**，不再声明会驱动任何执行器。
- **v1 不实现 Pack migration 自动执行**。Pack 若需要修改 collection，唯一受支持路径仍是"在 `vault/pb_migrations/` 提交 Go migration 并随镜像发布"。

未来若真要引入 Pack 自带 migration，需重新设计：在 `main.go` 的 `OnServe` 里显式注入 PocketBase backup + migration runner，而不是保留一套悬空的 callback contract。

### Phase 4：文档与运维体验

- 面向普通用户提供“随镜像升级”的简化路径。
- 面向 dev 用户提供 Pack 开发/构建/部署路径。
- [x] 启动日志输出 resolved Pack 摘要和失败修复建议，不输出 secrets 或源码内容。
- 后续再评估是否需要显式 `disable` / `remove-source` 命令；数据保留策略必须先固定。

## 8. 验收矩阵

| 场景                      | v1 预期                                                   |
| ------------------------- | --------------------------------------------------------- |
| 默认镜像启动              | builtin Packs 自动 active，顺序稳定                       |
| 无 schema Pack            | 可启动，状态提示 needs-build 或 no-schema                 |
| local 同名 Pack           | whole-Pack 替换 builtin，版本/source 可见                 |
| local 非同名 Pack         | 与 builtin 同时 active                                    |
| Pack 页面或 metadata 修改 | dev restart / prod rebuild 后生效                         |
| schema.ts 修改            | 必须重新 build artifact，旧 artifact 不被坏构建覆盖       |
| hook 修改                 | 重新 staging/restart 后生效                               |
| migration 失败            | 不进入正常 active runtime，保留旧部署材料                 |
| source 移除               | 不再参与下一次 resolve，但数据保留，不执行 down migration |
| Pack model 冲突           | fail closed，错误包含冲突 Pack 名称                       |
| 普通用户升级镜像          | 不需要手工执行 npm/pnpm 或 Pack lifecycle 命令            |

## 9. 当前结论

VanBlog 最适合的不是 WordPress 式“生产运行时插件市场”，而是：

> **博客优先、可信 Pack、构建期组合、部署期激活、数据永不隐式删除。**

这条路线同时满足：

- 主用户的开箱即用与低运维负担；
- 自托管用户的可诊断、可恢复升级；
- 开发者的 Astro/PocketBase/Schema 扩展空间；
- 当前 Docker、Astro build-time registry、Goja artifact 和 whole-Pack precedence 的真实技术形态。

当前下一步优先级应是 **将 backup contract 接入显式 deploy/migration executor**，仍然不实现 runtime install/uninstall 或 enable/disable。
