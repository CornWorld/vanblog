# Vanblog 插件开发指南

## 概述

Vanblog 插件系统允许在不修改核心源码的前提下扩展功能。插件使用 **纯前端模板 + JSVM 后端** 的架构，无需 Astro 编译、Tailwind 重建或 Go 代码重新编译。

### 插件架构

| 层 | 载体 | 用途 |
| --- | --- | --- |
| **数据层** | JSVM `onBootstrap` + `$app.save()` | 运行时创建 PocketBase collection |
| **API 层** | JSVM `routerAdd` / `routerUse` | 注册 HTTP 路由、中间件 |
| **UI 层** | Go `$vanblog` helpers + HTML 模板 | 服务端渲染前端页面 |

## 插件结构

一个完整的插件由以下文件组成：

```
plugins/
└── {name}/
    ├── manifest.json           # 插件元数据（名称、标题、路由、脚本/样式等）
    ├── {name}.pb.js            # JSVM 钩子（collection + API routes + page rendering）
    ├── frontend/
    │   ├── index.html          # 公开页面模板
    │   └── admin.html          # 管理后台模板
    ├── static/                 # 静态资源（CSS、JS、图片等）
    └── README.md               # 安装和使用文档
```

### 安装方式

插件通过 **symlink** 注册到 PocketBase JSVM：

```bash
ln -s ../../plugins/{name}/{name}.pb.js vault/pb_hooks/{name}.pb.js
```

重启容器后，JSVM 自动加载 `.pb.js` 文件，执行 `onBootstrap` 创建 collection 并注册所有路由。

### 与旧架构的区别

- **不再使用 `.astro` 文件** — 页面由 `$vanblog` Go helpers 在服务端渲染普通 HTML 模板
- **不再需要 Astro 编译** — 无需 `npx astro build`，无需 Tailwind 重建
- **不再需要复制页面到 `app/src/pages/`** — 所有文件保持在 `plugins/{name}/` 目录内
- **前端模板使用标准 HTML** — 在 `frontend/index.html` 和 `frontend/admin.html` 中编写

## 扩展点

### `pb_hooks/*.pb.js` — JSVM 钩子

放到 `pb_hooks/` 目录下（或通过 symlink 从 `plugins/` 链接）的 `.pb.js` 文件会被 PocketBase JSVM 自动加载。可用的全局钩子：

| 钩子 | 时机 | 用途 |
| --- | --- | --- |
| `onBootstrap(function(e) { ... })` | PocketBase 启动后 | collection 创建、系统初始化 |
| `routerAdd("GET", "/path", handler)` | 启动时注册 | CRUD API 路由 |
| `routerUse("GET", "/path/*", [mw1, mw2])` | 启动时注册 | 带中间件的路由 |
| `cronAdd("*/5 * * * *", handler)` | 启动时注册 | 定时任务 |

### `$vanblog` Go Helpers — 页面渲染

`.pb.js` 文件中通过全局 `$vanblog` 对象调用 Go 侧注册的辅助函数：

| Helper | 用途 |
| --- | --- |
| `$vanblog.addNavItems(name)` | 将插件注册到导航菜单 |
| `$vanblog.readManifest(name)` | 读取 `plugins/{name}/manifest.json` |
| `$vanblog.buildPageData(manifest, userId)` | 构建页面渲染数据（包含用户信息、站点配置等） |
| `$vanblog.renderTemplate(name, templatePath, data)` | 渲染 `plugins/{name}/{templatePath}` 的 HTML 模板 |
| `$vanblog.serveStatic(name)` | 返回 `plugins/{name}/static/` 的静态文件处理器 |

## Collection 创建

