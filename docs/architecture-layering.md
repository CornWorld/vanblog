# 架构分层:Go 业务层 + JSVM 钩子 + Astro 前端

> **依据**:原项目 NestJS provider 5012 行 / 27 模块 / 131 端点 → PocketBase 重构后 ~600-1000 行 Go 增量
>
> **核心原则**:
>
> - **Go 层承担所有重运算 / 复杂业务 / 基础设施**(编译进二进制,性能 + 类型安全)
> - **JSVM 只做用户侧扩展点**(自定义钩子、cron、小功能脚本,学习成本低,热更新;核心审计已于 2026-09-17 迁 Go `internal/audit`,见 `pocketbase-extension-contract.md` 判据)
> - **Astro 前端通过 pb REST API + `sdk/` TypeScript 包消费数据**
>
> 这与 PocketBase 官方的定位一致:JSVM 是"方便用户加小功能",不是"写核心业务"。

---

## 1. 为什么要这样分层

### pb JSVM 的真实定位(官方)

> The prebuilt PocketBase executable comes with embedded ES5 JavaScript engine (goja) which enables you to write **custom server-side code**.

关键词:**custom**(用户自定义),不是 **core**(核心业务)。

JSVM 适合的场景:

- 用户想在文章发布后发个 webhook 通知
- 用户想给某类文章加自定义校验
- 用户想记录自定义审计事件

JSVM **不适合**的场景:

- 复杂查询构建(article.provider.ts 980 行)
- 图片处理(static.provider.ts 318 行)
- 迁移工具(大 JSON 解析 + 批量事务)
- Caddy admin API 集成(SSRF 校验 + 配置翻译)

### Go extend 的优势

| 维度            | Go extend    | JSVM (goja)         |
| --------------- | ------------ | ------------------- |
| 性能            | 原生         | 解释执行,慢 10-100x |
| 并发            | goroutine    | 单线程 VM 池        |
| 类型安全        | 编译时       | 运行时              |
| 生态            | 完整 Go 生态 | 无 Node.js 内置模块 |
| 调试            | dlv / IDE    | console.log only    |
| Promise / async | 原生         | ❌ 无               |
| 模块系统        | go modules   | CommonJS 限制       |
| 部署            | 编译进二进制 | `.pb.js` 文件       |
| 热更新          | 需重编译     | ✅ 改文件即生效     |

**结论**:核心业务用 Go(性能 + 可维护性),用户扩展用 JSVM(灵活性 + 热更新)。

---

## 2. 原项目代码统计(事实)

> 来源:`packages/server/src/provider/` 的 `wc -l` 统计

**Provider 层:5012 行,27 个模块**

**按复杂度分档**:

| 档位   | 模块                                                                                                                                            | 总行数 | 特征                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------- |
| **重** | article(980), static(560), auth(238), meta(268), pipeline(265), setting(258), draft(236), isr(208), website(143), waline(155)                   | ~3300  | 复杂查询 / 事务 / 外部进程 / 数据处理 |
| **中** | log(206), user(145), rss(132), category(129), viewer(126), visit(115), analysis(110), caddy(136), sitemap(98), token(88), access(54), init(171) | ~1450  | CRUD + 业务规则                       |
| **轻** | tag(94), markdown(47), customPage(31), cache(12), swagger(7)                                                                                    | ~190   | 纯包装                                |

**Controller 层:131 个端点,26 个 controller**

大部分是 thin CRUD wrapper,映射到 pb 的自动 API 后只剩**自定义端点**(约 30 个)。

---

## 3. 三层架构

