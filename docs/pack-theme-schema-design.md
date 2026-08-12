# Pack/Theme 自定义 Schema 设计

> **状态**：**已部分落地**（P1 + P3 完成；P2 经源码核实无需自研执行器）。目标读者：vanblog 维护者 / 后续实施 agent。
>
> **一句话**：让 Pack（以及未来的 Theme）把「collection 的建表/改表（DDL）」作为自己的一部分声明出来，运行时/安装时自动 provision，而不是手写 `vault/pb_migrations/*.go` 并重建二进制。
>
> **前置阅读**：`docs/architecture-layering.md`（Go 业务层 + JSVM + Pack kernel）、`docs/theme-concepts.md`（平台层/主题）、`vault/internal/pack/`（Pack kernel 现状）。

---

## 0. 结论先行

采用 **PocketBase 原生 JS 迁移（`migrations/*.js`）** 作为 Pack/Theme 自建 schema 的载体。理由：

1. 这是 PB 平台自身的 schema 扩展机制，不用另造声明式 diff 引擎。
2. `vault/internal/pack/plan.go` 里已经有 `migrations/` 检测 + 备份常量，被删的 `deploy.go` 正是此事的执行器——补完而非从零造。
3. PB 的迁移 runner 按 migration 文件名记录「已应用」，幂等是免费的。
4. JS 迁移能表达任意 DDL + 数据回填（改名 + 回填），声明式 JSON DSL 表达不了。

---

## 1. 问题：扩展性是「伪装」的

现在一个 Pack 的「schema」实际被拆成**两套、手动同步**，只有一套是真的可扩展的：

### 1.1 校验 schema（已可扩展，但只做校验）

`packs/*/schema.ts` 导出 `models`（Zod schema）：

```ts
// packs/moments/schema.ts
import { MomentSchema } from "@vanblog/sdk";
export const models = { moments: MomentSchema };
```

构建链：`schema.ts` → `scripts/pack-schema-build.mjs` → `schema.js`（CJS bundle）→ 运行时由 `vault/internal/validation.PackSource` 加载，只挂 `OnRecordValidate` 做**写入校验**，**不建表**。

### 1.2 collection 定义（耦合死）

真正的 PB collection（字段 / 类型 / 权限规则）全部手写在 `vault/pb_migrations/*.go`：

- `1783000000_create_moments_collection.go`
- `1783000001_create_bookmarks_collection.go`
- `1783000002_create_live2d_config_collection.go`
- `1784000000_create_site_visits_collection.go`

这些是 Go 代码，编译进二进制。要新增/修改一个 Pack 的 collection，必须改 Go + 重新 `go build`。

### 1.3 证据

`1783000000_create_moments_collection.go` 上挂的 notebook 原话：

> Pack 不能自己建 collection：schema.js 只绑 OnRecordValidate 做写入校验，不建表。Collection 只能由 vault/pb_migrations/\*.go 建。

**结论**：`schema.ts` 只做「校验」，没做「建表」；真正的「建表」被锁死在 vault。给 Pack 加 collection = 改 vault + 重建二进制。扩展性确实是伪装的。

### 1.4 被砍过的半条路

`vault/internal/pack/plan.go` 已经预留了 Pack 自带迁移的**诊断面**：

- `migrationFiles()` 扫描 Pack FS 里的 `migrations/` 和 `migration/` 目录。
- `Plan.MigrationFiles / MigrationIDs / MigrationTarget` 字段。
- `Plan.BackupRequired / BackupStrategy / BackupScope`，其中 `BackupStrategyPocketBase = "pocketbase-create-backup-before-migration"`、`BackupScopePocketBase = "data.db, auxiliary.db, storage, pb_hooks, pb_migrations, pb_data.json"`。

但**执行器已被删除**（`discover.go` 的 notebook 记录了「删除了 deploy.go / deploy_test.go (ExecutePlan/ValidateExecutionPlan/ExecutionCallbacks)」），现在这些只是只读诊断，不会真正跑迁移。

---

## 2. 目标与非目标

### 目标

1. Pack 能在**自身目录内**声明它拥有的 PB collection（DDL），无需改 `vault/pb_migrations/*.go`、无需重建二进制。
2. 安装/启动时，系统自动 provision 这些 collection，幂等、可备份、可回滚。
3. 机制可**泛化到 Theme**（theme 需要自己的 collection 时复用同一套）。

### 非目标（本次不做）

