# 插件架构重新设计 v2：Astro Shell + PB Fragment

## 问题诊断

### 旧方案（软链接）的死结

```
.astro 源文件 → vite build → dist/server/entry.mjs
运行时无法"动态添加" .astro 页面 → SSR 输出已经编译好了
```

### v1 方案（PB 独立渲染完整页面）的缺陷

```
浏览器 → PB (渲染完整 HTML with layout)
              vs
浏览器 → Astro (渲染完整 HTML with layout)
              ↓
      两个布局系统、两套鉴权、CSS 分裂
```

**根本问题：PB 和 Astro 各渲染各的完整页面 → 布局/鉴权/CSS 全部割裂。**

---

## 正确架构：Astro 作为组合外壳（Shell），PB 作为片段渲染器（Fragment）

### 核心思想

> **Astro 是前端统一入口，PB 是后端内容提供者。插件页面内容由 PB 渲染为 HTML 片段，Astro 从 PB 拉取片段并包裹在 BaseLayout 中返回。**

### 数据流

```
Browser
  │
  ▼
Caddy (:80/:443)
  │
  ├─ /*                          → Astro SSR (:4321)
  │   ├─ /                        → 首页 (Astro 原生)
  │   ├─ /archive                 → 归档 (Astro 原生)
  │   ├─ /p/moments               → Astro 动态路由 → server-side fetch PB → 包裹 BaseLayout
  │   └─ /admin/plugins/moments   → Astro 动态路由 → server-side fetch PB → 包裹 AdminLayout
  │
  ├─ /api/*                      → PocketBase (:8090)
  │   ├─ /api/posts/*             → 核心 API (Go)
  │   ├─ /api/moments/*           → 插件 API (JSVM routerAdd)
  │   └─ /_plugin/moments/render → 插件片段 API (JSVM，返回 HTML 片段)
  │
  └─ /plugins/*                  → PocketBase (:8090) [静态资源]
      └─ /plugins/moments/app.js  → $apis.static()
```

### 请求流程：访问 `/p/moments`

```
1. 浏览器 → GET /p/moments (Cookie: pb_auth=xxx)
2. Caddy → Astro SSR (:4321)
3. Astro 中间件 → 从 cookie 恢复 pb client (auth 就绪)
4. Astro 动态路由 [plugin].astro → 
   server-side fetch('http://127.0.0.1:8090/_plugin/moments/render', {
     headers: { Cookie: 'pb_auth=xxx' }  // 转发鉴权
   })
5. PB JSVM 收到请求 → e.auth 有值 → 渲染 HTML 片段
6. PB 返回 { html: '<div>...</div>', title: '说说', head: '...' }
7. Astro → BaseLayout({title, head}) + Fragment set:html={html}
8. 浏览器收到完整 HTML → 加载 /plugins/moments/app.js → CSR 交互
```

### 为什么鉴权“无所谓了”

- Astro middleware 已经从 cookie 恢复 `pb.authStore`
- Server-side fetch 到 PB 时 **forward 原始 cookie**
- PB JSVM 的 `e.auth` 自然拿到当前用户
- 浏览器层面：所有请求同域名、同 cookie scope
- **零额外鉴权代码，零 cookie 同步问题**

---

## 插件包结构

```
plugins/moments/
├── manifest.json              # 插件元数据
├── moments.pb.js              # JSVM：collection 创建 + API 路由 + 片段渲染路由
├── frontend/
│   ├── index.html             # 前台 HTML 片段模板（无 <html><body> 外壳）
│   ├── admin.html             # 后台 HTML 片段模板
│   ├── app.js                 # 客户端 JS
│   └── style.css              # 插件样式
├── migrate.js                 # 数据库迁移（可选）
└── README.md
```

### manifest.json

```json
{
  "name": "moments",
  "version": "1.0.0",
  "title": "说说/动态",
  "description": "轻量级社交动态流",
  "author": "Vanblog Community",
  "routes": {
    "public":  { "path": "/p/moments",       "title": "说说",         "template": "frontend/index.html" },
    "admin":   { "path": "/admin/plugins/moments", "title": "说说管理", "template": "frontend/admin.html" }
  },
  "navItems": [
    { "path": "/p/moments", "title": "说说", "position": "header" }
  ],
  "adminMenuItems": [
    { "path": "/admin/plugins/moments", "title": "说说管理", "icon": "chat" }
  ],
  "scripts": ["/plugins/moments/app.js"],
  "styles":  ["/plugins/moments/style.css"]
}
```