```
┌──────────────────────────────────────────────────────────┐
│  Astro 前端 (prod SSR, Node theme host)                  │
│  - 通过 `sdk/` TypeScript 包调用 pb REST API            │
│  - 上传图片时做 WASM 水印/压缩                            │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼───────────────────────────────────┐
│  PocketBase (预编译 Go 二进制)                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  vanblog Go 业务层 (vault/internal/)                │ │
│  │  - article: 查询构建 / 发布 / 字数统计 / 搜索        │ │
│  │  - media: 存储驱动 (local/S3) / 查重 / 缩略图      │ │
│  │  - migration: JSON 解析 / 批量事务 / 字段映射       │ │
│  │  - caddy: admin API 客户端 / SSRF 校验 / 路由翻译   │ │
│  │  - revisions: 快照 / diff (go-diff)                 │ │
│  │  - visits: 原子计数 / 聚合                          │ │
│  │  - feed: RSS / Atom / Sitemap 生成                  │ │
│  │  - 各 manager 自挂 pb hook (事件/路由/启动初始化)    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  JSVM 钩子 (pb_hooks/*.pb.js)                       │ │
│  │  - 用户自定义钩子 (~20 行/个);核心(审计/cron)均已迁 Go │ │
│  │  - 直接调用 pb 原生 API ($app, Record, cronAdd 等)  │ │
│  │  - 不承担核心业务逻辑                                │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Go 业务层详细设计

### 4.1 包结构

```
vault/
  main.go                         # pb bootstrap (~30 行)
  go.mod
  internal/
    article/
      article.go                  # 查询/发布/搜索/时间线/回收站
      astro_revalidate.go         # Astro SSR 缓存刷新
    media/
      media.go                    # 存储驱动 (local/S3) / 查重 / 缩略图
    migration/
      migration.go                # JSON 解析 + 分批事务 + 字段映射
      routes.go                   # 注册 /api/vanblog/migrate/* 路由
    caddy/
      caddy.go                    # Caddy 配置构建 + SSRF 校验 + 路由翻译、原子 LoadConfig
      status.go                   # TLS 状态查询
      config_builder.go           # BuildFullConfig: typed struct → Caddy JSON
      cache.go                    # @id 缓存 / diff
    # Caddy admin API 客户端已独立为外部模块:
    # github.com/CornWorld/caddyadmin — 位于 ~/Code/caddyadmin/
    #
    # 为什么外置:它是独立演进的 Caddy admin HTTP 客户端(WaitForCaddy /
    # dry-run Validate / Load 重试等传输层关注点),不依赖 vanblog 的业务
    # 概念,可单独复用与测试。
    # 升级流程:go.mod bump 版本 → vault/internal/caddy 适配新 API → 全量测试。
    # 安全责任边界:SSRF 校验(ValidateTarget/DefaultAllowlist)、保留路径、
    # 用户规则翻译都在**本仓** internal/caddy(translator.go / ssrf.go);
    # caddyadmin 只做传输,不做任何目标地址合法性判断。
    revisions/
      revisions.go                # 快照写入 / diff / 恢复
    visits/
      visits.go                   # 原子计数 + 每日聚合
    feed/
      feed.go                     # RSS/Atom/Sitemap 生成
      routes.go                   # 注册 /api/feed.xml 等路由
    rss/
      rss.go                      # RSS/Atom XML 序列化
    sitemap/
      sitemap.go                  # Sitemap XML 序列化
    site/
      site.go                     # 站点配置读取
    devseed/
      seed.go                     # 开发环境种子数据
    admin/
      admin.go                    # admin 专属 DELETE 路由(categories/tags/users)
    bootstrap/
      bootstrap.go                # 首次启动 setup 引导(status / complete)
    pack/                          # Pack kernel: list/validate/resolve/stage builtin+local Packs
      pack.go                     # Pack{Name,Version,FS,Source} + Validate + Inspect
      source.go                   # Source enum + Builtins() from embed.FS
      discover.go                 # LoadLocal + DiscoverLocal + Resolve (whole-Pack replacement)
      hooks.go                    # StageHooks (atomic core+Pack hook staging)
      add.go                      # Add (atomic builtin→local copy)
      v0.go                       # RuntimeLoadableV0 (runtime skip+warn for unbuilt frontend)
  pb_migrations/                  # pb schema 迁移 (Go)
    1782200000_init_vanblog_collections.go
    1782300000_soft_delete_indexes.go
    1782300001_posts_rules_and_unique_pathname.go
    ...
  pb_hooks/                       # ★ JSVM 钩子 (用户侧)
    examples.pb.js                 # 官方示例 (给用户学习的)
    lib/
      vanblog.d.ts                 # pb + vanblog 类型声明 (TypeScript 姿态, IDE 补全)