- **Theme 配置 schema**（theme 暴露给 admin 的可配置项 coverImage/footerText/nav links）。这是另一套「theme config」机制，涉及存储模型 + JSON Schema 声明 + admin UI 渲染 + SSR 消费，**单独立项**，不混进本设计。
- **声明式 collection JSON DSL + Go diff/apply 引擎**。选型已否（见 §4）。
- 统一 `schema.ts` 与 DDL 为单一真源（选型已否，见 §4）。

---

## 3. 三种 schema 文件的分工（不强行统一）

| 文件                      | 职责                                         | 执行时机                           |
| ------------------------- | -------------------------------------------- | ---------------------------------- |
| `migrations/*.js`         | **DDL**（建 collection / 改字段 / 数据回填） | 安装/升级时执行一次，PB 记录已应用 |
| `schema.ts` → `schema.js` | **record 校验**（Zod）                       | 每次写入时 `OnRecordValidate`      |
| `hooks/*.pb.js`           | **行为**（事件钩子 / 自定义路由）            | 每次请求 / 事件                    |

三者回答不同问题（数据怎么存 / 这条记录合法吗 / 事件发生时做什么），不需要合并成一个文件。校验是**可选**的（`live2d_config`、`site_visits` 就没有对应 `schema.ts`，它们的写入走 hooks/routerAdd 或 admin 绕过 records API）。

---

## 4. 方案选型

| 方案                                              | 优点                                    | 缺点                                                                             | 结论     |
| ------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| **A. PB JS migration（`migrations/*.js`）**       | PB 原生、幂等免费、表达力全、半条路已铺 | 需要补执行器 + 处理 ID 命名空间（见 §6/§7）                                      | **采用** |
| **B. 声明式 `collections.json`**                  | 声明式、无 JS 执行 DDL                  | 要造 PB 字段 DSL + Go diff/apply 引擎，表达不了改名/回填，代码量最大             | 否       |
| **C. 统一进 `schema.ts`（models + collections）** | 单文件                                  | `z.url()` 与 PB `URLField` 非同构，漏抽象；把校验面（Astro 也消费）和 DDL 面耦合 | 否       |

---

## 5. 契约：Pack/Theme 自带 `migrations/*.js`

### 5.1 目录

```
packs/<name>/
├── pack.json
├── schema.ts            # 可选：Zod 校验
├── hooks/*.pb.js        # 可选：事件钩子/路由
├── pages/               # 可选：Astro 页面
└── migrations/          # ★ 新增：PB JS 迁移（DDL）
    └── 0001_init.js
```

`migrations/` 或 `migration/` 均可（与 `plan.go` 的 `migrationFiles()` 一致）。文件内格式为 PB 官方 JS 迁移（见 `vault/pb_migrations/1782707550_updated_users.js` 的写法）：

```js
/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 幂等守卫：findCollectionByNameOrId 在「找不到」时抛异常（sql: no rows），
    // 不会返回 null，所以必须 try/catch。findCollectionsByFilter 未暴露给迁移 VM。
    let exists = false;
    try {
      app.findCollectionByNameOrId("moments");
      exists = true;
    } catch (e) {
      exists = false;
    }
    if (exists) return;

    const collection = new Collection({
      /* type/name/fields/rules */
    });
    return app.save(collection);
  },
  (app) => {
    let collection = null;
    try {
      collection = app.findCollectionByNameOrId("moments");
    } catch (e) {
      collection = null;
    }
    if (collection) return app.delete(collection);
  }
);
```

> ⚠️ 实测（`vault/pb_migrations/packmigration_spike_test.go`）：`findCollectionByNameOrId` 找不到时抛 `sql: no rows in result set`，不是返回 null；`findCollectionsByFilter` 未暴露给 JS 迁移 VM。所以建表前判断「是否已存在」必须用 `try/catch`。

### 5.2 迁移文件名必须带数字 ID

与 `plan.go` 的 `migrationIDPattern`（`(^|/)([0-9]{3,})[^/]*$`）对齐：文件名必须含 `>= 3` 位的数字 ID 前缀（例如 `0001_init.js`、`1783000000_create_moments.js`），用于排序与去重。

---

## 6. 执行模型

### 6.1 两段式

1. **Stage（打包/启动前）**：把「核心 JS 迁移」+「所有可加载 Pack 的 `migrations/*.js`」stage 进一个合并目录，和现有 `StageHooks` 平行。
2. **Run（启动时，`apis.Serve()` → `RunAllMigrations()`）**：在 `jsvm.MustRegister` 之前完成 staging，让 `jsvm` 的 JS 迁移加载器把 Pack 迁移注册进 `core.AppMigrations`，再由 `RunAllMigrations()` 执行未应用的迁移。

