# Vanblog 插件开发指南

> **状态说明**: 本文主要记录 legacy plugin 兼容层，适用于仍在迁移中的 Moments 等历史功能。新的扩展方向是 Pack：源码由 `vanblog pack` 与 dev 镜像管理，构建生成 VanBlog 内部 artifact，prod runtime 只验证、加载或跳过并 warning，不安装依赖、不构建源码。新功能优先参考 `docs/future-pack-architecture.md` 的 Pack source / artifact / runtime 分层。

## 概述

Vanblog legacy 插件系统允许在不修改核心源码的前提下扩展功能。插件使用 **纯前端模板 + JSVM 后端** 的架构，无需 Astro 编译、Tailwind 重建或 Go 代码重新编译。

> **新模式(推荐)**:从 moments/bookmarks 插件重构起,插件作者只需写 ~20 行声明式代码。核心思路是三件事——Collection 由 Go migration 创建、CRUD 走 PocketBase 原生 API、页面路由由 `$vanblog.servePlugin(name)` 一行注册。本文档以此模式为主,老模式(手写 CRUD 路由 + 页面渲染路由)在相关章节以"已过时"标注保留,仅作历史参考。

### 插件架构(新模式)

| 层           | 载体                                              | 用途                                                 |
| ------------ | ------------------------------------------------- | ---------------------------------------------------- |
| **数据层**   | Go migration(`vault/pb_migrations/*.go`)          | 编译时创建 PocketBase collection + rules + fields    |
| **API 层**   | PocketBase 原生 `/api/collections/{name}/records` | 自动提供 list/get/create/update/delete,支持分页/过滤 |
| **业务钩子** | JSVM `onRecordBeforeCreateRequest` 等             | 自动填充字段(如 author)、审计、校验等可选逻辑        |
| **UI 层**    | `$vanblog.servePlugin(name)` + HTML 模板          | 一行注册 public/admin/static 三条路由 + nav items    |

> 老模式下数据层用 `onBootstrap` 运行时建表、API 层用 `routerAdd` 手写 CRUD、UI 层手写三条 `routerAdd`。新模式的代码量约为老模式的 1/10。当前 Moments 的业务 hook 已收敛为 core hook `vault/pb_hooks/moments.pb.js`，`plugins/moments/` 仅保留 manifest/frontend 兼容资源。

## 插件结构

一个完整的插件由以下文件组成：

```
plugins/
└── {name}/
    ├── manifest.json           # 插件元数据（名称、标题、路由、脚本/样式等）
    ├── {name}.pb.js            # JSVM 钩子（servePlugin + 可选业务 hook）
    ├── frontend/
    │   ├── index.html          # 公开页面模板
    │   └── admin.html          # 管理后台模板
    ├── static/                 # 静态资源（CSS、JS、图片等）
    └── README.md               # 安装和使用文档
```

> 新模式下,collection 由 Go migration 创建(`vault/pb_migrations/{timestamp}_create_{name}_collection.go`),不在插件目录内。CRUD 不需要手写,前端直接调用 `/api/collections/{name}/records`。`{name}.pb.js` 通常只有 `servePlugin` 一行 + 若干可选的 `onRecord*` 钩子。

### 安装方式

插件通过 **symlink** 注册到 PocketBase JSVM：

```bash
ln -s ../../plugins/{name}/{name}.pb.js vault/pb_hooks/{name}.pb.js
```

重启容器后，JSVM 自动加载 `.pb.js` 文件。新模式下:`$vanblog.servePlugin(name)` 注册页面路由 + nav,Go migration 创建 collection(随 vanblog 二进制分发,无需手动执行),PocketBase 自动暴露 CRUD API。

### 与旧架构的区别

- **不再使用 `.astro` 文件** — 页面由 `$vanblog` Go helpers 在服务端渲染普通 HTML 模板
- **不再需要 Astro 编译** — 无需 `npx astro build`，无需 Tailwind 重建
- **不再需要复制页面到 `app/src/pages/`** — 所有文件保持在 `plugins/{name}/` 目录内
- **前端模板使用标准 HTML** — 在 `frontend/index.html` 和 `frontend/admin.html` 中编写

## 扩展点