```

### 4.2 Go 业务层模块职责

按域实测行数（`wc -l`，2026-09-29，`vault/internal/`，`pb_migrations`/`pb_hooks` 不计）：

| 模块            | 非测试 | 测试  | 职责                                                   |
| --------------- | ------ | ----- | ------------------------------------------------------ |
| `caddy`         | 2797   | 2718  | Caddy admin 客户端 / SSRF 校验 / 路由翻译 / TLS 状态    |
| `pack`          | 1531   | 1364  | Pack kernel: 发现/解析/原子暂存/whole-Pack 替换         |
| `article`       | 1056   | 1063  | 查询/发布/时间线/回收站 + Astro 缓存失效与持久重试      |
| `packcli`       | 893    | 405   | `vanblog pack` CLI                                     |
| `media`         | 706    | 1376  | 存储驱动 (local/S3) / MD5 查重 / 缩略图                 |
| `admin`         | 634    | 400   | backups / export / admin 删改路由                       |
| `mcp`           | 630    | 345   | MCP 文件端点（**dev-only**）                            |
| `validation`    | 548    | 636   | core schema + Pack schema 校验                          |
| `system`        | 498    | 55    | restart / metrics                                      |
| `devseed`       | 414    | 0     | 开发种子数据（**dev-only**）                            |
| `migration`     | 353    | 463   | ZIP 导入（导出在 `admin`）                              |
| `bootstrap`     | 352    | 202   | 首次启动 setup 引导                                     |
| `revisions`     | 315    | 484   | 修订快照 / diff / 恢复                                  |
| `audit`         | 292    | 383   | 通配 Request 审计                                      |
| `agent`         | 292    | 57    | 容器内 agent 端点（**dev-only**）                       |
| `site`          | 279    | 99    | 站点配置单行读取（`site.Get`）                          |
| `visits`        | 275    | 209   | 原子计数 / 日聚合                                       |
| `feed`          | 188    | 316   | RSS/Atom/Sitemap 路由                                   |
| `rss`           | 169    | 116   | RSS/Atom XML 序列化                                     |
| `commentssso`   | 159    | 181   | 评论 SSO 桥（默认关）                                   |
| `theme`         | 146    | 101   | `/api/themes`                                          |
| `palette`       | 136    | 0     | 调色板                                                  |
| `mediaurl`      | 123    | 101   | 媒体 URL 解析                                           |
| `schema`        | 55     | 0     | `/api/vanblog/schema`                                  |
| `sitemap`       | 54     | 68    | Sitemap XML 序列化                                      |
| `migrationschema` | 28   | 67    | 导出/导入共享 schema                                    |
| `traceid`       | 15     | 0     | 请求 trace id                                          |
| **总计**        | 13,458 | 11,209 | 27 个域                                                |

**对比原项目**:原 NestJS provider 层 5012 行被 pb 原生能力大幅吸收——pb 自动提供
`/api/collections/{name}/records` CRUD(分页/过滤/排序/关联展开)与 auth/权限规则,
原项目大部分代码是围绕这两件事的手写包装。

> **修正**(用户反馈):之前估算 ~2400 行是把 NestJS 模板代码直接搬到 Go,没扣除 pb 原生能力。真实增量细分:
>
> - 业务计算(article 字数/时间线/搜索 + draft 发布事务 + visit/viewer 聚合 + tag/category):~460 行
> - 外部集成(Caddy admin API + RSS + sitemap):~230 行
> - 工具/迁移(markdown 渲染 + seed + 图片上传 pipeline + 迁移工具):~250 行
>
> **三个"虚假工作量"**:
>
> 1. `setting.provider.ts`(259 行)13 个一样的 get/set —— pb 一条 record
> 2. `article.provider.ts`(980 行)700+ 行是 Mongoose 查询构建 —— pb URL 参数
> 3. auth 体系(238 行)JWT+guards —— pb authInPb + `@request.auth` 一行

### 4.3 pb_hooks:JSVM 钩子

JSVM 钩子直接使用 pb 原生全局 API
(`$app`、`Record`、`onRecordAfterCreateSuccess`、`cronAdd` 等)，pb 的 jsvm 插件自动
将这些 API 注入每个 executor VM。扩展系统从 Plugin 演进到 Pack 的完整历史见
`vault/internal/pack/`(旧 Plugin 制已废弃;原独立演进文档已在 2026-08 文档合并中移除)。

`pb_hooks/` 目录内容：

| 文件                   | 说明                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `examples.pb.js`       | 学习示例钩子,**当前全部以注释形式保留**(不执行),供用户参考复制到自己文件 |
| `lib/vanblog.d.ts`     | pb + vanblog 类型声明 (TypeScript 姿态, IDE 补全)                        |

> **cron 也在 Go 层**(2026-09-17 迁移):`cronAdd` 只是 PB Go API `app.Cron()` 的
> JS 绑定(jsvm `binds.go`),并非 JSVM 独有能力。核心聚合由 `internal/visits` 直挂
> `app.Cron().MustAdd("visits-daily-aggregate", "0 0 * * *", ...)`,原
> `system.pb.js` 已删除。JS 侧 `cronAdd` 留给用户自定义定时作业(`examples.pb.js`
> 示例 5)。

> **每日自愈 cron 已被 Go 持久重试取代**(2026-09-29 退役):原
> `pb_hooks/selfheal.pb.js` 每天 04:00 盲重发一次 Astro 缓存失效。现在
> `internal/article/astro_revalidate.go` 在失效 POST 失败时把 tags 合并进
> `pb_data/revalidate.pending.json`,后台循环(`startRevalidateRetry`,5s 节拍 +
> 启动首扫)重放成功即删——发布后秒级自愈,不再等每日一班。失败仍写
> `result="failure"` 审计行(admin 可见)。`site.displayOptions.revalidateSelfHeal`
> 开关随之作废(无 UI 绑定,字段留在 schema 兼容旧数据)。

> **审计在 Go 层**(2026-09-17 迁移):`internal/audit` 用**通配** `onRecord*Request`
> 覆盖全部 collection(含 Pack 运行时建表),action 字符串与 row 形状与旧 JS 版
> 逐字节兼容。用户要记自定义事件,直接写 `audits` collection(见
> `examples.pb.js` 示例 6),无需重新注册核心事件。

> `examples.pb.js` 的 5 个示例(webhook/slug/tag 限制/daily stats/custom header)目前都被 `//` 注释掉,文件不执行任何钩子。把它们视为学习样板,复制到你自己的 `.pb.js` 并去掉注释即可启用。

