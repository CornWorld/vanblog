# 架构分层:Go 业务层 + JSVM 钩子 + Astro 前端

> **依据**:原项目 NestJS provider 5012 行 / 27 模块 / 131 端点 → PocketBase 重构后 ~600-1000 行 Go 增量
>
> **核心原则**:
>
> - **Go 层承担所有重运算 / 复杂业务 / 基础设施**(编译进二进制,性能 + 类型安全)
> - **JSVM 只做用户侧扩展点**(审计钩子、小功能脚本,学习成本低,热更新)
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
│  Astro 前端 (prod SSG / dev server)                      │
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
│  │  - 审计日志 (vanblog-audit.js + system.pb.js)       │ │
│  │  - 用户自定义钩子 (~20 行/个)                       │ │
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
      caddy.go                    # Caddy admin API 客户端 + SSRF 校验 + 路由翻译
      status.go                   # TLS 状态查询
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
  pb_migrations/                  # pb schema 迁移 (Go)
    1782200000_init_vanblog_collections.go
    1782300000_soft_delete_indexes.go
    1782300001_posts_rules_and_unique_pathname.go
    ...
  pb_hooks/                       # ★ JSVM 钩子 (用户侧)
    examples.pb.js                 # 官方示例 (给用户学习的)
    system.pb.js                   # 审计日志 + visits 聚合 cron
    lib/
      vanblog.d.ts                 # pb + vanblog 类型声明 (TypeScript 姿态, IDE 补全)
      vanblog-audit.js             # 审计日志公共模块 (require() 共享)
```

### 4.2 Go 业务层模块职责

| 模块         | 对应原项目                      | 增量估计 | 关键 Go 库                                                            |
| ------------ | ------------------------------- | -------- | --------------------------------------------------------------------- |
| `article`    | article.provider.ts (980)       | ~120     | pb `filter`/`sort` 覆盖查询；增量=字数统计+时间线聚合+搜索+回收站     |
| `media`      | static.provider.ts (560)        | ~100     | pb FileField + thumbs 内置；增量=MD5 去重+S3 驱动                     |
| `migration`  | backup.controller.ts (137)      | ~150     | `encoding/json` + `app.RunInTransaction` 事务                         |
| `caddy`      | caddy.provider.ts (136)         | ~80      | `net/http` + `net/url` (SSRF)                                         |
| `revisions`  | — (新增)                        | ~80      | `github.com/sergi/go-diff` (快照+diff+恢复)                           |
| `visits`     | visit+viewer.provider.ts (241)  | ~80      | SQL `UPDATE SET count = count + 1` + 日聚合                           |
| `feed`       | rss+sitemap.provider.ts (230)   | ~150     | 标准库 `encoding/xml`；RSS/Atom/Sitemap 生成 + 路由注册               |
| `site`       | meta/setting.provider.ts (526)  | ~50      | 站点配置单行读取                                                      |
| `devseed`    | — (新增)                        | ~30      | 开发环境假数据填充                                                    |
| **总计**     |                                 | **~840** | **(pb 覆盖 + 裁剪 ~4000 行不计)**                                     |

**对比原项目**:原 NestJS 5012 行 → Go 真实增量 **~600-1000 行**(pb 原生覆盖 ~2400 行 CRUD/auth/权限,裁剪 ~800 行 picgo/waline 托管/ISR/pipeline)。

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

Go 业务层**不通过中间绑定层暴露 JSVM API**。JSVM 钩子直接使用 pb 原生全局 API
(`$app`、`Record`、`onRecordAfterCreateSuccess`、`cronAdd` 等)，pb 的 jsvm 插件自动
将这些 API 注入每个 executor VM。

`pb_hooks/` 目录内容：

| 文件 | 说明 |
|------|------|
| `examples.pb.js` | 3-5 个学习示例钩子 |
| `system.pb.js` | 审计日志 + visits 聚合 cron |
| `lib/vanblog.d.ts` | pb + vanblog 类型声明 (TypeScript 姿态, IDE 补全) |
| `lib/vanblog-audit.js` | 审计日志公共模块, 通过 `require()` 在 system.pb.js 和 examples.pb.js 间共享 |

JSVM 钩子示例 (实际代码):

```javascript
// pb_hooks/system.pb.js
// 文章发布后记录审计
onRecordAfterCreateSuccess((e) => {
    const audit = require("./lib/vanblog-audit.js");
    audit.postAction("post.create", e);
}, "posts");