---

## 技术实现

### 1. PB 片段渲染路由（`moments.pb.js`）

```javascript
// 前台片段 —— 返回纯 HTML 片段（无 layout 外壳）
routerAdd("GET", "/_plugin/moments/render", function(e) {
    var moments = getPublicMoments();
    var html = $template.loadFiles(
        "plugins/moments/frontend/index.html"
    ).render({
        "Title": "说说",
        "Moments": moments,
        "User": e.auth ? getUserInfo(e.auth.id) : null
    });
    return e.json(200, {
        html: html,
        title: "说说",
        head: ""  // 可选：额外的 <link>/<meta>/<style> 标签
    });
});

// 后台片段 —— 需要鉴权
routerAdd("GET", "/_plugin/moments/admin", function(e) {
    if (!e.auth) return e.json(401, { error: "Unauthorized" });
    var myMoments = getMyMoments(e.auth.id);
    var html = $template.loadFiles(
        "plugins/moments/frontend/admin.html"
    ).render({
        "Title": "说说管理",
        "Moments": myMoments,
        "User": getUserInfo(e.auth.id)
    });
    return e.json(200, {
        html: html,
        title: "说说管理",
        head: ""
    });
});

// 静态资源 —— PB 原生 $apis.static
routerAdd(
    "GET",
    "/plugins/moments/{path...}",
    $apis.static("plugins/moments/frontend", false)
);

// ======== 以下与旧方案一致，不变 ========
// onBootstrap → 创建 collection
// routerAdd CRUD API → /api/moments/list, create, delete
```

### 2. Astro 动态路由（`app/src/pages/p/[plugin].astro`）

```astro
---
// app/src/pages/p/[plugin].astro
// 所有 /p/* 请求都走这里，根据插件名动态获取 PB 片段
export const prerender = false;

import BaseLayout from '@layouts/BaseLayout.astro';
import { getPluginPage } from '@lib/plugin-loader';

const { plugin } = Astro.params;
const pb = Astro.locals.pb;

// 从 PB 拉取 HTML 片段（server-side，带鉴权转发）
const pluginData = await getPluginPage({
    plugin,
    type: 'public',
    pbUrl: 'http://127.0.0.1:8090',
    cookie: Astro.request.headers.get('cookie') || '',
});

if (!pluginData) {
    return Astro.redirect('/404');
}
---

<BaseLayout title={pluginData.title} head={pluginData.head}>
    <Fragment set:html={pluginData.html} />
</BaseLayout>
```

### 3. `getPluginPage()` — 插件片段加载器

```typescript
// app/src/lib/plugin-loader.ts
interface PluginPageData {
    html: string;
    title: string;
    head: string;
    scripts?: string[];
}

export async function getPluginPage(opts: {
    plugin: string;
    type: 'public' | 'admin';
    pbUrl: string;
    cookie: string;
}): Promise<PluginPageData | null> {
    const endpoint = opts.type === 'public'
        ? `/_plugin/${opts.plugin}/render`
        : `/_plugin/${opts.plugin}/admin`;

    const res = await fetch(`${opts.pbUrl}${endpoint}`, {
        headers: { Cookie: opts.cookie }
    });

    if (!res.ok) return null;
    return res.json();
}
```

### 4. HTML 片段模板（`index.html`）

```html
<!-- plugins/moments/frontend/index.html -->
<!-- 注意：无 <html>/<head>/<body>，只是内容片段！ -->
<div class="moments-page">
    <h1>{{.Title}}</h1>
    <div id="moments-app">
        {{range .Moments}}
        <article class="moment-card">
            <div class="moment-content">{{.Content}}</div>
            <time>{{.Created}}</time>
        </article>
        {{end}}
    </div>
</div>
```

### 5. 通用插件路由注册（`plugins.pb.js`）

核心系统提供 `plugins.pb.js`，自动为所有已安装插件注册路由：