### 4.4 Manager 自挂 pb hook 模式（启动架构）

**装配点 = pb 的 hook 系统本身**，不再额外加 vanblog 自己的 Register/Bootstrap 层。

每个 manager 在 `New(app)` 时自挂所需的 hook（事件订阅、HTTP 路由、启动初始化）。main.go 只是构造清单 + `pb.Start()`：

```go
// vault/main.go
func main() {
    app := pocketbase.New()
    jsvm.MustRegister(app, jsvm.Config{...})
    migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{...})

    // 每个 manager 自挂 pb hook。顺序只影响同事件 Bind 顺序，
    // 无跨 manager 依赖。
    _ = revisions.New(app)
    _ = visits.New(app)
    _ = media.New(app)
    _ = article.New(app)
    migration.RegisterRoutes(app)
    _ = feed.New(app)
    _ = caddy.New(app)

    app.Start()
}
```

三种典型模式（来自实际代码）：

**事件 hook**（`internal/revisions/revisions.go`）：

```go
func New(app core.App) *Manager {
    m := &Manager{app: app}
    app.OnRecordUpdateRequest("posts").BindFunc(m.snapshotBeforePostUpdate)
    return m
}
func (m *Manager) snapshotBeforePostUpdate(e *core.RecordRequestEvent) error {
    // 业务逻辑
    return e.Next()
}
```

**HTTP 路由**（`internal/feed/routes.go`）：

```go
func New(app core.App) *Service {
    s := &Service{app: app}
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/api/feed.xml", s.serveRSS)
        se.Router.GET("/api/atom.xml", s.serveAtom)
        se.Router.GET("/api/sitemap.xml", s.serveSitemap)
        return se.Next()
    })
    return s
}
```

**启动初始化 + 路由 + 事件**（`internal/caddy/caddy.go`）：

```go
func New(app core.App) *Service {
    s := &Service{app: app, caddyAdminURL: DefaultCaddyAdminURL}
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.GET("/api/hooks/caddy/ask", s.handleAskEndpoint)
        se.Router.GET("/api/vanblog/tls/status", s.handleTLSStatusEndpoint)
        if os.Getenv("VANBLOG_SKIP_CADDY_SYNC") == "1" {
            log.Printf("[caddy] VANBLOG_SKIP_CADDY_SYNC=1: skipping config push")
        } else if err := s.pushConfigToAdminAPI(); err != nil {
            log.Printf("[caddy] config push failed: %v", err)
        }
        return se.Next()
    })
    return s
}
```

**为什么不用其他方案**：

| 方案                                     | 否决原因                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `wire` / `fx` DI 框架                    | pb 自己 own 生命周期（Bootstrap → Migrate → Serve），DI 框架跟它打架。痛点是「副作用时序」不是「对象图装配」。 |
| runtime 包（Mode 枚举 + Bootstrap 函数） | 又一层抽象，命名空洞（`Bootstrap` / `Sync` 看不出业务意义）。                                                  |
| 阶段接口（PhasePreServe / PhaseOnServe） | 本质还是主程序在做事，只是改写法。                                                                             |
| 命名约定 + 强制接口                      | 「又臭又长」—— 一个文件 8 行 register 函数堆叠。                                                               |

**所有 vanblog 自定义路由（来自各 Manager 的 OnServe，2026-09-29 实测 58 条）**：