// 每日 visits 聚合
cronAdd("visits-aggregate", "0 2 * * *", () => {
    // 聚合昨天的访问数据
});
```

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

| 方案 | 否决原因 |
|------|----------|
| `wire` / `fx` DI 框架 | pb 自己 own 生命周期（Bootstrap → Migrate → Serve），DI 框架跟它打架。痛点是「副作用时序」不是「对象图装配」。 |
| runtime 包（Mode 枚举 + Bootstrap 函数） | 又一层抽象，命名空洞（`Bootstrap` / `Sync` 看不出业务意义）。 |
| 阶段接口（PhasePreServe / PhaseOnServe） | 本质还是主程序在做事，只是改写法。 |
| 命名约定 + 强制接口 | 「又臭又长」—— 一个文件 8 行 register 函数堆叠。 |

**所有 vanblog 自定义路由（来自各 Manager 的 OnServe）**：

| Manager | 路由 | Handler |
|---|---|---|
| `feed` | `GET /api/feed.xml` | `serveRSS` |
| `feed` | `GET /api/atom.xml` | `serveAtom` |
| `feed` | `GET /api/sitemap.xml` | `serveSitemap` |
| `article` | `GET /api/vanblog/timeline` | `handleTimelineEndpoint` |
| `article` | `GET /api/vanblog/search?q=` | `handleSearchEndpoint` |
| `article` | `GET /api/vanblog/posts/trash` | `handleTrashEndpoint` |
| `article` | `POST /api/vanblog/posts/{id}/restore` | `handleRestoreEndpoint` |
| `caddy` | `GET /api/hooks/caddy/ask` | `handleAskEndpoint` |
| `caddy` | `GET /api/vanblog/tls/status` | `handleTLSStatusEndpoint` |
| `migration` | `POST /api/vanblog/migrate/import` | `handleImport` |
| `migration` | `GET /api/vanblog/migrate/status` | `handleStatus` |

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

我们提供的 `pb_hooks/` 里:

- `examples.pb.js` — 官方示例 (给用户学习的,~5 个小钩子)
- `system.pb.js` — 审计日志 + visits 聚合 cron
- `lib/vanblog.d.ts` — pb + vanblog 类型声明 (TypeScript 姿态, IDE 补全)
- `lib/vanblog-audit.js` — 审计日志公共模块

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
    body: JSON.stringify({ text: "新文章发布: " + e.record.getString("title") }),
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

// 示例 3: 审计日志 (使用共享模块)
onRecordAfterUpdateSuccess((e) => {
  const audit = require("./lib/vanblog-audit.js");
  audit.postAction("post.update", e);
}, "posts");
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

**注意**:`vanblog.d.ts` 只声明类型接口，不声明 `vanblog.*` 全局变量 ——
Go 层没有注册任何 `vanblog` 命名空间的 JSVM 绑定。

---

## 6. Go vs JSVM 的功能分配表

| 功能             | Go 业务层                                  | JSVM 钩子                                   | 用户能否覆盖            |
| ---------------- | ------------------------------------------ | ------------------------------------------- | ----------------------- |
| 文章 CRUD        | pb 自动 API                                | `onRecordCreateRequest("posts")` 等         | ✅ 用户可加校验         |
| 文章查询 (复杂)  | `article.GetTimeline/Search/GetByPathname` | 不暴露                                      | ❌ (Go 统一)            |
| 草稿发布         | `article.Publish/Unpublish`                | 不暴露                                      | ❌                      |
| 文章回收站       | `article.ListTrash/Restore`                | 不暴露                                      | ❌                      |
| 图片上传         | pb FileField + `media` 驱动                | `onRecordCreateRequest("media")`            | ✅ 用户可加后处理       |
| 图片查重         | `media` MD5 去重                           | 不暴露                                      | ❌                      |
| S3 存储           | `media` S3 驱动                            | 不暴露                                      | ❌                      |
| 迁移工具         | `migration.Import`                         | 不暴露 (用户通过 Admin UI 触发)             | ❌                      |
| Caddy 路由       | `caddy` 客户端 + SSRF 校验                 | 不暴露                                      | ❌                      |
| Caddy HTTPS      | `caddy.OnDemandTLS`                        | 不暴露                                      | ❌                      |
| revisions 快照   | `revisions` 自动快照                       | 不暴露                                      | ❌                      |
| revisions 恢复   | `revisions` 恢复                           | 不暴露                                      | ❌                      |
| visits 计数      | `visits` 原子计数                          | 不暴露                                      | ❌                      |
| visits 聚合      | `visits` 每日聚合                          | `cronAdd` (system.pb.js)                    | ✅ 调度在 JSVM          |
| RSS/Atom/Sitemap | `feed` 生成 + 路由注册                     | 不暴露                                      | ❌                      |
| 审计日志         | —                                          | `vanblog-audit.js` + `system.pb.js`          | ✅ 用户可记自定义事件   |
| 自定义定时任务   | —                                          | `cronAdd("id", "...", () => { ... })`       | ✅                      |
| 自定义 API 端点  | —                                          | `routerAdd("GET", "/my-api", ...)`          | ✅                      |

**总结**:

- Go 业务层承担 **~17 个核心功能** (重运算/基础设施)
- JSVM 提供 **~5 个扩展点** (审计、定时、自定义路由、校验钩子)
- JSVM 钩子使用 pb 原生 API (`$app`、`Record`、`$http` 等)，不通过中间 `vanblog.*` 命名空间

---

## 7. 迁移工具的特殊处理

迁移工具是最重的逻辑 (50MB JSON + 批量事务 + 字段映射)。**必须在 Go 层**。

### Go 实现

```go
// internal/migration/migration.go
func (m *Manager) Import(jsonData string) (*MigrationResult, error) {
    var data LegacyBackup
    if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
        return nil, err
    }

    result := &MigrationResult{}
    err := m.app.RunInTransaction(func(txApp core.App) error {
        // 1. articles + drafts → posts (合并, oldId 偏移)
        for _, article := range data.Articles {
            if article.Deleted { continue } // skip soft-deleted
            post := mapArticleToPost(article, "published")
            txApp.Save(post)
        }
        for _, draft := range data.Drafts {
            if draft.Deleted { continue }
            post := mapDraftToPost(draft, "draft")
            txApp.Save(post)
        }

        // 2. tags (去重 + relation)
        // 3. meta → site (单行 JSON)
        // 4. static → media
        // 5. 不兼容数据 → 迁移档案 post
        return nil
    })
    return result, err
}
```

### 路由注册 (Go 层, 非 JSVM)

迁移端点通过 Go 代码直接注册到 pb Router, 不走 JSVM:

```go
// internal/migration/routes.go
func RegisterRoutes(app core.App) {
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        se.Router.POST("/api/vanblog/migrate/import", handleImport)
        se.Router.GET("/api/vanblog/migrate/status", handleStatus)
        return se.Next()
    })
}
```

---

## 8. 实现状态

### Go 业务层 (已完成)

| 模块              | 状态   | 说明                                                   |
| ----------------- | ------ | ------------------------------------------------------ |
| `pb_migrations`   | ✅ 完成 | 创建 collections + 软删除索引 + 访问规则               |
| `article`         | ✅ 完成 | 查询/发布/搜索/时间线/回收站 + Astro 缓存刷新          |
| `media`           | ✅ 完成 | 本地/S3 存储驱动 + MD5 查重                            |
| `migration`       | ✅ 完成 | JSON 导入 + 分批事务 + 路由注册                        |
| `caddy`           | ✅ 完成 | admin API 客户端 + SSRF 校验 + TLS 状态                |
| `revisions`       | ✅ 完成 | 快照 + diff + 恢复                                     |
| `visits`          | ✅ 完成 | 原子计数 + 每日聚合                                    |
| `feed`            | ✅ 完成 | RSS/Atom/Sitemap 生成 + 路由                           |
| `site`            | ✅ 完成 | 站点配置读取                                           |
| `devseed`         | ✅ 完成 | 开发环境种子数据                                       |

### JSVM 钩子 (已完成)

| 文件                        | 状态   | 说明                                         |
| --------------------------- | ------ | -------------------------------------------- |
| `pb_hooks/lib/vanblog.d.ts` | ✅ 完成 | pb + vanblog 类型声明 (IDE 补全)             |
| `pb_hooks/lib/vanblog-audit.js` | ✅ 完成 | 审计日志公共模块                             |
| `pb_hooks/system.pb.js`     | ✅ 完成 | 审计日志钩子 + visits 聚合 cron              |
| `pb_hooks/examples.pb.js`   | ✅ 完成 | 3-5 个学习示例                               |

### TypeScript SDK (已完成)

| 包            | 状态   | 说明                                          |
| ------------- | ------ | --------------------------------------------- |
| `sdk/`        | ✅ 完成 | 共享类型定义 (Post/Tag/Category/SiteConfig 等) |
| `sdk/client`  | ✅ 完成 | PocketBase 客户端封装 (Astro SSR 使用)         |

---

## 9. 与之前文档的关系

本文件是 **架构分层的最终决策**，修正了之前 schema-design.md §4 "pb_hooks 事件映射"的定位：

| 之前 (schema-design §4)             | 现在 (本文档)                                     |
| ----------------------------------- | ------------------------------------------------ |
| 全部功能用 pb_hooks 实现             | 核心用 Go 业务层，扩展用 JSVM                    |
| `OnRecordUpdateRequest` 写 revisions | Go hook 写 revisions                             |
| `routerAdd` 实现迁移端点             | Go 直接注册路由 `/api/vanblog/migrate/*`         |
| `$http.send` 调 Caddy                | Go `net/http` 调 Caddy                           |
| `$os.writeFile` 写 md_output         | 前端 Astro 处理 markdown 渲染                    |
| Go SDK + JSVM 绑定层                 | Go 业务层直挂 pb hook, 无中间绑定层              |

**修正原因**: 用户反馈"运算代码不应在 JSVM", 且 pb 官方 JSVM 定位是"用户自定义扩展"不是"核心业务"。
实际重构中 Go 业务包直接通过 `New(app)` 注册 pb hook, 不存在 `vanblog.*` JSVM 命名空间或中间绑定层。