### `pb_hooks/*.pb.js` — JSVM 钩子

放到 `pb_hooks/` 目录下（或通过 symlink 从 `plugins/` 链接）的 `.pb.js` 文件会被 PocketBase JSVM 自动加载。可用的全局钩子:

| 钩子                                      | 时机              | 用途                                           |
| ----------------------------------------- | ----------------- | ---------------------------------------------- |
| `onRecordBeforeCreateRequest(fn, "col")`  | 记录创建前        | 自动填充字段(如 author)、校验(新模式常用)      |
| `onRecordAfterCreateSuccess(fn, "col")`   | 记录创建成功后    | 审计、通知、联动(新模式常用)                   |
| `onRecordAfterDeleteSuccess(fn, "col")`   | 记录删除成功后    | 审计、级联清理(新模式常用)                     |
| `onRecordBeforeUpdateRequest(fn, "col")`  | 记录更新前        | 字段变更校验                                   |
| `onRecordAfterUpdateSuccess(fn, "col")`   | 记录更新成功后    | 审计                                           |
| `onBootstrap(function(e) { ... })`        | PocketBase 启动后 | 老模式 collection 创建、系统初始化(新模式不用) |
| `routerAdd("GET", "/path", handler)`      | 启动时注册        | 自定义 API 路由(仅特殊业务,见"路由注册"章节)   |
| `routerUse("GET", "/path/*", [mw1, mw2])` | 启动时注册        | 带中间件的路由                                 |
| `cronAdd("*/5 * * * *", handler)`         | 启动时注册        | 定时任务                                       |

> 新模式下,业务逻辑主要用 `onRecord*` 钩子(自动填充字段、审计、校验),不需要 `onBootstrap` 建表,也不需要 `routerAdd` 手写 CRUD。

### `$vanblog` Go Helpers — 页面渲染与插件注册

`.pb.js` 文件中通过全局 `$vanblog` 对象调用 Go 侧注册的辅助函数(`vault/internal/plugins/plugins.go::Bind()`):

| Helper                                              | 用途                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| **`$vanblog.servePlugin(name)`**                    | **一行注册 public/admin/static 三条路由 + nav items(推荐)** |
| `$vanblog.addNavItems(name)`                        | 将插件注册到导航菜单(servePlugin 已自动调用)                |
| `$vanblog.getNavItems()`                            | 读取已注册的导航项(供 `/_plugin/nav` 聚合端点使用)          |
| `$vanblog.readManifest(name)`                       | 读取 `plugins/{name}/manifest.json`                         |
| `$vanblog.buildPageData(manifest, userId)`          | 构建页面渲染数据(包含用户信息、站点配置等)                  |
| `$vanblog.renderTemplate(name, templatePath, data)` | 渲染 `plugins/{name}/{templatePath}` 的 HTML 模板           |
| `$vanblog.serveStatic(name)`                        | 返回 `plugins/{name}/frontend/` 的静态文件处理器            |
| `$vanblog.readFile(path)`                           | 读取任意文件内容(便捷工具函数)                              |

> `$vanblog.servePlugin(name)` 在 JSVM 加载阶段捕获插件名,在 `OnServe` 时一次性注册:`GET /_plugin/{name}/render`(public)、`GET /_plugin/{name}/admin`(admin,带 auth guard)、`GET /plugins/{name}/{path...}`(静态资源),并调用 `addNavItems`。替代了老模式中 ~30 行手写的三条 `routerAdd`。

## Collection 创建

### 推荐做法:Go migration(新模式)

Collection 由 Go migration 在编译时创建,随 vanblog 二进制分发。参考 `vault/pb_migrations/1783000000_create_moments_collection.go`(简化版):