| Manager     | 路由                                     | Handler                   |
| ----------- | ---------------------------------------- | ------------------------- |
| `feed`      | `GET /api/feed.xml`                      | `serveRSS`                |
| `feed`      | `GET /api/atom.xml`                      | `serveAtom`               |
| `feed`      | `GET /api/sitemap.xml`                   | `serveSitemap`            |
| `feed`      | `GET /feed.xml`（别名）                  | `serveRSS`                |
| `feed`      | `GET /atom.xml`（别名）                  | `serveAtom`               |
| `feed`      | `GET /sitemap.xml`（别名）               | `serveSitemap`            |
| `article`   | `GET /api/vanblog/timeline`              | `handleTimelineEndpoint`  |
| `article`   | `GET /api/vanblog/search?q=`             | `handleSearchEndpoint`    |
| `article`   | `GET /api/vanblog/posts/trash`           | `handleTrashEndpoint`     |
| `article`   | `POST /api/vanblog/posts/{id}/restore`   | `handleRestoreEndpoint`   |
| `article`   | `POST /api/vanblog/posts/{id}/purge`     | `handlePurgeEndpoint`     |
| `article`   | `POST /api/vanblog/posts/{id}/unlock`    | `handleUnlock`            |
| `media`     | `DELETE /api/vanblog/media/{id}`         | `handleDelete`            |
| `media`     | `POST /api/vanblog/posts/{id}/ingest-images` | `handleIngestImages`  |
| `caddy`     | `GET /api/hooks/caddy/ask`               | `handleAskEndpoint`       |
| `caddy`     | `GET /api/vanblog/tls/status`            | `handleTLSStatusEndpoint` |
| `caddy`     | `GET /api/vanblog/routing/rules`         | `handleListRules`         |
| `caddy`     | `GET /api/vanblog/routing/status`        | `handleRoutingStatus`     |
| `caddy`     | `GET /api/vanblog/routing/audits`        | `handleRoutingAudits`     |
| `caddy`     | `GET /api/vanblog/routing/render`        | `handleRenderConfig`      |
| `caddy`     | `PUT /api/vanblog/routing/rules`         | `handleReplaceRules`      |
| `caddy`     | `POST /api/vanblog/routing/validate`     | `handleValidateRule`      |
| `caddy`     | `POST /api/vanblog/routing/apply`        | `handleApply`             |
| `caddy`     | `POST /api/vanblog/themes/reload`        | `handleThemeReload`       |
| `admin`     | `GET /api/vanblog/backups`               | `handleListBackups`       |
| `admin`     | `POST /api/vanblog/backups`              | `handleCreateBackup`      |
| `admin`     | `GET /api/vanblog/backups/{key}/download` | `handleDownloadBackup`   |
| `admin`     | `DELETE /api/vanblog/backups/{key}`      | `handleDeleteBackup`      |
| `admin`     | `POST /api/vanblog/backups/{key}/restore` | `handleRestoreBackup`    |
| `admin`     | `GET /api/vanblog/export/all`            | `handleExportAll`         |
| `admin`     | `GET /api/vanblog/export/post/{id}`      | `handleExportPost`        |
| `admin`     | `DELETE /api/vanblog/categories/{id}`    | `handleDeleteCategory`    |
| `admin`     | `DELETE /api/vanblog/tags/{id}`          | `handleDeleteTag`         |
| `admin`     | `DELETE /api/vanblog/users/{id}`         | `handleDeleteUser`        |
| `bootstrap` | `GET /api/vanblog/setup/status`          | `handleStatus`            |
| `bootstrap` | `POST /api/vanblog/setup/complete`       | `handleComplete`          |
| `bootstrap` | `GET /api/vanblog/runtime/comments`      | `handleRuntimeComments`   |
| `migration` | `POST /api/vanblog/migrate/import`       | 内联闭包 → `ImportZip`    |
| `visits`    | `POST /api/vanblog/visits/record`        | `handleRecord`            |
| `visits`    | `GET /api/vanblog/visits/summary`        | `handleSummary`           |
| `system`    | `POST /api/vanblog/system/restart`       | `handleRestart`           |
| `system`    | `GET /api/vanblog/system/metrics`        | `handleMetrics`           |
| `schema`    | `GET /api/vanblog/schema`                | `handleSchema`            |
| `theme`     | `GET /api/themes`                        | `serveThemes`             |
| `palette`   | `GET /api/palettes`                      | `servePalettes`           |
| `palette`   | `GET /api/palette.css`                   | `servePaletteCSS`         |
| `commentssso` | `POST /api/vanblog/comments-sso/token` | `handleIssueToken`        |
| `commentssso` | `GET /api/vanblog/comments-sso/userinfo` | `handleUserinfo`        |
| `mcp`       | `POST /api/vanblog/mcp/list_dir`（**dev-only**） | `handleListDir`   |
| `mcp`       | `POST /api/vanblog/mcp/read_file`（**dev-only**） | `handleReadFile`  |
| `mcp`       | `POST /api/vanblog/mcp/write_file`（**dev-only**） | `handleWriteFile` |
| `mcp`       | `GET /api/vanblog/mcp/override_check`（**dev-only**） | `handleOverrideCheck` |
| `agent`     | `GET /api/vanblog/agent/terminal`（**dev-only**） | `handleTerminal`  |
| `agent`     | `POST /api/vanblog/agent/validate`（**dev-only**） | `handleValidate`  |
| `main.go`   | `GET /debug/pprof/{key}` 等 5 条（pprof，仅 localhost 可达——Caddy 不代理 `/debug/*`，用户路由规则也禁止占用该前缀） | `pprof.*` |

其余入口不在上表:pb 原生 CRUD 走 `/api/collections/*`,`/api/realtime` 为 pb SSE。

**并发闸门**（`main.go`,2026-09-29 收窄）:根路由 BindFunc 信号量,容量 = `hooksPool`
(默认 64,与 entrypoint 一致),**只作用于会执行 JS hook 的路径**(`/api/collections/*`、
`/api/files/*`、用户 `routerAdd` 路由)——PB jsvm 池溢出会创建一次性 goja Runtime
(~44MB 不归还),满载时返回 503 而非溢出。Go manager 路由(上表全部)与 SSE
(`/api/realtime`)豁免:它们不进 jsvm 池,闸门饱和时仍可用。已知限制:用户
`routerAdd` 注册 `/api/vanblog/*` 同前缀路由会一并豁免——病态场景,接受。
jsvm 池溢出不归还问题已计划上游报 pocketbase issue(链接待补)。