> ⚠️ 关键区分（PB 0.39.5 源码实证）：
>
> - **`jsvm.Config.MigrationsDir`** = JS 迁移的**加载器**（`jsvm.registerMigrations()` 读 `.js` 文件 → `migrate(up, down)` → 注册进 `core.AppMigrations`）。
> - **`migratecmd.Config.Automigrate`** = 只是「admin 改 collection 时自动生成迁移快照文件」，**不是**「启动时跑 JS 迁移」。
>
> 所以 Pack 迁移走的是 `jsvm`，不是 `migratecmd`。

### 6.2 备份先行

执行任何 Pack 迁移前，调用 `app.CreateBackup(...)`。备份范围沿用 `plan.go` 已定义的 `BackupScopePocketBase`（`data.db, auxiliary.db, storage, pb_hooks, pb_migrations, pb_data.json`），S3 视为外部资源不纳入本地备份。

### 6.3 执行机制（已按 PB 0.39.5 源码核实）

PB 的 JS 迁移执行链是固定的、单一路径：

```

jsvm.Register()
→ registerMigrations() // 读 MigrationsDir 里的 \*.js
→ vm.Set("migrate", (up,down) => AppMigrations.Register(up,down,file))
apis.Serve()
→ app.RunAllMigrations() // 跑 SystemMigrations + AppMigrations
→ MigrationsRunner.Up() // \_migrations 表按 file 名记录已应用

```

因此**不需要自研执行器**（不必重拾被删的 `deploy.go`）。Pack 迁移只需：

1. stage 进一个**真实的、`jsvm.Config.MigrationsDir` 指向的目录**（和 `StageHooks` 平行，且在 `jsvm.MustRegister` 之前完成）。
2. 文件名全局唯一（`_migrations` 表按 `file` 做主键，见 §7 #1/#3）。

「已应用」状态由 PB 的 `_migrations` 表（`file VARCHAR(255) PRIMARY KEY`）天然记录，幂等免费。

唯一需要自研的是**备份先行**（PB runner 不自动备份）——执行 Pack 迁移前调 `app.CreateBackup(...)`，范围沿用 `BackupScopePocketBase`。若要支持「手动 `pack up` / 卸载 `down`」，再额外暴露命令行触发，但执行本身仍复用 `RunAllMigrations()`。

---

## 7. 关键设计问题（实现前必须解决）

| #   | 问题                                                                                                                | 影响                        | 方向                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **迁移 ID 命名空间**：两个 Pack 都叫 `0001_init.js` 会冲突；Pack 的 ID 也不能撞核心 Go 迁移（`1783xxxxx` 等已占用） | 冲突 → 迁移错序/漏跑/重复跑 | 迁移 ID 在 stage 时做**命名空间化**（如 `pack--<name>--<id>`），并在 stage 阶段做全局唯一性校验，冲突即 fail-closed                                                   |
| 2   | **排序**：Pack 内按数字 ID 升序；跨 Pack 顺序是否需要保证                                                           | 跨 Pack 有依赖时可能错序    | 默认假设 **Pack 之间无依赖**，只保证 Pack 内有序；跨 Pack 依赖明确不支持的写入契约                                                                                    |
| 3   | **已应用状态记录**：PB 的 `_migrations` 表按 `file` 名做主键，Go 与 JS 迁移共用一张表                               | 见 §6.3                     | 用「Pack 命名空间化文件名」（如 `pack--<name>--<id>_<desc>.js`）保证全局唯一；`_migrations` 由 PB 自动记录                                                            |
| 4   | **老库兼容**：现有 4 个 Pack collection 已经由 Go 迁移建过，`_migrations` 已记录旧 ID                               | 迁移到 JS 后不能重复建表    | JS 迁移用 `try { findCollectionByNameOrId } catch {}` 判断是否已存在（**不能用 `if (find...)`——找不到会抛异常**）；Go 版是 `FindCollectionByNameOrId` 返回 err 再判空 |
| 5   | **删除语义**：Pack 卸载时是否 `down` 删 collection                                                                  | 误删用户数据                | 默认**不自动删**；`down` 仅用于显式 `pack uninstall --purge`，且 dry-run + 确认                                                                                       |
| 6   | **内置 vs 本地 Pack 来源**                                                                                          | 迁移来源可信度不同          | 与现有 Pack 加载一致：内置 fail-closed，本地/用户 Pack 报 warning 不拖垮站点                                                                                          |

---

## 8. 与现有 `schema.ts` / hooks / validation 的关系