在 `onBootstrap` 中通过 JSVM API 创建 PocketBase collection。**必须是 idempotent 的** —— 每次启动先检查是否已存在：

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
    type: "base",           // "base" 普通表, "auth" 用户表
    name: "moments",        // collection 名称（将在 /api/collections/moments 暴露）
    listRule: "visible = true",
    viewRule: "visible = true",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && @request.auth.id = author",
    deleteRule: "@request.auth.id != '' && (@request.auth.id = author || @request.auth.role = 'admin')",
    fields: [
      {
        name: "content",
        type: "text",
        required: true,
        max: 500,
      },
      {
        name: "author",
        type: "relation",
        collectionId: usersCol.id,
        maxSelect: 1,
        required: true,
      },
      {
        name: "visible",
        type: "bool",
        required: false,
      },
      {
        name: "created",
        type: "autodate",
        onCreate: true,
        onUpdate: false,
      },
      {
        name: "updated",
        type: "autodate",
        onCreate: true,
        onUpdate: true,
      },
    ],
  });

  $app.save(collection);
  console.log("[moments] Collection created successfully.");
});
```

**关键点：**

- 用 `try/catch` 做幂等检查，避免重复创建报错
- `collectionId` 需要从已有 collection 动态获取（不能硬编码）
- `listRule` / `viewRule` / `createRule` / `updateRule` / `deleteRule` 使用 PocketBase 访问控制表达式
- `autodate` 字段由 PocketBase 自动维护，无需手动赋值

## 路由注册

用 `routerAdd` 注册 HTTP 路由。Handler 签名：`function(e)`，其中 `e` 是 `core.RequestEvent`。

### 公开列表接口

```javascript
routerAdd("GET", "/api/moments/list", function (e) {
  try {
    // 手动解析查询参数（JSVM 没有内置 query parser）
    var page = parseInt(getQuery(e, "page") || "1");
    var perPage = parseInt(getQuery(e, "perPage") || "20");

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(perPage) || perPage < 1) perPage = 20;

    // 计数
    var totalItems = $app.countRecords(
      "moments",
      $dbx.hashExp({ visible: true })
    );

    // 分页查询
    var records = $app.findRecordsByFilter(
      "moments",
      "visible = true",
      "-created",          // 按创建时间降序
      perPage,
      (page - 1) * perPage // offset
    );

    // 构建响应（扩展关联字段）
    var items = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      items.push({
        id: rec.id,
        content: rec.getString("content"),
        visible: rec.getBool("visible"),
        created: rec.getString("created"),
        updated: rec.getString("updated"),
      });
    }

    var totalPages = Math.ceil(totalItems / perPage);

    return e.json(200, {
      items: items,
      page: page,
      perPage: perPage,
      totalItems: totalItems,
      totalPages: totalPages,
    });
  } catch (err) {
    return e.json(500, {
      error: "Failed to list: " + (err.message || err),
    });
  }
});
```

### 创建接口（需认证）

```javascript
routerAdd("POST", "/api/moments/create", function (e) {
  try {
    // 认证检查
    if (!e.auth) {
      return e.json(401, { error: "Authentication required" });
    }

    // 解析请求体
    var body;
    try {
      body = JSON.parse(toString(e.request.body) || "{}");
    } catch (_) {
      return e.json(400, { error: "Invalid JSON body" });
    }

    // 参数校验
    var content = (body.content || "").trim();
    if (!content) {
      return e.json(400, { error: "Content is required" });
    }
    if (content.length > 500) {
      return e.json(400, { error: "Content must be at most 500 characters" });
    }

    // 创建记录
    var collection = $app.findCollectionByNameOrId("moments");
    var record = new Record(collection);
    record.set("content", content);
    record.set("author", e.auth.id);
    record.set("visible", true);

    $app.save(record);

    return e.json(200, {
      id: record.id,
      content: record.getString("content"),
      author: record.getString("author"),
      created: record.getString("created"),
    });
  } catch (err) {
    return e.json(500, {
      error: "Failed to create: " + (err.message || err),
    });
  }
});
```

### 删除接口（需认证 + 授权）

```javascript
routerAdd("DELETE", "/api/moments/{id}", function (e) {
  try {
    if (!e.auth) {
      return e.json(401, { error: "Authentication required" });
    }

    // Path parameter
    var momentId = e.request && e.request.pathValue
      ? e.request.pathValue("id")
      : "";

    if (!momentId) {
      return e.json(400, { error: "Moment ID is required" });
    }

    // 查找记录
    var record;
    try {
      record = $app.findRecordById("moments", momentId);
    } catch (_) {
      return e.json(404, { error: "Moment not found" });
    }

    // 授权：作者或管理员
    var authorId = record.getString("author");
    var isAuthor = authorId === e.auth.id;
    var userRole = e.auth.getString("role") || "";
    var isAdmin = userRole === "admin";

    if (!isAuthor && !isAdmin) {
      return e.json(403, {
        error: "Not authorized: you must be the author or an admin",
      });
    }

    $app.delete(record);

    return e.json(200, { success: true });
  } catch (err) {
    return e.json(500, {
      error: "Failed to delete: " + (err.message || err),
    });
  }
});
```

### 常用模式总结

| 操作 | 代码 |
| --- | --- |
| 认证检查 | `if (!e.auth) return e.json(401, {...})` |
| 查询参数 | `getQuery(e, "key")` 手动解析 `rawQuery` |
| 请求体 | `JSON.parse(toString(e.request.body) \|\| "{}")` |
| 路径参数 | `e.request.pathValue("id")` |
| 分页 | `$app.findRecordsByFilter(col, filter, sort, limit, offset)` |
| 关联查询 | `$app.findRecordById("users", rec.getString("author"))` |
| 计数 | `$app.countRecords(col, $dbx.hashExp({...}))` |
| 审计日志 | 调用 `require("./pb_hooks/lib/vanblog-audit.js").recordAudit({...})` |
| 返回 JSON | `e.json(200, { ... })` |

## 页面渲染

### 公开页面

通过 `$vanblog` helpers 注册页面渲染路由：

```javascript
routerAdd("GET", "/_plugin/moments/render", function(e) {
    var manifest = $vanblog.readManifest("moments");
    var data = $vanblog.buildPageData(manifest, e.auth ? e.auth.id : "");
    var html = $vanblog.renderTemplate("moments", "frontend/index.html", data);
    return e.json(200, {
        html: html,
        title: manifest.routes.public.title || manifest.title || "",
        head: "",
        scripts: manifest.scripts || [],
        styles: manifest.styles || []
    });
});
```

### 管理页面

```javascript
routerAdd("GET", "/_plugin/moments/admin", function(e) {
    if (!e.auth) return e.json(401, { error: "Unauthorized" });
    var manifest = $vanblog.readManifest("moments");
    var data = $vanblog.buildPageData(manifest, e.auth.id);
    var html = $vanblog.renderTemplate("moments", "frontend/admin.html", data);
    return e.json(200, {
        html: html,
        title: manifest.routes.admin.title || "",
        head: "",
        scripts: manifest.scripts || [],
        styles: manifest.styles || []
    });
});
```

### 静态资源

```javascript
routerAdd("GET", "/plugins/moments/{path...}", $vanblog.serveStatic("moments"));
```

### 前端模板

模板文件是标准 HTML，放在 `plugins/{name}/frontend/` 下：

- `frontend/index.html` — 公开页面模板
- `frontend/admin.html` — 管理后台模板

模板中可以访问 `$vanblog.buildPageData()` 返回的数据（站点配置、用户信息、插件元数据等），并使用 `manifest.json` 中声明的 scripts 和 styles。

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
    ├── {name}.pb.js              # JSVM 钩子（collection + routes + page rendering）
    ├── frontend/
    │   ├── index.html            # 公开页面模板
    │   └── admin.html            # 管理后台模板
    ├── static/                   # 静态资源（可选）
    └── README.md
```