**Caddy Manager 的配置推送流程**（`internal/caddy/caddy.go::pushConfigToAdminAPI`）：

1. 读 `site.routing` + `site.allowedDomains` + `site.caddyLogLevel` from DB
2. 组装 `BuildOpts` + 合并规则列表
3. `BuildFullConfig` → 翻译 + SSRF 校验所有规则，任一失败则整体 abort
4. `WaitForCaddy`（最多 5s）—— entrypoint 并行启动 Caddy，通常是毫秒级
5. `ValidateConfig`（dry-run）—— 不应用就先抓配置错误
6. `LoadConfig`（Phase 1 已加 admin-endpoint restart 重试）

任一步失败 → 整个 pipeline 重试，**最多 3 次快速退避**（500ms/1s）。

> 设计意图：site.routing 可能在 pb 启动**期间**被运维改写，下一次重试能捡到修正后的规则而成功。

总失败时：把最后一次 error 持久化到 `site.caddyLastError`（admin UI 据此显示"为什么站点在维护页"），并把 error 返回给 `hooks.go` —— 后者只记录日志，**不崩 pb**。管理口 `:8080` 始终可达，运维可恢复。

**自挂 hook 的关键性质**：

1. **顺序无关**：manager 之间通过 pb 事件解耦，无跨 manager 调用。
2. **dev/prod 自然涌现**：dev 模式不需要 Mode 枚举，caddy manager 自己读 env 决定是否 `pushConfigToAdminAPI`。
3. **失败可恢复**：`pushConfigToAdminAPI` 失败不崩 pb —— 维护配置留在 Caddy，pb 的 :8080 管理口仍可达。
4. **测试用同一路径**：测试里 `Manager.New(app)` 即触发完整 hook 绑定，不需要单独的 setup helper。

详见 `vault/internal/{caddy,media,article,feed,migration,revisions,visits}/` 各包入口。

---

## 5. JSVM 扩展点设计

### 5.1 定位

**JSVM 是"用户自定义扩展",不是"核心业务"**。

边界事实(2026-09-29 论证沉淀):

- **默认访客读路径零 JS**:页面/feeds/文章读取不进 goja——除非用户自己给
  读事件加了钩子。QPS 最高的链路默认与 JSVM 无关。
- **第一方住在 JSVM 里的只剩 Pack**:moments/bookmarks 各 8 行 author-stamping、
  online 75 行心跳路由,外加 4 个 builtin pack 的 schema 迁移(JSVM migrations,
  boot 时跑)——彻底移除 jsvm 会连 Pack 系统一并杀死。
- **信任级别 = 管理员**:钩子文件需要服务器文件系统写权限,JSVM 不承接
  不可信代码($os/$http/$app 全量暴露),它是管理员的进程内脚本面。
- **资源语义**:pb 对钩子无超时、无内存阀(goja 无硬内存帽;池溢出行为见
  §4.4 并发闸门)。放大被闸门限流,容器 OOM kill 兜底。
- **fail-fast**:staged hooks 有语法/运行时错误 → 启动 panic
  (`HooksWatch: false`,main.go),不会静默缺钩子继续服务。

我们提供的 `pb_hooks/` 里:

- `examples.pb.js` — 官方示例 (给用户学习的,6 个钩子,**当前全部注释掉,需复制到自己文件去掉注释才能生效**)
- `lib/vanblog.d.ts` — pb + vanblog 类型声明 (TypeScript 姿态, IDE 补全)

**不提供的**(核心业务在 Go 里):

- 迁移工具实现 (Go)
- Caddy 集成实现 (Go)
- 路由翻译实现 (Go)
- revisions 实现 (Go)
- 复杂查询构建 (Go)

### 5.2 官方示例钩子 (pb_hooks/examples.pb.js)

```javascript
/// <reference path="./lib/vanblog.d.ts" />

// 示例 1: 文章发布后发 webhook (使用 pb 原生的 $http)
onRecordAfterCreateSuccess((e) => {
  if (e.record.getString("status") !== "published") return;
  $http.send({
    method: "POST",
    url: "https://hooks.slack.com/...",
    body: JSON.stringify({
      text: "新文章发布: " + e.record.getString("title"),
    }),
  });
}, "posts");

// 示例 2: 特定分类的文章自动加水印标记
onRecordBeforeCreateRequest((e) => {
  if (e.record.getString("category") === "photography") {
    const tags = e.record.get("tags") || [];
    tags.push("watermark-required");
    e.record.set("tags", tags);
  }
}, "posts");

// 示例 3: 记录自定义审计事件 (核心审计在 Go 层,用户只记自己的事件)
onRecordCreateRequest((e) => {
  e.next(); // 必须第一行——见 pocketbase-extension-contract.md 事实 11
  const col = $app.findCollectionByNameOrId("audits");
  const row = new Record(col);
  row.set("action", "newsletter.subscribe");
  row.set("target", e.record.id);
  $app.save(row);
}, "subscribers");
```

