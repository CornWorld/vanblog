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
| cron | Go `app.Cron()`（核心聚合在 `internal/visits`）；JS `cronAdd` 只是它的绑定 | 用户可在 `.pb.js` 注册自定义定时任务（migration VM 无此绑定） |
| storage | `vault/internal/media/` 封 MD5/S3/缩略图 | 扩展者只声明 `FileField`，不接触 Go 存储 |
| REST `/api/collections/*` | 前端 `app/` + `sdk/` 直接消费 | 每个新 collection 自动获得完整 REST API，无需手写端点 |
| 自定义路由 `/api/vanblog/*` | Go manager 在 `OnServe` 里 `se.Router.*` 注册 | 核心业务端点 Go 显式暴露；JS `routerAdd` 只做非核心扩展 |

---

## 2. 隐式边界（12 条踩坑实证）

> 这是本次重构撞墙后固化的契约。每条 = 事实 + 约束。源码依据可追溯到 PB v0.39.5;事实 9-12 基于 v0.40.1 源码与容器实测(v0.40.1 为当前 go.mod 版本)。

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


### 事实 9：`normalizeServeExceptions` 只放行 ApiError 家族，裸 JS Error 整体吞没

- **事实**：jsvm 在 OnServe 时全局绑定 `normalizeServeExceptions`，它只把 `*goja.Exception` 里能 `Export()` 成 Go `error`/`GoError` 的值还原；`new Error("msg")`、`new ValidationError(code,msg)` 导出后都不是这两类 → 客户端只收到 400 `"Something went wrong while processing your request."`，**消息与 data 全部丢失，日志一行都没有**。只有 `new ApiError/BadRequestError(...)`（registerFactoryAsConstructor 暴露的家族）能把消息带回响应。After*Success 之类非路由钩子的抛错走另一条路：错误以 `"Error: xxx at /workspace/pb.js:3:11(11)"` 形态出现在 HTTP 500 body——坐标是 jsvm 把全部钩子合并编译的虚拟 blob（`defaultScriptPath = cwd/pb.js`），行号无效。
- **约束**：路由钩子要给客户端信息必须抛 ApiError 家族；用户 JS 钩子内部错误自行兜底（写 audits 行 + console.error。核心审计的 `hookError` 通道已随 2026-09-17 审计 Go 化退役，见 §2 末「扩展边界判据」），不要指望响应或 pb 日志。

### 事实 10：`$app.logger()` 在 JSVM 里不可调用

- **事实**：`$app.logger()` 返回的 `slog.Logger` 暴露给 goja 的是**值**，`Error/Warn` 都是指针接收者方法 → goja 报 `TypeError: Object has no member 'Error'`（容器实测）。`console.log/error` 经 goja_nodejs console 打到 Go `log` → stdout 带时间戳，但无级别、不进 `_logs` 表。
- **约束**：JSVM 内没有结构化日志；用户钩子的错误可见性 = 自写的 `audits` 行 + `console.error`（stdout）。需要结构化日志就把代码放 Go 层。

### 事实 11：审计走 `onRecord*Request`，`e.next()` 必须第一个调用

- **事实**：Request 钩子事件带 `e.auth / e.realIP() / e.request`，审计行才有 actor/ip/UA；After*Success 事件全没有（历史事故：每行 actor=""）。Request 事件里 `e.next()` 才执行落库，先审计后 `e.next()` 会把可能失败的写记成 success。
- **约束**：模式固定为「`e.next()` 第一行 → 审计」。核心审计已于 2026-09-17 迁 `internal/audit`（Go 通配 Request 钩子，覆盖 Pack 动态表，`auth.login` 恢复）；JS 侧只剩用户自定义钩子，同样遵守「`e.next()` 第一行」纪律。JS `hookError` 通道退役——Go 侧审计失败降级 slog，不再写 failure 行。

### 事实 12：jsvm `HooksWatch` 监视的是 staging 拷贝，对本仓结构性失效