```javascript
// vault/pb_hooks/plugins.pb.js — 核心插件加载器
onBootstrap(function(e) {
    var plugins = discoverPlugins(); // 扫描 plugins/*/manifest.json

    for (var i = 0; i < plugins.length; i++) {
        var p = plugins[i];
        var name = p.name;
        var manifest = p.manifest;

        // 1. 静态资源
        routerAdd(
            "GET",
            "/plugins/" + name + "/{path...}",
            $apis.static("plugins/" + name + "/frontend", false)
        );

        // 2. 片段渲染路由（公开）
        if (manifest.routes && manifest.routes.public) {
            registerFragmentRoute(name, "public", manifest);
        }

        // 3. 片段渲染路由（管理）
        if (manifest.routes && manifest.routes.admin) {
            registerFragmentRoute(name, "admin", manifest);
        }
    }
});

function registerFragmentRoute(name, type, manifest) {
    var route = type === "public" ? manifest.routes.public : manifest.routes.admin;
    var endpoint = "/_plugin/" + name + (type === "public" ? "/render" : "/admin");

    routerAdd("GET", endpoint, function(e) {
        // 管理页面需要鉴权
        if (type === "admin" && !e.auth) {
            return e.json(401, { error: "Unauthorized" });
        }

        var data = buildPluginData(name, type, e);
        var html = $template.loadFiles(
            "plugins/" + name + "/" + route.template
        ).render(data);

        return e.json(200, {
            html: html,
            title: route.title,
            head: "",
            scripts: manifest.scripts || [],
            styles: manifest.styles || []
        });
    });
}
```

---

## 布局一致性

### 为什么不需要 layout.html 了

- **v1 方案**：PB 渲染完整 HTML → 需要自己的 layout.html（导致布局分裂）
- **v2 方案**：PB 只渲染内容片段 → Astro BaseLayout 统一包裹 → **天然一致**

### CSS 一致性

| 层级 | 样式来源 | 问题 |
|------|---------|------|
| 布局外壳 | Astro BaseLayout → Tailwind 编译后的 `global.css` | ✅ 正常工作 |
| 插件内容 | HTML 片段，用 Tailwind class | ⚠️ 片段中的 Tailwind class 需要在编译时被扫描到 |

**解决方案：Tailwind content 扫描范围包含插件**

```js
// app/astro.config.mjs — 或者 tailwind 配置
// 让 Tailwind 在构建时扫描插件目录的 HTML 片段
content: [
    './src/**/*.{astro,html,js,ts}',
    '../plugins/**/frontend/**/*.html',  // ← 插件片段
]
```

这样插件作者可以放心使用 `class="flex items-center gap-4 rounded-lg shadow-md"` 等 Tailwind utility，构建时会自动包含。

---

## 与 v1 方案的对比

| 方面 | v1 (PB 独立渲染) | v2 (Astro Shell + PB Fragment) |
|------|-----------------|-------------------------------|
| 布局 | PB 需要自己的 layout.html | Astro BaseLayout 统一 |
| 鉴权 | PB 独立读 cookie，可能不一致 | Astro forward cookie，e.auth 一致 |
| CSS | 需要 CSS 变量设计系统（脱离 Tailwind） | 插件可用 Tailwind class（content 扫描） |
| SEO | CSR，差 | 服务端片段渲染 + 服务端 fetch，HTML 完整 |
| 复杂度 | 需要维护两套布局 | 只需要一个 Astro 动态路由 |
| 插件作者体验 | 写 Go 模板语法 | 写 Go 模板语法（相同） |

---

## 实施计划

### Phase 0: 清理（立即执行）

- **Goal**: 删除所有软链接和临时脚本，撤销临时 config 改动
- **Files**:
  - `app/src/pages/moments/` (symlink dir)
  - `app/src/pages/admin/moments.astro` (symlink)
  - `vault/pb_hooks/moments.pb.js` (symlink)
  - `scripts/plugin-dev-setup.sh`
  - `plugins/moments/lib` (反向 symlink)
- **撤销**: `astro.config.mjs` 中的 path aliases, `tsconfig.json` 中的 paths, `eslint.config.js` 中的 plugins/pb_hooks ignore
- **Done when**: `find . -type l ! -path '*/node_modules/*'` 返回空

### Phase 1: 核心基础设施

- **Goal**: 实现 Astro 端插件加载器 + PB 端通用插件管理器
- **Files**:
  - `app/src/lib/plugin-loader.ts` — `getPluginPage()` → server-side fetch PB 片段
  - `app/src/pages/p/[plugin].astro` — 动态路由，组装 BaseLayout + 插件片段
  - `app/src/pages/admin/plugins/[plugin].astro` — 管理端动态路由
  - `vault/pb_hooks/plugins.pb.js` — 通用：发现插件、注册 `/_plugin/{name}/render` + `$apis.static`
  - `vault/pb_hooks/lib/vanblog-plugin-manager.js` — `discoverPlugins()`, `buildPluginData()`, `applyMigrations()`
