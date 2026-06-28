# 架构分层:Go SDK + JSVM 扩展点

> **依据**:[原项目 provider 代码统计](file:///Users/corn/Code/vanblog-upstream/packages/server/src/provider/)(5012 行 / 27 模块 / 131 端点)+ 用户反馈"运算代码不应在 JSVM"
>
> **核心原则**:
>
> - **Go 层承担所有重运算 / 复杂业务 / 基础设施**(编译进二进制,性能 + 类型安全)
> - **JSVM 只做用户侧扩展点**(小钩子,学习成本低,热更新)
> - **Go 封装 SDK,JSVM 调用 SDK**(不是 JSVM 直接干重活)
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
│  Astro 前端(prod SSG / dev server)                      │
│  - 调用 pb REST API(自动生成 + 自定义路由)              │
│  - 上传图片时做 WASM 水印/压缩                            │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼───────────────────────────────────┐
│  PocketBase(预编译 Go 二进制)                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  vanblog Go SDK(vault/internal/)                   │ │
│  │  - article: 查询构建 / 发布事务 / 字数统计           │ │
│  │  - media: 存储驱动(local/S3)/ 查重 / 缩略图        │ │
│  │  - migration: JSON 解析 / 批量事务 / 字段映射       │ │
│  │  - caddy: admin API 客户端 / SSRF 校验 / 路由翻译   │ │
│  │  - revisions: 快照 / diff(go-diff)                 │ │
│  │  - visits: 原子计数 / 聚合                          │ │
│  │  - markdown 渲染由前端 Astro(marked + DOMPurify)处理,Go 端无 markdown 包 │ │
│  │  - process: 子进程管理(waline / git sync)         │ │
│  │  - rss/sitemap: 生成器                              │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │ 注册到 JSVM                     │
│  ┌──────────────────────▼──────────────────────────────┐ │
│  │  JSVM 扩展点(pb_hooks/*.pb.js)                     │ │
│  │  - 用户自定义钩子(学习示例,~20 行/个)              │ │
│  │  - 调用 Go SDK 暴露的 API                           │ │
│  │  - 不承担核心业务逻辑                                │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Go SDK 详细设计

### 4.1 包结构

```
vault/
  main.go                         # pb bootstrap(~30 行)
  go.mod
  internal/
    article/
      query.go                   # 查询构建器(替代 article.provider.ts 980 行)
      publish.go                 # 草稿→发布事务
      search.go                  # 全文搜索
    media/
      driver.go                  # StorageDriver 接口
      local.go                   # 本地存储
      s3.go                      # S3 兼容(OSS/COS/R2/MinIO)
      dedup.go                   # MD5 查重
      thumb.go                   # 缩略图生成(pb FileField 内置 + 扩展)
    migration/
      import.go                  # JSON 解析 + 字段映射
      batch.go                   # 分批事务写入
      archive.go                 # 不兼容数据打包为迁移档案
    caddy/
      client.go                  # Caddy admin API 客户端(net/http)
      ssrf.go                    # SSRF 白名单校验
      translator.go              # site.routing DSL → caddy JSON
      config_builder.go          # BuildBootstrapConfig / BuildFullConfig(struct-based)
    revisions/
      snapshot.go                # 快照写入
      diff.go                    # go-diff 集成
      restore.go                 # 恢复操作
    visits/
      counter.go                 # 原子计数(SQL UPDATE)
      aggregate.go               # 每日聚合
    process/
      supervisor.go              # 子进程管理(waline / git)
    rss/
      generator.go               # RSS/Atom 生成
    sitemap/
      generator.go               # Sitemap 生成
    hooks/                       # ★ JSVM 绑定层(把 Go SDK 暴露给 JSVM)
      bind_article.go
      bind_media.go
      bind_migration.go
      bind_caddy.go
      bind_revisions.go
      bind_visits.go
  pb_migrations/                 # pb schema 初始化(Go)
    001_init_collections.go
    002_default_site.go
  pb_hooks/                      # ★ JSVM 扩展点(用户侧)
    example_hooks.pb.js          # 官方示例(给用户学习的)
    lib/
      vanblog.js                 # Go SDK 的 JS 绑定声明(d.ts 风格)
```

### 4.2 Go SDK 模块职责

| 模块               | 对应原项目                      | 增量估计   | 关键 Go 库                                                                 |
| ------------------ | ------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `article`          | article.provider.ts(980)        | ~120       | pb `filter`/`sort` 覆盖查询;增量=字数统计+时间线聚合+搜索                  |
| `media`            | static.provider.ts(560)         | ~100       | pb FileField + thumbs 内置;增量=MD5 去重+上传 pipeline(水印/WebP 已移前端) |
| `migration`        | backup.controller.ts(137)       | ~150       | `encoding/json` + `app.RunInTransaction` 事务(大 JSON 在 Go 里无压力)      |
| `caddy`            | caddy.provider.ts(136)          | ~80        | `net/http` + `net/url`(SSRF)                                               |
| `revisions`        | —(新增)                         | ~80        | `github.com/sergi/go-diff`(快照+diff+恢复)                                 |
| `visits`           | visit+viewer.provider.ts(241)   | ~80        | SQL `UPDATE SET count = count + 1` + 日聚合                                |
| `markdown`         | markdown.provider.ts(47)        | ~~已废弃~~ | 前端 marked + DOMPurify 替代,Go 端无 markdown 包                           |
| `process`          | waline+website.provider.ts(298) | ~0(裁剪)   | 子进程托管改为外部容器                                                     |
| `rss`              | rss.provider.ts(132)            | ~100       | 标准库 `encoding/xml`                                                      |
| `sitemap`          | sitemap.provider.ts(98)         | ~50        | 标准库 `encoding/xml`                                                      |
| `hooks`(JSVM 绑定) | —(新增)                         | ~150       | goja 绑定注册                                                              |
| **总计**           |                                 | **~940**   | **(pb 覆盖 + 裁剪 ~3200 行不计)**                                          |

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

### 4.3 JSVM 绑定层(hooks/ 包)

这是 **Go SDK 与 JSVM 的桥梁**。每个 Go 模块注册 JSVM 可调用的函数:

```go
// internal/hooks/bind_caddy.go
func BindCaddy(vm *goja.Runtime, app *pocketbase.PocketBase) {
    vm.Set("vanblog", map[string]interface{}{
        "caddy": map[string]interface{}{
            // 暴露给 JSVM 的 API
            "addRoute": func(rule jsRule) error {
                // Go 层做 SSRF 校验 + 翻译 + 调 caddy admin api
                return caddy.AddRoute(rule)
            },
            "removeRoute": func(id string) error {
                return caddy.RemoveRoute(id)
            },
            "getRoutes": func() []jsRule {
                return caddy.GetRoutes()
            },
        },
        "migration": map[string]interface{}{
            "import": func(jsonData string, opts jsOpts) jsResult {
                return migration.Import(jsonData, opts)
            },
        },
        "article": map[string]interface{}{
            "publish": func(draftId string) error { ... },
            "search": func(query string) []article.Result { ... },
        },
        // ... 其他模块
    })
}
```

**JSVM 侧调用**:

```javascript
// pb_hooks/user_custom.pb.js(用户写的)
onRecordUpdateRequest((e) => {
  const post = e.record;
  // 调用 Go SDK 的能力(不是自己干重活)
  vanblog.caddy.addRoute({
    type: "redirect",
    from: "/old/" + post.get("pathname"),
    to: "/" + post.get("pathname"),
  });
}, "posts");
```

---

## 5. JSVM 扩展点设计

### 5.1 定位

**JSVM 是"用户自定义扩展",不是"核心业务"**。

我们提供的 `pb_hooks/` 里:

- `example_hooks.pb.js` — 官方示例(给用户学习的,~5 个小钩子)
- `lib/vanblog.js` — Go SDK 的 TypeScript 声明(d.ts 风格,用于 IDE 补全)

**不提供的**(核心业务在 Go 里):

- 迁移工具实现(Go)
- Caddy 集成实现(Go)
- 路由翻译实现(Go)
- revisions 实现(Go)

### 5.2 官方示例钩子(pb_hooks/example_hooks.pb.js)

```javascript
// 示例 1: 文章发布后发 webhook
onRecordUpdateRequest((e) => {
  if (e.record.get("status") !== "published") return;
  vanblog.http.send({
    method: "POST",
    url: "https://hooks.slack.com/...",
    body: JSON.stringify({ text: "新文章发布: " + e.record.get("title") }),
  });
}, "posts");

// 示例 2: 特定分类的文章自动加水印标记
onRecordCreateRequest((e) => {
  if (e.record.get("category") === "photography") {
    e.record.set("tags", [...e.record.get("tags"), "watermark-required"]);
  }
}, "posts");

// 示例 3: 每日统计推送到外部(用 Go SDK 的 visits 聚合)
cronAdd("daily-stats", "0 8 * * *", () => {
  const stats = vanblog.visits.getDailySummary();
  vanblog.http.send({
    method: "POST",
    url: "https://api.umami.is/api/send",
    body: JSON.stringify(stats),
  });
});
```

**特征**:每个钩子 < 20 行,调 Go SDK,不做复杂逻辑。

### 5.3 Go SDK 的 JSVM 声明(pb_hooks/lib/vanblog.js)

```typescript
// 这是 TypeScript 声明文件,用于 IDE 补全(不是实际运行的代码)
// Go 层通过 goja.Set("vanblog", ...) 注册实际实现

declare const vanblog: {
  // HTTP 客户端(封装好的,带超时)
  http: {
    send(opts: {
      method: string;
      url: string;
      headers?: object;
      body?: string;
    }): { statusCode: number; body: string };
  };

  // Caddy 路由管理(SSRF 校验在 Go 层)
  caddy: {
    addRoute(rule: {
      id: string;
      type: string;
      from: string;
      to: string;
    }): void;
    removeRoute(id: string): void;
    getRoutes(): Array<{ id: string; type: string; from: string; to: string }>;
  };

  // 文章操作(复杂查询在 Go 层)
  article: {
    publish(draftId: string): void;
    search(
      query: string,
      opts?: { limit?: number }
    ): Array<{ id: string; title: string }>;
    getWordCount(postId: string): number;
  };

  // 访问统计(原子操作在 Go 层)
  visits: {
    increment(path: string): void;
    getDailySummary(date?: string): { views: number; uniques: number };
  };

  // 迁移(Go 层处理大 JSON + 事务)
  migration: {
    import(
      jsonData: string,
      opts?: { dryRun?: boolean }
    ): { success: number; failed: number; errors: string[] };
  };

  // 工具
  util: {
    slugify(text: string): string;
    markdownToHtml(md: string): string;
  };
};
```

---

## 6. Go vs JSVM 的功能分配表

| 功能               | Go SDK                            | JSVM 扩展点                           | 用户能否覆盖            |
| ------------------ | --------------------------------- | ------------------------------------- | ----------------------- |
| 文章 CRUD          | pb 自动 API                       | `onRecordCreateRequest("posts")` 等   | ✅ 用户可加校验         |
| 文章查询(复杂)     | `article.Search()`                | 不暴露                                | ❌(Go 统一)             |
| 草稿发布事务       | `article.Publish()`               | 不暴露                                | ❌                      |
| 图片上传           | pb FileField + `media.SaveFile()` | `onRecordCreateRequest("media")`      | ✅ 用户可加后处理       |
| 图片查重           | `media.Dedup()`                   | 不暴露                                | ❌                      |
| S3 存储            | `media.S3Driver`                  | 不暴露                                | ❌                      |
| 迁移工具           | `migration.Import()`              | 不暴露(用户通过 Admin UI 触发)        | ❌                      |
| 不兼容数据归档     | `migration.Archive()`             | 不暴露                                | ❌                      |
| Caddy 路由         | `caddy.AddRoute()` + SSRF 校验    | `vanblog.caddy.addRoute()`            | ✅ 用户可在钩子里加路由 |
| Caddy HTTPS        | `caddy.OnDemandTLS()`             | 不暴露                                | ❌                      |
| revisions 快照     | `revisions.Snapshot()`            | 不暴露                                | ❌                      |
| revisions diff     | `revisions.Diff()`(go-diff)       | 不暴露                                | ❌                      |
| revisions 恢复     | `revisions.Restore()`             | 不暴露                                | ❌                      |
| visits 计数        | `visits.Increment()`(原子)        | 不暴露                                | ❌                      |
| visits 聚合        | `visits.AggregateDaily()`(cron)   | 不暴露                                | ❌                      |
| Markdown 渲染      | ~~`markdown.Render()`~~(已废弃)   | 前端 marked + DOMPurify               | ❌(前端处理)            |
| RSS 生成           | `rss.Generate()`                  | 不暴露                                | ❌                      |
| Sitemap 生成       | `sitemap.Generate()`              | 不暴露                                | ❌                      |
| 子进程管理(waline) | `process.Supervisor`              | 不暴露                                | ❌                      |
| git sync           | `process.GitSync()`(cron)         | 不暴露                                | ❌                      |
| 审计日志           | `audits.Log()`(Go hook)           | `vanblog.audits.log()`                | ✅ 用户可记自定义事件   |
| 自定义定时任务     | —                                 | `cronAdd("id", "...", () => { ... })` | ✅                      |
| 自定义 API 端点    | —                                 | `routerAdd("GET", "/my-api", ...)`    | ✅                      |

**总结**:

- Go SDK 承担 **~20 个核心功能**(重运算)
- JSVM 提供 **~6 个扩展点**(用户自定义)
- 用户通过 `vanblog.*` 调用 Go SDK 能力

---

## 7. 迁移工具的特殊处理

迁移工具是最重的逻辑(50MB JSON + 批量事务 + 字段映射)。**必须在 Go 层**。

### Go 实现

```go
// internal/migration/import.go
func Import(jsonData string, opts Options) Result {
    var data LegacyBackup
    if err := json.Unmarshal([]byte(jsonData), &data); err != nil {
        return Result{Error: err}
    }

    return app.RunInTransaction(func(txApp core.App) error {
        // 1. articles + drafts → posts(合并,oldId 偏移)
        for _, article := range data.Articles {
            post := mapArticleToPost(article, "published")
            txApp.Save(post)
        }
        for _, draft := range data.Drafts {
            post := mapDraftToPost(draft, "draft")
            txApp.Save(post)
        }

        // 2. tags(去重 + relation)
        tags := extractTags(data.Articles, data.Drafts)
        for _, tag := range tags {
            txApp.Save(tag)
        }

        // 3. meta → site(单行 JSON)
        site := mapMetaToSite(data.Meta)
        txApp.Save(site)

        // 4. static → media(不下载文件,只存元数据)
        for _, s := range data.Static {
            media := mapStaticToMedia(s)
            txApp.Save(media)
        }

        // 5. 不兼容数据 → 迁移档案 post
        archive := buildMigrationArchive(data)
        txApp.Save(archive)

        return nil
    })
}
```

**暴露给 JSVM / Admin UI**:

```go
// internal/hooks/bind_migration.go
vm.Set("vanblog.migration.import", func(jsonStr string) map[string]interface{} {
    result := migration.Import(jsonStr, migration.DefaultOptions)
    return map[string]interface{}{
        "success": result.Success,
        "failed":  result.Failed,
        "errors":  result.Errors,
    }
})
```

**JSVM 触发**(只是入口,不做逻辑):

```javascript
// pb_hooks/migration.pb.js(我们的,不是用户的)
routerAdd(
  "POST",
  "/api/migrate/import",
  (c) => {
    const json = c.request.body; // pb 自动处理 body
    const result = vanblog.migration.import(json);
    return c.json(200, result);
  },
  $apis.requireAuth()
);
```

---

## 8. 实现优先级

### v0.1 MVP(Go SDK 核心)

| 模块                                    | 优先级 | 理由                   |
| --------------------------------------- | ------ | ---------------------- |
| `pb_migrations/001_init_collections.go` | P0     | 创建 10 个 collections |
| `pb_migrations/002_default_site.go`     | P0     | 插入 site 默认行       |
| `article` 查询构建                      | P0     | 前台需要列表/搜索      |
| `media` local 驱动                      | P0     | 图床上传               |
| `markdown` 渲染                         | P0     | 前台显示               |
| `caddy` 客户端 + SSRF                   | P1     | HTTPS + 路由           |
| `revisions` 快照                        | P1     | 编辑历史               |
| `migration` 导入                        | P1     | 老用户迁移             |
| `rss` + `sitemap`                       | P2     | SEO                    |
| `visits` 计数                           | P2     | 统计                   |
| `process` 管理(waline)                  | P3     | 评论外挂               |
| `media` S3 驱动                         | P3     | 云存储                 |

### JSVM 扩展(随 Go SDK 一起)

| 文件                           | 优先级 | 状态      | 说明                                            |
| ------------------------------ | ------ | --------- | ----------------------------------------------- |
| `pb_hooks/lib/vanblog.js`      | P0     | ✅ 完成   | TypeScript 声明(vanblog schema 类型)            |
| `pb_hooks/examples.pb.js`      | P1     | ✅ 完成   | 3-5 个示例                                      |
| `pb_hooks/system.pb.js`        | P1     | ✅ 完成   | 审计日志 + visits 聚合 cron                     |
| ~~`pb_hooks/migration.pb.js`~~ | P1     | ❌ 不需要 | Go hooks 直接注册 `/api/vanblog/migrate/import` |
| ~~`pb_hooks/caddy.pb.js`~~     | P1     | ❌ 不需要 | Go hooks 直接注册 `/api/hooks/caddy/ask`        |

---

## 9. 与之前文档的关系

本文件是 **Go vs JSVM 分层的最终决策**,修正了之前 schema-design.md §4 "pb_hooks 事件映射"的定位:

| 之前(schema-design §4)               | 现在(本文档)                                     |
| ------------------------------------ | ------------------------------------------------ |
| 全部功能用 pb_hooks 实现             | 核心用 Go SDK,扩展用 JSVM                        |
| `OnRecordUpdateRequest` 写 revisions | Go hook 写 revisions(JSVM 可覆盖)                |
| `routerAdd` 实现迁移端点             | Go 实现迁移,JSVM 只是入口                        |
| `$http.send` 调 Caddy                | Go `net/http` 调 Caddy,JSVM 调 `vanblog.caddy.*` |
| `$os.writeFile` 写 md_output         | Go `os.WriteFile` 写 md_output                   |

**修正原因**:用户反馈"运算代码不应在 JSVM",且 pb 官方 JSVM 定位是"用户自定义扩展"不是"核心业务"。