### 分发

将整个 `plugins/{name}/` 目录打包为 `.tar.gz` 分发，用户解压后创建 symlink 并重启容器即可。

## 限制与注意事项

### JSVM 环境

1. **ES5 语法** — PocketBase JSVM 基于 Goja，不支持箭头函数（`() => {}`）、`const`/`let`、模板字符串等 ES6+ 特性。顶层的 `onBootstrap`、`routerAdd` 回调必须使用 `function(e) { ... }` 形式。

2. **有限的全局 API** — 可用的全局对象：
   - `$app` — PocketBase 应用实例（查找 collection、CRUD 记录）
   - `$dbx` — 数据库表达式构建器（`hashExp`）
   - `Collection` / `Record` — 数据模型构造函数
   - `require()` — 加载其他 JSVM 模块
   - `console.log()` — 日志输出
   - `onBootstrap` / `routerAdd` / `routerUse` / `cronAdd` — 钩子注册函数
   - `$vanblog` — Vanblog Go helpers（`readManifest`、`buildPageData`、`renderTemplate`、`serveStatic`、`addNavItems`）

3. **`$http` 不可用** — `$http.send()` 在 JSVM 中可能不可用，应使用 `$app` API 操作数据库。

4. **手动参数解析** — JSVM 没有内置的 query string 解析器，需要自己实现 `getQuery()` 函数：

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
           var key = decodeURIComponent(pairs[i].substring(0, eq).replace(/\+/g, " "));
           if (key === name) {
             return decodeURIComponent(pairs[i].substring(eq + 1).replace(/\+/g, " "));
           }
         }
       }
     } catch (_) {}
     return null;
   }
   ```

### Collection 创建

- **使用 `onBootstrap`，不是 `onServe`** — Collection 创建必须在 PocketBase 启动阶段完成，不能在请求处理阶段。
- **幂等检查** — 使用 `try/catch` 包裹 `findCollectionByNameOrId`，防止重复安装时崩溃。
- **动态 `collectionId`** — relation 字段的 `collectionId` 必须在运行时查询（不同 PocketBase 实例的 ID 不同），不能硬编码。

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

完整的插件示例：

- **Moments 插件** — `plugins/moments/`：collection 创建 + 3 个 API 路由 + 审计日志 + 页面渲染
- **Bookmarks 插件** — `plugins/bookmarks/`：collection 创建 + 3 个 API 路由 + 页面渲染

这两个插件覆盖了 Vanblog 插件系统的所有扩展点，可作为开发新插件的模板。