```go
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// Idempotent: skip if the plugin was previously installed.
		if existing, err := db.FindCollectionByNameOrId("moments"); err == nil && existing != nil {
			return nil
		}

		usersCol, err := db.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		col := core.NewCollection(core.CollectionTypeBase, "moments")
		col.Fields.Add(&core.TextField{Name: "content", Required: true, Max: 500})
		col.Fields.Add(&core.RelationField{Name: "author", CollectionId: usersCol.Id, MaxSelect: 1, Required: true})
		col.Fields.Add(&core.BoolField{Name: "visible"})
		col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		col.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})

		// 权限规则直接设在 collection 上
		col.ListRule   = strPtr(`visible = true || @request.auth.id != ""`)
		col.ViewRule   = strPtr(`visible = true || @request.auth.id != ""`)
		col.CreateRule = strPtr(`@request.auth.id != ""`)
		col.UpdateRule = strPtr(`@request.auth.id != "" && (@request.auth.id = author || @request.auth.role = "admin")`)
		col.DeleteRule = strPtr(`@request.auth.id != "" && (@request.auth.id = author || @request.auth.role = "admin")`)

		return db.Save(col)
	}, func(db core.App) error {
		// Down: remove the collection. Data is lost — only run on explicit plugin uninstall.
		if col, err := db.FindCollectionByNameOrId("moments"); err == nil && col != nil {
			return db.Delete(col)
		}
		return nil
	})
}
```

**关键点:**

- `m.Register(up, down)` 提供 up/down 迁移;down 在插件卸载时删除 collection(数据丢失,仅在显式卸载时执行)
- 幂等检查:`FindCollectionByNameOrId` 失败即视为未安装,自动创建
- `core.NewCollection(core.CollectionTypeBase, "moments")` 创建普通表(`CollectionTypeAuth` 是用户表)
- 字段用 `col.Fields.Add(&core.TextField{...})` 等强类型 API;PocketBase 自动暴露 `/api/collections/moments/records`
- **rules 直接设在 collection 上**:`ListRule`/`ViewRule`/`CreateRule`/`UpdateRule`/`DeleteRule` 用 PocketBase 访问控制表达式控制 CRUD 权限,前端无需手写认证逻辑
- `AutodateField` 字段由 PocketBase 自动维护,无需手动赋值

> migration 的命名约定:`{timestamp}_create_{collection}_collection.go`,放在 `vault/pb_migrations/`。PocketBase 启动时按文件名时间戳顺序执行,已执行过的不会重复跑(由 pb 内部迁移表跟踪)。

### Fallback:onBootstrap(老模式,不推荐)

> **已过时,仅作历史参考**。内置插件已全部迁移到 Go migration。第三方插件如果无法发布 Go 代码,仍可用 `onBootstrap` 在 JSVM 运行时建表,但要注意 PocketBase 启动阶段的时序问题(pb 0.39.5 上 `onBootstrap` 创建 collection 有时序竞态,这是内置插件迁移到 Go migration 的主因)。

<details>
<summary>老模式 onBootstrap 代码(点击展开)</summary>

在 `onBootstrap` 中通过 JSVM API 创建 PocketBase collection。**必须是 idempotent 的** —— 每次启动先检查是否已存在:

```javascript
onBootstrap(function (e) {
  // 幂等检查
  try {
    var existing = $app.findCollectionByNameOrId("moments");
    if (existing) {
      console.log("[moments] Collection already exists, skipping creation.");
      return;
    }
  } catch (_) {
    // Not found — create it.
  }

  // 查询预置 collection 的 ID（不同 pb 实例 ID 不同）
  var usersCol = $app.findCollectionByNameOrId("users");

  var collection = new Collection({
    type: "base", // "base" 普通表, "auth" 用户表
    name: "moments", // collection 名称（将在 /api/collections/moments 暴露）
    listRule: "visible = true",
    viewRule: "visible = true",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && @request.auth.id = author",
    deleteRule:
      "@request.auth.id != '' && (@request.auth.id = author || @request.auth.role = 'admin')",
    fields: [
      { name: "content", type: "text", required: true, max: 500 },
      {
        name: "author",
        type: "relation",
        collectionId: usersCol.id,
        maxSelect: 1,
        required: true,
      },
      { name: "visible", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });

  $app.save(collection);
  console.log("[moments] Collection created successfully.");
});
```

老模式关键点:用 `try/catch` 做幂等检查;`collectionId` 需要从已有 collection 动态获取(不能硬编码);`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule` 使用 PocketBase 访问控制表达式;`autodate` 字段由 PocketBase 自动维护。

</details>

## 路由注册(API 端点)

### 99% 的情况:你不需要写 API 路由