**特征**:每个钩子 < 20 行,使用 pb 原生 API,不做复杂逻辑。

### 5.3 pb_hooks 类型声明 (pb_hooks/lib/vanblog.d.ts)

这是 TypeScript 声明文件，供 IDE 补全（不是运行时代码）。pb 的 jsvm 插件自动生成
`pb_hooks/types.d.ts`（声明所有 pb 原生 API）。`vanblog.d.ts` 补充 vanblog 特有的
collection 字段类型：

```typescript
/// <reference path="../types.d.ts" />

// vanblog posts collection 字段类型
interface VanblogPost {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published" | "hidden";
  pathname: string;
  tags: string[];
  category: string;
  author: string;
  private: boolean;
  deleted: boolean;
  viewCount: number;
  // ...
}

// site 表字段类型
interface VanblogSite {
  siteName: string;
  siteDesc: string;
  baseUrl: string;
  theme: "default" | "minimal" | "magazine" | "custom";
  routing: VanblogRouteRule[];
  // ...
}
```

> 扩展系统从 Plugin 到 Pack 的演进分析见 `vault/internal/pack/`(原独立文档已在 2026-08 文档合并中移除)。

---

## 6. Go vs JSVM 的功能分配表

| 功能             | Go 业务层                                  | JSVM 钩子                             | 用户能否覆盖          |
| ---------------- | ------------------------------------------ | ------------------------------------- | --------------------- |
| 文章 CRUD        | pb 自动 API                                | `onRecordCreateRequest("posts")` 等   | ✅ 用户可加校验       |
| 文章查询 (复杂)  | `article.GetTimeline/Search/GetByPathname` | 不暴露                                | ❌ (Go 统一)          |
| 草稿发布         | `article.Publish/Unpublish`                | 不暴露                                | ❌                    |
| 文章回收站       | `article.ListTrash/Restore`                | 不暴露                                | ❌                    |
| 图片上传         | pb FileField + `media` 驱动                | `onRecordCreateRequest("media")`      | ✅ 用户可加后处理     |
| 图片查重         | `media` MD5 去重                           | 不暴露                                | ❌                    |
| S3 存储          | `media` S3 驱动                            | 不暴露                                | ❌                    |
| 迁移工具         | `migration.Import`                         | 不暴露 (用户通过 Admin UI 触发)       | ❌                    |
| Caddy 路由       | `caddy` 客户端 + SSRF 校验                 | 不暴露                                | ❌                    |
| Caddy HTTPS      | `caddy.OnDemandTLS`                        | 不暴露                                | ❌                    |
| revisions 快照   | `revisions` 自动快照                       | 不暴露                                | ❌                    |
| revisions 恢复   | `revisions` 恢复                           | 不暴露                                | ❌                    |
| visits 计数      | `visits` 原子计数                          | 不暴露                                | ❌                    |
| visits 聚合      | `internal/visits` 挂 `app.Cron()` 每日聚合 | 不暴露                                | ❌                    |
| RSS/Atom/Sitemap | `feed` 生成 + 路由注册                     | 不暴露                                | ❌                    |
| 审计日志         | `internal/audit` 通配 Request 钩子(含 Pack 表)+ auth.login | 用户自定义事件直写 audits(examples 示例 6) | ✅                     |
| 自定义定时任务   | —                                          | `cronAdd("id", "...", () => { ... })`(`app.Cron()` 的 JS 绑定) | ✅                    |
| 自定义 API 端点  | —                                          | `routerAdd("GET", "/my-api", ...)`    | ✅                    |

> **注**:绝大多数 CRUD 端点不需要手写——PocketBase 原生 `/api/collections/{name}/records` 自动提供 list/get/create/update/delete(含分页/过滤/排序/关联展开),权限由 collection 的 `listRule`/`createRule`/`updateRule`/`deleteRule` 控制。`routerAdd` 仅用于 webhook 转发、跨表聚合、外部 API 集成等特殊业务。Pack 页面路由由 Astro adapter 静态注入 `/p/<pack>`,无需手写。
**总结**:

- Go 业务层承担 **~18 个核心功能** (重运算/基础设施,含审计)
- JSVM 提供 **~4 个扩展点** (定时、自定义路由、校验钩子、自定义事件)

- JSVM 钩子使用 pb 原生 API (`$app`、`Record`、`$http` 等)，不通过中间 `vanblog.*` 命名空间

---

## 7. 迁移工具的特殊处理

迁移工具是最重的逻辑（ZIP 二进制 + 图片重传 + 事务）。**必须在 Go 层**。

实际形态是 **ZIP 导入导出 roundtrip**（非 JSON）:

- **导出**（`internal/admin/export.go`）: `GET /api/vanblog/export/all` /
  `GET /api/vanblog/export/post/{id}` → ZIP(`posts.json`/`post.json` +
  `images/{collId}/{recId}/{filename}`),schema 由 `internal/migrationschema`
  的共享结构(`migrationschema.Post`)定义。
- **导入**（`internal/migration/zip_import.go`）: `POST /api/vanblog/migrate/import`
  (admin-only,body 限 100MB,单事务):

```go
// internal/migration/zip_import.go
func (imp *Importer) ImportZip(zipData []byte) (*Result, error) {
    // 1. 读 posts.json(全量)或 post.json(单篇,单对象)
    // 2. 逐篇建 posts 记录——导出的 ID 是临时的,一律新建
    // 3. content 里引用的图片:上传为**新** media 记录(二进制来自
    //    images/…),重写 <img src> 指向新文件 URL
    // 4. 分类/标签按名字解析为 ID(不存在则建)
    // 5. 不兼容数据进 result.Errors,不中断整体
}
```

> 仅注册 `POST /api/vanblog/migrate/import` 一个导入端点(无 `migrate/status`),
> 导入进度由调用方自行跟踪;admin UI 也可通过 backups(`admin.handleCreateBackup`)
> 做整站快照级备份恢复。

---

## 8. 实现状态

### Go 业务层 (已完成)

| 模块            | 状态    | 说明                                          |
| --------------- | ------- | --------------------------------------------- |
| `pb_migrations` | ✅ 完成 | 创建 collections + 软删除索引 + 访问规则      |
| `article`       | ✅ 完成 | 查询/发布/搜索/时间线/回收站 + Astro 缓存刷新 |
| `media`         | ✅ 完成 | 本地/S3 存储驱动 + MD5 查重                   |
| `migration`     | ✅ 完成 | JSON 导入 + 分批事务 + 路由注册               |
| `caddy`         | ✅ 完成 | admin API 客户端 + SSRF 校验 + TLS 状态       |
| `revisions`     | ✅ 完成 | 快照 + diff + 恢复                            |
| `visits`        | ✅ 完成 | 原子计数 + 每日聚合(`app.Cron()` 夜间任务)    |
| `feed`          | ✅ 完成 | RSS/Atom/Sitemap 生成 + 路由                  |
| `site`          | ✅ 完成 | 站点配置读取                                  |
| `devseed`       | ✅ 完成 | 开发环境种子数据                              |
| `audit`         | ✅ 完成 | 通配 Request 审计钩子(2026-09-17 从 JSVM 迁入,覆盖 Pack 表) |

### JSVM 钩子 (已完成)

| 文件                            | 状态    | 说明                             |
| ------------------------------- | ------- | -------------------------------- |
| `pb_hooks/lib/vanblog.d.ts`     | ✅ 完成 | pb + vanblog 类型声明 (IDE 补全) |
| `pb_hooks/examples.pb.js`       | ✅ 完成 | 6 个学习示例                     |

### TypeScript SDK (已完成)

| 包           | 状态    | 说明                                           |
| ------------ | ------- | ---------------------------------------------- |
| `sdk/`       | ✅ 完成 | 共享类型定义 (Post/Tag/Category/SiteConfig 等) |
| `sdk/client` | ✅ 完成 | PocketBase 客户端封装 (Astro SSR 使用)         |

---

## 9. 与之前文档的关系

本文件是 **架构分层的最终决策**，修正了之前 schema-design.md §4 "pb_hooks 事件映射"的定位：

| 之前 (schema-design §4)              | 现在 (本文档)                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 全部功能用 pb_hooks 实现             | 核心用 Go 业务层，扩展用 JSVM                                                                                                                                                                                                                    |
| `OnRecordUpdateRequest` 写 revisions | Go hook 写 revisions                                                                                                                                                                                                                             |
| `routerAdd` 实现迁移端点             | Go 直接注册路由 `/api/vanblog/migrate/*`                                                                                                                                                                                                         |
| `$http.send` 调 Caddy                | Go `net/http` 调 Caddy                                                                                                                                                                                                                           |
| `$os.writeFile` 写 md_output         | 前端 Astro 处理 markdown 渲染(markdown 管道位于 `app/src/lib/markdown/config.ts`,支持 shiki 代码高亮 + remark-math/rehype-katex + 自定义 remark-container/rehype-enhance/rehype-code-block + 用户注入的 `userRemarkPlugins`/`userRehypePlugins`) |
| Go SDK + JSVM 绑定层                 | Go 业务层直挂 pb hook, 无中间绑定层                                                                                                                                                                                                              |

**修正原因**: 用户反馈"运算代码不应在 JSVM", 且 pb 官方 JSVM 定位是"用户自定义扩展"不是"核心业务"。
实际重构中 Go 业务包直接通过 `New(app)` 注册 pb hook, 不存在 `vanblog.*` JSVM 命名空间或中间绑定层。