- **Steps**:
  - 实现 `discoverPlugins()` → 扫描 `plugins/*/manifest.json`
  - 实现 Astro 动态路由 `[plugin].astro` → fetch PB → 包裹 BaseLayout
  - 实现 PB 端 `/_plugin/{name}/render` 通用路由
  - 实现 `$apis.static("plugins/{name}/frontend")` 自动注册
- **Done when**: 创建一个最小测试插件（`manifest.json` + `index.html`）→ 访问 `/p/test` → Astro 包裹 BaseLayout 渲染

### Phase 2: Tailwind 集成

- **Goal**: 插件 HTML 片段中的 Tailwind class 在生产构建时生效
- **Files**: 修改 Tailwind/Vite 配置（在 `astro.config.mjs` 或相关配置中）
- **Steps**:
  - 将 `../plugins/**/frontend/**/*.html` 加入 Tailwind content 扫描路径
  - 验证：插件片段中使用 `class="rounded-lg shadow-md p-4"` → `astro build` 后 class 生效
- **Done when**: 插件片段中的 Tailwind utility class 在 prod build 中正常渲染

### Phase 3: 重构 Moments 插件

- **Goal**: 将 Moments 从 `.astro` + symlink 改为 fragment 架构
- **Files**:
  - 重写 `plugins/moments/moments.pb.js` — 添加 `/_plugin/moments/render` 路由
  - 新增 `plugins/moments/manifest.json`
  - 新增 `plugins/moments/frontend/index.html` (Go 模板片段)
  - 新增 `plugins/moments/frontend/admin.html` (Go 模板片段)
  - 新增 `plugins/moments/frontend/app.js` (客户端交互)
  - 新增 `plugins/moments/frontend/style.css` (可选，主要用 Tailwind)
- **Steps**:
  - 将 `index.astro` 的 UI → `index.html` + 服务端数据注入
  - 将 `admin/moments.astro` 的 UI → `admin.html` + 服务端数据注入
  - 保留 collection 创建 + CRUD API 路由（不变）
  - 客户端交互 JS 从 `app.js` 加载
- **Done when**: Docker dev 容器中安装插件 → `/p/moments` 正确渲染（BaseLayout + 插件片段）

### Phase 4: 导航注入 + 验证

- **Goal**: 插件导航自动注入 Astro 导航栏 + 端到端验证
- **Files**:
  - `app/src/lib/plugin-loader.ts` — 增加 `getPluginNavItems()`
  - BaseLayout.astro — 从 `Astro.locals` 读取 `pluginNavItems` 并渲染
  - Astro middleware — 调用 `getPluginNavItems()` 并注入到 `locals`
- **Steps**:
  - 服务端读取所有 `plugins/*/manifest.json` → 收集 `navItems`
  - BaseLayout 的导航栏渲染 `pluginNavItems`
  - 端到端测试：安装 moments → 首页导航栏出现「说说」→ 点击跳转 → BaseLayout 包裹内容
- **Done when**: 导航栏自动显示插件链接，全流程正常

---

## 风险 & 缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| **Tailwind content 扫描路径** — 跨 workspace 目录可能不被 Vite 识别 | 插件 class 不生效 | 验证 `astro.config.mjs` 的 `vite.content` 或 Tailwind v4 的 `@source` 指令；备选：symlink `plugins/` 进 `app/src/` 仅用于构建扫描（不是运行时） |
| **Server-side fetch 性能** — 每次请求都调用 PB | 页面响应慢 | Astro `memoryCache`（已有）缓存插件片段 1-5 分钟；用户自身数据（`e.auth`）的动态内容不缓存 |
| **`e.auth` 的 cookie 转发** — 某些 cookie 属性可能阻止转发 | PB 看不到登录态 | 验证 `pb_auth` cookie 的 `SameSite`/`HttpOnly` 设置；内部 `127.0.0.1` 通信不受限制 |
| **PB JSVM 返回的 HTML 片段安全性** | XSS 风险 | Go `html/template` 自动 XSS 转义；Astro `set:html` 信任内部来源 |
| **`$apis.static` 目录路径** | 容器内路径不同 | PB 工作目录在 `vault/`，相对路径 `../plugins/...` 或绝对路径配置 |

---

## 后续增强

- **按需加载**：`manifest.json` 声明懒加载的 scripts/styles，BaseLayout 动态注入
- **插件热重载**：dev 模式 watch `plugins/` 目录变化 → 自动刷新路由
- **插件市场 CLI**：`vanblog plugin install moments`
- **Go 层插件 SDK**：供 Go 代码注册 PB hooks（非 JSVM 限制场景）
