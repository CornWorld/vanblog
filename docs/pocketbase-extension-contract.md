# PocketBase 扩展机制的边界契约

> **文档类型**：治理文档 / fact。目标：让下一个 agent / 维护者不再靠读 PB 源码 + 撞墙才能搞清边界。
> **目标读者**：vanblog 维护者、后续实施 agent、写 Pack/Theme 扩展的人。
> **版本依据**：PocketBase v0.39.5（`vault/go.mod` 锁定）。
> **前置阅读**：`docs/architecture-layering.md`（三层架构）、`docs/pack-theme-schema-design.md`（Pack 自带 `migrations/*.js` 的设计）。

---

## 0. 一句话结论

PB 提供的是通用 BaaS 能力；但「能力存在」≠「vanblog 可用」，「可用」≠「被接线」，「被接线」≠「对 JS 迁移 VM 开放」。这三层差异就是本文要显式化的隐式边界。

vanblog 的扩展性不是 PB 白送的，而是由这些显式接线决定的：

1. `vault/main.go` 注册 `jsvm` + `migratecmd`，并把 Pack 的 hooks / migrations stage 到正确目录；
2. `vault/internal/<domain>/` 的 Go manager 各自 `New(app)` 自挂 hook / 自定义路由；
3. `vault/internal/pack/` 的 `StageHooks` / `StageMigrations` 把「核心 + 所有可加载 Pack」合并成 flat 目录，喂给 PB 插件。

---

## 1. PB 有什么 → 我们怎么用 → 为什么有扩展性

| PB 能力 | vanblog 用法（精确到文件/机制） | 如何贡献扩展性 |
| --- | --- | --- |
| Collections / 字段 / 权限规则 | 核心表 `vault/pb_migrations/*.go`（Go 迁移）；Pack 表 `packs/*/migrations/*.js`（JS 迁移）；写入校验 `schema.ts→schema.js`（Zod→`OnRecordValidate`） | Pack 自带 DDL 声明 collection，无需改 vault + 重建二进制 |
| Auth | `users`/`_superusers` 由 PB 系统迁移建；`bootstrap` manager 首次 setup；SDK `authWithPassword` | 权限规则随 DDL 声明，扩展面随 collection 走 |
| Realtime | **未显式使用**（未验证）；只用事件 hook 做服务器端副作用 | 保留能力，未做成产品特性 |
| Migrations（Go / JS） | Go 核心 `vault/pb_migrations/*.go`；Pack JS 经 `pack.StageMigrations` 命名空间化进 `jsvm.Config.MigrationsDir` | **核心扩展面**：Pack 自声明 schema（见 §2） |
| Hooks | Go manager `New(app)` 自挂；JS `vault/pb_hooks/*.pb.js`；Pack `packs/*/hooks/*.pb.js` | 只能「追加」不能「替换」Go 行为（见 §2 事实 8） |
| jsvm（JS API 边界） | hooks VM 与 migration VM 的绑定不同（见 §2 事实 3/6） | 决定 JS 扩展「能写什么、不能写什么」 |
| cron | `vault/pb_hooks/system.pb.js` 的 `cronAdd` | 用户可在 `.pb.js` 注册定时任务（migration VM 无此能力） |
| storage | `vault/internal/media/` 封 MD5/S3/缩略图 | 扩展者只声明 `FileField`，不接触 Go 存储 |
| REST `/api/collections/*` | 前端 `app/` + `sdk/` 直接消费 | 每个新 collection 自动获得完整 REST API，无需手写端点 |
| 自定义路由 `/api/vanblog/*` | Go manager 在 `OnServe` 里 `se.Router.*` 注册 | 核心业务端点 Go 显式暴露；JS `routerAdd` 只做非核心扩展 |

---

## 2. 隐式边界（8 条踩坑实证）

> 这是本次重构撞墙后固化的契约。每条 = 事实 + 约束。源码依据可追溯到 PB v0.39.5。

### 事实 1：JS 迁移由 `jsvm` 加载，不是 `migratecmd`；`Automigrate` 只生成快照

- **事实**：`jsvm.Config.MigrationsDir` 是 JS 迁移的加载器；`migratecmd.Config.Automigrate: true` 只在 collection 变化时生成迁移快照文件，**不**跑 JS 迁移。（`plugins/jsvm/jsvm.go:91-98,183-234`；`plugins/migratecmd/automigrate.go:16-95`）
- **约束**：给 Pack 加 `migrations/*.js`，正确路径是 stage 进 `jsvm.Config.MigrationsDir`；不要指望 `--automigrate` 会跑它们。

### 事实 2：JS 迁移真正执行在 `apis.Serve()` → `RunAllMigrations()`

- **事实**：`apis.Serve()` 在起 server 前调 `RunAllMigrations()`（= `SystemMigrations + AppMigrations`）；`OnBootstrap` 只跑 `RunSystemMigrations`。（`apis/serve.go:66-70`；`core/base.go:418,797-801`）
- **约束**：迁移在「开始 serve」时点跑，不在 bootstrap 阶段；「备份先行」钩子必须挂在 `OnBootstrap`（早于 `apis.Serve`）。

### 事实 3：`BindCore` 暴露 `new Collection`/`Record`/`unmarshal`；迁移 VM 与 hooks VM 绑定不同