新模式下,只要 collection 由 Go migration 创建,PocketBase 就会自动暴露完整的 CRUD API,无需手写任何 `routerAdd`。前端直接调用原生端点:

| 操作       | 端点                                          | 说明                                         |
| ---------- | --------------------------------------------- | -------------------------------------------- |
| 列表(分页) | `GET /api/collections/{name}/records`         | 支持 `?page=&perPage=&filter=&sort=&expand=` |
| 单条获取   | `GET /api/collections/{name}/records/{id}`    |                                              |
| 创建       | `POST /api/collections/{name}/records`        | 权限由 collection 的 `createRule` 控制       |
| 更新       | `PATCH /api/collections/{name}/records/{id}`  | 权限由 `updateRule` 控制                     |
| 删除       | `DELETE /api/collections/{name}/records/{id}` | 权限由 `deleteRule` 控制                     |

**权限**:由 migration 里设在 collection 上的 `listRule`/`createRule`/`updateRule`/`deleteRule` 自动校验,前端和插件代码都不需要手写认证/授权逻辑。

**关联展开**:列表请求加 `?expand=author`,PocketBase 自动 join relation 字段,返回的 `item.expand.author` 即关联的 users 记录。

**自动填充字段**:用 `onRecordBeforeCreateRequest` 钩子填充,前端 create body 只需传业务字段:

```javascript
// 前端 POST 时只需 { content, visible },author 由钩子自动填
onRecordBeforeCreateRequest(function (e) {
  e.record.set("author", e.auth.id);
}, "moments");
```

**前端调用范例**(摘自 `plugins/moments/frontend/index.html` 和 `admin.html`):

```javascript
// public 列表(只看 visible)
const url =
  `/api/collections/moments/records?page=${page}&perPage=20` +
  `&filter=${encodeURIComponent("visible=true")}&expand=author`;
const res = await fetch(url);

// admin 我的列表(userId 由 Go template {{.User.id}} 注入)
const url =
  `/api/collections/moments/records?filter=` +
  encodeURIComponent(`author="${userId}"`) +
  `&expand=author`;

// create(author 由钩子自动填)
await fetch("/api/collections/moments/records", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content, visible: true }),
});

// delete(由 deleteRule 自动校验权限)
await fetch(`/api/collections/moments/records/${id}`, { method: "DELETE" });
```

### 何时需要自定义路由

只有以下情况才用 `routerAdd`:

- **webhook 转发**:如文章发布后通知外部服务
- **自定义计算字段**:需要跨表聚合或复杂计算(如时间线、搜索)
- **外部 API 集成**:如代理第三方服务、接收外部回调
- **批量操作**:单次请求处理多条记录的特殊业务

**普通的增删改查、分页、过滤、排序、关联展开,都不需要写路由。**

自定义路由示例(webhook 转发):

```javascript
routerAdd("POST", "/api/moments/webhook/notify", function (e) {
  // 这里可以加自定义业务逻辑,然后转发到外部
  $http.send({
    method: "POST",
    url: "https://hooks.slack.com/services/...",
    body: JSON.stringify({ text: "新说说发布" }),
  });
  return e.json(200, { ok: true });
});
```

> 自定义路由的 Handler 签名:`function(e)`,其中 `e` 是 `core.RequestEvent`。

### 老模式手写 CRUD(已过时,仅作历史参考)

> **已过时**。下面的手写 list/create/delete 路由在新模式中完全不需要——PocketBase 原生 API 已自动提供。保留此节仅作历史参考,展示老模式为什么会膨胀到 200+ 行。

<details>
<summary>老模式手写 CRUD 路由(点击展开)</summary>

**公开列表接口**(老模式):

```javascript
routerAdd("GET", "/api/moments/list", function (e) {
  try {
    // 手动解析查询参数（JSVM 没有内置 query parser）
    var page = parseInt(getQuery(e, "page") || "1");
    var perPage = parseInt(getQuery(e, "perPage") || "20");
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(perPage) || perPage < 1) perPage = 20;

    var totalItems = $app.countRecords(
      "moments",
      $dbx.hashExp({ visible: true })
    );
    var records = $app.findRecordsByFilter(
      "moments",
      "visible = true",
      "-created",
      perPage,
      (page - 1) * perPage
    );

    var items = records.map(function (rec) {
      return {
        id: rec.id,
        content: rec.getString("content"),
        visible: rec.getBool("visible"),
        created: rec.getString("created"),
        updated: rec.getString("updated"),
      };
    });

    return e.json(200, {
      items: items,
      page: page,
      perPage: perPage,
      totalItems: totalItems,
      totalPages: Math.ceil(totalItems / perPage),
    });
  } catch (err) {
    return e.json(500, { error: "Failed to list: " + (err.message || err) });
  }
});
```