- `schema.ts`（Zod 校验）**保持不变**，仍是可选的 record 校验层。
- `StageHooks` / `validation.RegisterWithSources` **保持不变**。
- 新增 `StageMigrations` 与 `StageHooks` 平行，都在 `jsvm.MustRegister` 之前完成（`jsvm` 在注册时立即读 `MigrationsDir` 加载 JS 迁移）。
- 校验（Zod）与 DDL（PB collection）之间仍可能漂移；短期靠文档约定，长期可考虑用 `/api/vanblog/schema`（`vault/internal/schema/schema.go`）反推类型生成 Zod，**但这是远期优化，不在本次范围**。

---

## 9. 迁移现有 4 个 Go migration 的路径

1. 为 `moments`、`bookmarks`、`live2d_config`、`site_visits` 各写一份 `migrations/*.js`，内容等价于现有 Go migration 的 `up/down`，并保留幂等守卫。
2. 移除对应的 `vault/pb_migrations/*.go`（或先保留为 no-op 幂等空迁移，等 JS 迁移跑通后再删）。
3. **兼容已部署库**：JS 迁移的 `up` 里用 `try { app.findCollectionByNameOrId(name) } catch {}` 判断 collection 是否已存在，存在即 return；因此对已经由 Go 迁移建过 collection 的老库是 no-op，对全新库则由 JS 迁移建。
4. 用 `migrations_test.go` 里同样的方式做 e2e 断言（真实 `RunAppMigrations` + 检查 collection 字段）。

> 注意：移除 Go 迁移会影响 `_migrations` 的已应用历史。**先在干净库上验证 JS 迁移能建出等价 collection，再处理老库升级**，避免把「老库已经 applied Go 迁移」误判成「没跑过」。

---

## 10. Theme 泛化（方向，不在首期）

- 若 Theme 需要自己的 collection，**复用同一套 `migrations/*.js` 机制**：把 stage 的输入从「Pack 列表」泛化为「Pack + Theme 列表」，其余不变。
- Theme 的 `theme.json` 目前只含元数据；若加 `migrations/` 目录，需在 theme host / Caddy / Go theme routes 的消费方里同样纳入「内置 + 用户合并」视图（与现有 `vault/internal/theme/routes.go` 的 `roots()` 合并逻辑一致）。
- **Theme 配置 schema 是独立功能**，见 §2 非目标，不在此机制内。

---

## 11. 分阶段实施计划

| 阶段                      | 内容                                                                                      | 验收                                           |
| ------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **P1（本设计确认后）** ✅ | `pack.StageMigrations` + 全局 ID 唯一性校验 + 单测（staging/冲突/幂等）                   | `go test ./internal/pack/...` 通过             |
| **P2** ⏭️（无需自研）     | 迁移执行器：源码核实为 `jsvm` 加载 + `apis.Serve→RunAllMigrations()`，不重拾 `deploy.go`  | 新库启动后 4 个 Pack collection 由 JS 迁移建出 |
| **P3** ✅                 | 把现有 4 个 Go migration 迁成 Pack `migrations/*.js`，处理老库兼容（已删除 4 个 Go 迁移） | 干净库（e2e）+ 老库（升级）两条测试通过        |
| **P4** 🟡                 | 迁移前备份 ✅（`BackupBeforePendingMigrations`）；CLI `pack up <name>` 手动触发 ❌ 未做   | `vanblog pack up` 可手动触发迁移               |
| **P5（远期）**            | Theme 泛化；`/api/vanblog/schema` 反推 Zod 类型                                           | —                                              |

---

## 12. 风险与开放问题

| 风险                                          | 缓解                                           |
| --------------------------------------------- | ---------------------------------------------- |
| 迁移 ID 冲突导致错序/重复                     | stage 阶段全局唯一性校验，冲突 fail-closed     |
| 老库 `_migrations` 历史与新 JS 迁移 ID 不一致 | 幂等守卫 + 先在干净库验证 + 老库升级专项测试   |
| Pack 卸载误删 collection 数据                 | 默认不删，`--purge` 才 down，且 dry-run + 确认 |
| 内置/本地 Pack 迁移可信度不同                 | 内置 fail-closed，本地 warning 不拖垮站点      |
| 跨 Pack 依赖（A 的表被 B 引用）               | 契约明确不支持，Pack 之间独立                  |

**开放问题（需 spike）**：

1. Pack 迁移文件名的命名空间化方案（`pack--<name>--<id>_<desc>.js`）是否会被 PB 的 `MigrationsList` 词法排序打乱「Pack 内有序」——需用真实 `_migrations` 跑一次验证。
2. Pack 迁移「已应用」状态的落点：专用 collection vs `_migrations` 命名空间化行。
3. 迁移失败的事务边界：单迁移失败是否回滚整个 Pack 的迁移批，还是只标记该迁移失败。

```

```