- **事实**：`BindCore` 注入 `Collection`/`Record`/`unmarshal`/全套 `*Field` 构造器，这是 JS 迁移写 DDL 的前提。但迁移 VM **没有** hooks VM 才有的 `$apis`/`$app` 全局、`routerAdd/routerUse`、`cronAdd/cronRemove`。（`plugins/jsvm/binds.go:298,396,465,485,497-570`）
- **约束**：`new Collection({...})` 是 PB 给的，字段写法匹配 `core.Collection` JSON 形状；迁移里不要调 `$app`/`routerAdd`/`cronAdd`（不存在）。

### 事实 4：`_migrations` 以 `file` 为 key，Go 与 JS 迁移共享同一张表

- **事实**：`_migrations` 表 `file VARCHAR(255) PRIMARY KEY`；Go 迁移（`migrations.Register` = `core.AppMigrations.Register` 别名）和 JS 迁移（`jsvm`→`migrate`）都进 `core.AppMigrations`，跑同一 runner、记同一表。
- **约束**：迁移文件名必须全局唯一；Pack 迁移必须 namespaced（`pack--<name>--<original>.js`），否则主键冲突。

### 事实 5：`findCollectionByNameOrId` 找不到时抛异常，不返回 null

- **事实**：找不到返回 dbx 错误 `sql: no rows in result set`（作为 JS 异常抛出），不返回 null/undefined。（`core/collection_query.go:62-77`）
- **约束**：存在性判断必须 `try { app.findCollectionByNameOrId(name) } catch(_) {}`，不能用 `if (...)`。vanblog 现有 4 个 Pack 迁移都是这个写法。

### 事实 6：`findCollectionsByFilter` 没有暴露给迁移 VM

- **事实**：`core.App` 接口和整个 core 包**没有** `FindCollectionsByFilter` 方法；JS 里调用会 `TypeError: no member`。（`grep -r "FindCollectionsByFilter" core/` 无结果）
- **约束**：迁移里不能按 filter 批量查 collection；要么逐个 `findCollectionByNameOrId`，要么 `findRecordById/findRecordsByFilter` 查 records。

### 事实 7：生产镜像只 COPY `vault/pb_hooks`，从不 COPY `vault/pb_migrations`

- **事实**：Dockerfile prod `COPY vault/pb_hooks /pb_hooks`，没有 COPY `vault/pb_migrations`；早期放 `vault/pb_migrations/` 的 `.js` 迁移在 prod 是死代码（镜像里 `/pb_migrations` 不存在 → jsvm `filesContent` 返回空不报错）。（`Dockerfile:155`；`plugins/jsvm/jsvm.go:537-544`）
- **约束**：不要把「运行时执行的 JS 迁移」放 `vault/pb_migrations/` 指望 prod 生效；正确路径是 Pack 自带 `migrations/*.js` 由 `StageMigrations` stage。

### 事实 8：`Hook.Trigger` 是 forward chain：注册顺序=执行顺序，默认 handler 永远最后

- **事实**：`Trigger` 按注册顺序排 handlers，默认 handler（`oneOffHandlerFuncs`）追加在最后，再反向构建 next 链 → 第一个注册的先执行，默认 handler 最后执行。（`tools/hook/hook.go:153-174`）
- **约束**：JS/Go hook 只能「追加」不能「替换」更早注册的 handler；要拦截必须在前置 handler 里「不调 `e.Next()` 并返回错误/响应」短路，否则默认行为总会执行。

---

## 3. 未验证点（不做断言，遇到先 spike）

1. **Realtime 订阅面**：vanblog 是否在任意地方消费 PB realtime/SSE，未验证。
2. **跨 Pack 迁移依赖**：契约上默认不支持（Pack 之间独立），但无显式运行时校验。
3. **词法排序 vs 「Pack 内有序」**：`js_migration_test.go` 锁定 `AppMigrations` 按 `File` 词法排序；跨 Pack 顺序由 pack 名决定是测试推导，未大范围 e2e 验证。
4. **迁移失败事务边界**：PB runner 外层 `RunInTransaction` 会整体回滚，但「Pack 多文件 + core 混合」场景未专项验证。
5. **卸载 / `down` 语义**：未落地（`pack-theme-schema-design.md §12` 默认不自动删）。
6. **`--migrationsDir` 双职责**：同一 flag 同时驱动 `StageMigrations` 的 core 源目录和 `migratecmd.Config.Dir`（快照输出），是否意外覆盖未验证。
7. **`Record` 构造器 `Load(data)` 行为**：goja 传参到 `core.Record.Load` 的兼容性，未逐一字段验证。

---

## 4. 与现有文档的关系

| 文档 | 关系 |
| --- | --- |
| `docs/architecture-layering.md` | 本文件不重复其「三层架构 / Go vs JSVM 功能分配 / 路由表」，只补充 **PB 机制的隐式边界** |
| `docs/pack-theme-schema-design.md` | 本文件是其 §5/§6 的**已落地边界事实版**，把「设计」收敛成「契约」；实现细节留在那边 |
| `docs/lessons-learned.md` | 本文件 §2 是「PB 扩展机制」专项版经验教训，通用版留在那边 |