**创建接口**(老模式,需手写认证 + 解析 + 校验):

```javascript
routerAdd("POST", "/api/moments/create", function (e) {
  try {
    if (!e.auth) return e.json(401, { error: "Authentication required" });
    var body = JSON.parse(toString(e.request.body) || "{}");
    var content = (body.content || "").trim();
    if (!content) return e.json(400, { error: "Content is required" });
    if (content.length > 500) return e.json(400, { error: "Content too long" });

    var collection = $app.findCollectionByNameOrId("moments");
    var record = new Record(collection);
    record.set("content", content);
    record.set("author", e.auth.id);
    record.set("visible", true);
    $app.save(record);
    return e.json(200, { id: record.id, content: record.getString("content") });
  } catch (err) {
    return e.json(500, { error: "Failed to create: " + (err.message || err) });
  }
});
```

**删除接口**(老模式,需手写授权):

```javascript
routerAdd("DELETE", "/api/moments/{id}", function (e) {
  try {
    if (!e.auth) return e.json(401, { error: "Authentication required" });
    var momentId = e.request.pathValue("id");
    var record = $app.findRecordById("moments", momentId); // 404 if not found
    var isAuthor = record.getString("author") === e.auth.id;
    var isAdmin = (e.auth.getString("role") || "") === "admin";
    if (!isAuthor && !isAdmin) return e.json(403, { error: "Not authorized" });
    $app.delete(record);
    return e.json(200, { success: true });
  } catch (err) {
    return e.json(500, { error: "Failed to delete: " + (err.message || err) });
  }
});
```

老模式手写 CRUD 的常用模式(仅供参考,新模式中由 pb 原生 API 替代):

| 操作     | 代码                                                         |
| -------- | ------------------------------------------------------------ |
| 认证检查 | `if (!e.auth) return e.json(401, {...})`                     |
| 查询参数 | `getQuery(e, "key")` 手动解析 `rawQuery`                     |
| 请求体   | `JSON.parse(toString(e.request.body) \|\| "{}")`             |
| 路径参数 | `e.request.pathValue("id")`                                  |
| 分页     | `$app.findRecordsByFilter(col, filter, sort, limit, offset)` |
| 关联查询 | `$app.findRecordById("users", rec.getString("author"))`      |
| 计数     | `$app.countRecords(col, $dbx.hashExp({...}))`                |

</details>

## 页面渲染

### 推荐做法:`servePlugin` 一行注册(新模式)

新模式下,页面渲染路由(public + admin + static)和 nav items 全部由 `$vanblog.servePlugin(name)` 一行注册:

```javascript
$vanblog.servePlugin("moments");
```

这一行在 `OnServe` 时自动注册三条路由:

| 路由                            | 说明                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `GET /_plugin/{name}/render`    | public 页面,渲染 `frontend/index.html`               |
| `GET /_plugin/{name}/admin`     | admin 页面(带 auth guard),渲染 `frontend/admin.html` |
| `GET /plugins/{name}/{path...}` | 静态资源(`frontend/` 目录)                           |

同时自动调用 `addNavItems(name)` 注册导航菜单。插件作者不需要手写任何 `routerAdd`。

**对比**:老模式需要手写 ~30 行(三个 handler + manifest 读取 + pageData 构建 + 模板渲染 + auth guard + JSON envelope),新模式一行。

> 实现见 `vault/internal/plugins/plugins.go::New()` 的 `OnServe` 回调(捕获 servePlugin 注册的插件名后,在 router 就绪时挂载三条路由 + nav)。

### 前端模板

模板文件是标准 HTML,放在 `plugins/{name}/frontend/` 下:

- `frontend/index.html` — 公开页面模板(public 路由渲染)
- `frontend/admin.html` — 管理后台模板(admin 路由渲染)

模板由 Go 的 template registry 渲染(`vault/internal/plugins/plugins.go::renderTemplateGo`),可以访问 `buildPageData` 返回的数据:

- `{{.Title}}` — 插件标题
- `{{.SiteName}}` — 站点名(从 `site` collection 读取)
- `{{.User.id}}` / `{{.User.username}}` / `{{.User.nickname}}` — 当前登录用户(admin 页面有,public 页面可能为空)

模板中通过 `manifest.json` 的 `scripts` 和 `styles` 字段引入额外资源。

> 参考实现:`plugins/moments/frontend/index.html`(public 列表,用 `{{.Title}}`)和 `admin.html`(admin 管理,用 `{{.Title}}` + `{{.User.id}}` 注入当前用户 ID 用于按 author 过滤)。

### 老模式手写页面路由(已过时,仅作历史参考)

> **已过时**。`servePlugin` 已封装以下所有逻辑。保留此节仅作历史参考。

<details>
<summary>老模式手写 public/admin/static 三条 routerAdd(点击展开)</summary>

**公开页面**(老模式,~15 行):

```javascript
routerAdd("GET", "/_plugin/moments/render", function (e) {
  var manifest = $vanblog.readManifest("moments");
  var data = $vanblog.buildPageData(manifest, e.auth ? e.auth.id : "");
  var html = $vanblog.renderTemplate("moments", "frontend/index.html", data);
  return e.json(200, {
    html: html,
    title: manifest.routes.public.title || manifest.title || "",
    head: "",
    scripts: manifest.scripts || [],
    styles: manifest.styles || [],
  });
});
```

**管理页面**(老模式,~15 行,需手写 auth guard):

```javascript
routerAdd("GET", "/_plugin/moments/admin", function (e) {
  if (!e.auth) return e.json(401, { error: "Unauthorized" });
  var manifest = $vanblog.readManifest("moments");
  var data = $vanblog.buildPageData(manifest, e.auth.id);
  var html = $vanblog.renderTemplate("moments", "frontend/admin.html", data);
  return e.json(200, {
    html: html,
    title: manifest.routes.admin.title || "",
    head: "",
    scripts: manifest.scripts || [],
    styles: manifest.styles || [],
  });
});
```

**静态资源**(老模式):

```javascript
routerAdd("GET", "/plugins/moments/{path...}", $vanblog.serveStatic("moments"));
```

</details>

## manifest.json 格式

```json
{
  "name": "moments",
  "title": "说说",
  "description": "轻量级状态更新/微博客功能",
  "version": "1.0.0",
  "routes": {
    "public": {
      "path": "/moments",
      "title": "说说"
    },
    "admin": {
      "path": "/admin/moments",
      "title": "说说管理"
    }
  },
  "scripts": [],
  "styles": []
}
```

## 插件封装

### 目录结构

```
plugins/
└── {name}/
    ├── manifest.json
    ├── {name}.pb.js              # JSVM 钩子(servePlugin + 可选业务 hook)
    ├── frontend/
    │   ├── index.html            # 公开页面模板
    │   └── admin.html            # 管理后台模板
    ├── static/                   # 静态资源（可选）
    └── README.md
```

> 新模式下 collection 由 Go migration 创建(在 `vault/pb_migrations/`,不在此目录),CRUD 走 pb 原生 API。`.pb.js` 通常只有 `servePlugin` 一行 + 可选 `onRecord*` 钩子。

### 分发

将整个 `plugins/{name}/` 目录打包为 `.tar.gz` 分发，用户解压后创建 symlink 并重启容器即可。

## 限制与注意事项

### JSVM 环境

1. **ES6+ 语法** — PocketBase 0.39 的 JSVM(goja)支持箭头函数、`const`/`let`、模板字符串等 ES6+ 特性(参考 `pb_hooks/system.pb.js`)。回调可用 `(e) => { ... }` 或 `function(e) { ... }` 形式。