- **事实**：`main.go` 把钩子 stage 进一次性 temp 目录（`os.MkdirTemp("vanblog-hooks-*")`）后，jsvm 的 watcher 盯的是 staging——启动后永不再变，**任何源文件改动都不触发热重载**（容器实测：docker cp 与容器内重写均无 restart 日志）。pb 官方热重载模型 = watcher → `app.Restart()` → `execve` 换进程镜像 → 重新走一遍 staging + registerHooks。
- **约束**：本仓由 `vault/hooks_watch.go` 的 `watchHookSources` 接管：监视**源目录**（core pb_hooks / pb_migrations）→ 防抖 300ms → 重跑 `StageHooks/StageMigrations` → `app.Restart()`；restage 失败则留在旧 staging 不重启（避免 crash-loop）。Pack 源不在监视面（builtin 内嵌不可变、Pack 结构不暴露本地目录），改 Pack 源仍需重启容器。staging 目录用确定性 per-PID 路径，execve 链路复用同一目录，不再每次启动泄漏一个 `vanblog-hooks-*`。

---

### 扩展边界判据（2026-09-17，审计 Go 化时沉淀）

**一行判据：这段代码需要 go test 吗？需要 → 核心业务，进 Go。换个站点想不想让它不一样？想 → 用户扩展面（JS 钩子 / 配置 / 规则）。**

三条曾模糊、现收敛的重叠面：

1. **校验有三处可写**（PB 规则 / Pack `schema.ts` Zod / `onRecord*Request` JS）：结构不变式 → 规则或 Go（unique index、admin-only 写规则）；数据契约 → Zod；站点策略偏好 → JS 钩子。
2. **横切行为分两层**（审计/通知/限流类）：核心横切 → Go 通配 Request 钩子（`internal/audit`，无 tag 注册对全部 collection 生效，含 Pack 运行时建表——JSVM 按表注册做不到）；用户附加 → JS 追加。事实 8 的 append-only 保证两者共存：jsvm 先注册 → JS 先跑 → Go manager 后注册、`e.Next()` 之后落审计行，观察的是最终状态。
3. **cron 双面俱在**：`cronAdd` 只是 Go API `app.Cron().Add` 的 JS 绑定（jsvm `binds.go:106-124`）。本文档曾断言「cron 是 JSVM-only、Go 侧无注册面」——**该断言错误**，2026-09-17 读 binds.go 实锤推翻，visits 聚合随之迁 `internal/visits`（`app.Cron().MustAdd`），`system.pb.js` 删除。教训：**jsvm 绑定面 ≠ PB 能力边界**，判「某能力 JS-only」前必须先查 binds.go 对应的 Go API。另注：core 的 `system.pb.js` 从来不是用户可编辑面——事实 8 append-only（用户自注册 cron，同 id 冲突、异 id 与核心作业互覆写聚合行）+ core 烤入镜像（升级即覆盖），删掉它没有移除任何真实用户面。

**审计为什么曾在 JS**（迁移史，防再犯）：`338b6f42`（2026-06-24）按「热更新+用户可自定义」把审计归类进 JS——这是**有立场的扩展性押注**（jsvm 是产品特性），不是疏忽；它的失误不在立场，而在没先切分**正确性内核**（actor/ip 抓取、链安全、动态表覆盖——没有用户「定制」正确性）与**可变偏好**，而后续全部事故都出在前者。`bd4aee11`（07-03）撞 Request 链控问题后错误回撤 After\*Success 并放弃 actor（症状压制，actor 空了两个半月）；9-16 断链饿死事故证伪「After\*Success 是免链控 observer」假设；`8d43f74c`（09-17）恢复 Request 语义；同日完成 Go 化。「用户可记自定义事件」不要求核心审计住 JS——用户直接写 `audits` collection 即可（`examples.pb.js` 示例 6）。Go 化同时消除了事实 9/10/12 对审计路径的适用面（异常吞没、logger 失明、staging watcher 均不再影响审计）。

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