2. **有限的全局 API** — 可用的全局对象：

   - `$app` — PocketBase 应用实例(查找 collection、CRUD 记录)
   - `$dbx` — 数据库表达式构建器(`hashExp`)
   - `$http` — HTTP 客户端(可用 `$http.send({ method, url, body })` 发起 HTTP 请求,如 webhook)
   - `Collection` / `Record` — 数据模型构造函数
   - `require()` — 加载其他 JSVM 模块
   - `console.log()` — 日志输出
   - `onBootstrap` / `routerAdd` / `routerUse` / `cronAdd` — 钩子注册函数
   - `$vanblog` — Vanblog Go helpers(8 个:`servePlugin`、`readManifest`、`buildPageData`、`renderTemplate`、`serveStatic`、`addNavItems`、`getNavItems`、`readFile`)

3. **手动参数解析** — JSVM 没有内置的 query string 解析器,需要自己实现 `getQuery()` 函数:

   ```javascript
   function getQuery(e, name) {
     try {
       if (e.request && e.request.url) {
         var rawQuery = e.request.url.rawQuery || "";
         if (!rawQuery) return null;
         var pairs = rawQuery.split("&");
         for (var i = 0; i < pairs.length; i++) {
           var eq = pairs[i].indexOf("=");
           if (eq === -1) continue;
           var key = decodeURIComponent(
             pairs[i].substring(0, eq).replace(/\+/g, " ")
           );
           if (key === name) {
             return decodeURIComponent(
               pairs[i].substring(eq + 1).replace(/\+/g, " ")
             );
           }
         }
       }
     } catch (_) {}
     return null;
   }
   ```

### Collection 创建

- **新模式优先用 Go migration** — 随 vanblog 二进制分发,避免 `onBootstrap` 在 pb 0.39.5 上的时序竞态问题。参考 `vault/pb_migrations/1783000000_create_moments_collection.go`。
- **onBootstrap 仅为 fallback** — 第三方插件无法发版 Go 代码时使用。必须在 PocketBase 启动阶段完成(不是请求处理阶段)。
- **幂等检查** — 无论 migration 还是 onBootstrap,都要用 `try/catch`(JSVM)或 `err == nil && existing != nil`(Go)包裹 `findCollectionByNameOrId`,防止重复安装时崩溃。
- **动态 `collectionId`** — relation 字段的 `collectionId` 必须在运行时查询(不同 PocketBase 实例的 ID 不同),不能硬编码。
- **权限规则** — 新模式直接设在 collection 的 `ListRule`/`CreateRule`/`UpdateRule`/`DeleteRule` 上,前端 CRUD 无需手写认证。

### 热更新

- **`pb_hooks/*.pb.js`** — JSVM 自动热加载，修改后即时生效。
- **HTML 模板** — 修改 `frontend/*.html` 文件后刷新页面即可看到变化（`$vanblog.renderTemplate` 每次都读取文件）。
- **仅限开发模式** — 生产环境通常使用预构建的 Docker 镜像，不支持热更新。

### 无 Astro 编译

插件系统不再依赖 Astro。页面完全由 Go 侧的 `$vanblog.renderTemplate()` 渲染标准 HTML 模板。这意味着：

- 不需要在 `app/src/pages/` 下创建 `.astro` 文件
- 不需要运行 `npx astro build` 或 `npx astro check`
- 不需要 Tailwind CSS 编译（样式通过 `manifest.json` 的 `styles` 字段引入或内联在 HTML 模板中）

## 参考实现

完整的插件示例(均为新模式):

- **Moments 兼容插件** — core hook `vault/pb_hooks/moments.pb.js` 调用 `servePlugin` 并在创建前自动填充 author；`plugins/moments/` 仅保留 manifest 与 `frontend/index.html`、`frontend/admin.html` 兼容资源。Collection 由 `vault/pb_migrations/1783000000_create_moments_collection.go` 创建，CRUD 走 pb 原生 API。
- **Bookmarks Pack** — `packs/bookmarks/` 是唯一源码；Go migration 创建 Collection，Pack hook 自动填充 owner，Astro 编译 `/p/bookmarks`。旧 `plugins/bookmarks` 已删除。

这些示例覆盖了当前兼容层与 Pack 迁移路径的核心要素(Go migration / pb 原生 CRUD / servePlugin / onRecord hook / Astro Pack page),可作为理解现有边界的参考。
