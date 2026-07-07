# 插件开发者体验 (DX) 改进方案对比

## 当前状态

**加一个插件需要做的事：**

| # | 文件 | 操作 | 行数 |
|---|------|------|------|
| 1 | `plugins/{name}/manifest.json` | 新建 | ~15 |
| 2 | `plugins/{name}/frontend/index.html` | 新建 | ~60 |
| 3 | `plugins/{name}/frontend/admin.html` | 新建 | ~70 |
| 4 | `vault/pb_hooks/plugins.pb.js` | **编辑** — 复制粘贴 ~80 行样板 + 改 6 处路径 | +80 |
| 5 | `vault/pb_hooks/plugins.pb.js` | **编辑** — nav 列表加一行 | +1 |
| 6 | `vault/pb_hooks/plugins.pb.js` | **编辑** — console.log 加一行 | +1 |

**痛点：步骤 4 必须修改核心文件，且 80 行纯样板代码。**

根本原因：Goja JSVM 不允许 handler 闭包访问外层变量，导致无法写 `registerPlugin("name")` 这样的工厂函数。每个插件的路由必须在顶层用内联 handler 注册，路径必须硬编码。

---

## 方案 A：插件自带 `.pb.js` + 软链接到 `pb_hooks/`

### 插件目录结构
```
plugins/bookmarks/
├── manifest.json
├── bookmarks.pb.js          ← 自包含的路由注册（~80行，在插件目录内）
├── frontend/
│   ├── index.html
│   └── admin.html
└── README.md
```

### pb_hooks 目录
```
pb_hooks/
├── system.pb.js              ← 核心系统（不变）
├── plugins.pb.js             ← 只做 nav 聚合（精简为 ~30 行）
├── bookmarks.pb.js → ../../plugins/bookmarks/bookmarks.pb.js  ← 软链接
└── moments.pb.js → ../../plugins/moments/moments.pb.js        ← 软链接
```

### 开发者操作
1. 创建 `plugins/{name}/manifest.json`
2. 创建 `plugins/{name}/{name}.pb.js`（~80 行样板，但从现有插件复制，改 6 处路径）
3. 创建 `plugins/{name}/frontend/index.html`
4. 创建 `plugins/{name}/frontend/admin.html`
5. `ln -s ../../plugins/{name}/{name}.pb.js vault/pb_hooks/{name}.pb.js`
6. 编辑 `vault/pb_hooks/plugins.pb.js` → nav 列表加一行
7. 重启容器

### 评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 接触核心代码 | ⭐⭐⭐ | 只改 nav 列表一行（`plugins.pb.js`） |
| 样板代码量 | ⭐⭐ | ~80 行/.pb.js 在插件包内，可从模板复制 |
| 自包含性 | ⭐⭐⭐⭐ | 插件文件全在 `plugins/{name}/` 下，`pb_hooks/` 里只多一个软链接 |
| 可靠性 | ⭐⭐⭐⭐ | PB JSVM 原生支持 `pb_hooks/*.pb.js` 扫描，dev/prod 都有效 |
| 跨平台 | ⭐⭐⭐ | 软链接在 Docker 内工作正常；Windows 需 WSL |

### 关键洞察：这个软链接与旧方案的本质区别

| | 旧方案软链接 | 方案 A 软链接 |
|---|---|---|
| 链接什么 | `.astro` 源文件 | `.pb.js` JSVM 文件 |
| 目标目录 | `app/src/pages/` (Astro 编译管线) | `pb_hooks/` (PB JSVM 运行时) |
| 何时生效 | 仅 dev HMR，prod 无效 | dev + prod 都有效 (PB 原生扫描) |
| 为什么 | Astro 编译后是 `dist/server/` 中的 `.mjs`，运行时无法加载新 `.astro` | PB JSVM 在每次启动时按文件系统扫描 `pb_hooks/` |

---

## 方案 B：Go 层 `$plugins.register()` API

### 修改 Go 源码
在 `vault/internal/` 下新增包，向 JSVM 注入 `$plugins` 命名空间：

```go
// vault/internal/plugins/jsvm_api.go
func RegisterJSVMAPI(app core.App) {
    app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
        // 向 JSVM 注入 $plugins.register(name)
        jsvm := app.Store().Get("jsvmPlugin")...
        jsvm.Set("$plugins", map[string]any{
            "register": func(name string) {
                // 读取 plugins/{name}/manifest.json
                // 自动注册所有标准路由：render, admin, static
            },
            "autoDiscover": func() {
                // 扫描 plugins/ 目录
                // 为每个有 manifest.json 的子目录调用 register()
            },
        })
        return e.Next()
    })
}
```

### 新 `plugins.pb.js`（精简到 ~15 行）
```javascript
// 一个函数调用，自动发现并注册所有插件
$plugins.autoDiscover();

// Nav 聚合
routerAdd("GET", "/_plugin/nav", function(e) {
    return e.json(200, { items: $plugins.getNavItems() });
});

console.log("[plugins] Auto-discovered all plugins");
```

### 开发者操作
1. 创建 `plugins/{name}/manifest.json`
2. 创建 `plugins/{name}/frontend/index.html`
3. 创建 `plugins/{name}/frontend/admin.html`
4. 重启容器

### 评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 接触核心代码 | ⭐⭐⭐⭐⭐ | **零接触**，不改任何核心文件 |
| 样板代码量 | ⭐⭐⭐⭐⭐ | **零样板**，3 个文件，纯业务内容 |
| 自包含性 | ⭐⭐⭐⭐⭐ | 插件 = 一个目录，全部自包含 |
| 可靠性 | ⭐⭐⭐⭐ | Go 层注册，性能优；可缓存 manifest |
| 实现代价 | ⭐⭐ | 需要改 Go 代码 + 重新编译 Docker 镜像 |
| API 稳定性 | ⭐⭐⭐ | PB 版本升级时可能需要适配 JSVM API |

---

## 方案 C：CLI 脚手架工具

在方案 A 的基础上，提供一个脚本自动生成 `.pb.js` 样板和软链接：

```bash
# 开发者运行：
./vanblog.sh plugin create bookmarks --title "网址收藏"
```

自动完成：
- 从模板生成 `manifest.json`、`index.html`、`admin.html`、`bookmarks.pb.js`
- 创建 `pb_hooks/bookmarks.pb.js` 软链接
- 更新 `plugins.pb.js` 的 nav 列表

### 开发者操作
1. `./vanblog.sh plugin create bookmarks --title "网址收藏"`
2. 编辑 `plugins/bookmarks/frontend/index.html`（填业务逻辑）
3. 重启容器

### 评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 接触核心代码 | ⭐⭐⭐⭐ | 工具自动改 nav 列表 |
| 样板代码量 | ⭐⭐⭐⭐ | 工具自动生成 |
| 实现代价 | ⭐⭐⭐⭐ | 纯脚本，简单 |

这个方案可以与 A 或 B 组合使用。

---

## 综合对比

| 维度 | 现状 | 方案 A (软链接 .pb.js) | 方案 B (Go $plugins) | 方案 C (CLI) |
|------|------|------------------------|---------------------|---------------|
| 开发者操作步骤 | 6 步 | 7 步 | **3 步** | 3 步 |
| 接触核心代码 | 编辑 plugins.pb.js (80行) | 编辑 nav 列表 (1行) | **零** | 零（工具代劳） |
| 每插件样板代码 | 80 行 | 80 行（在插件包内） | **0 行** | 0 行（工具生成） |
| 实现工作量 | — | 1 小时 | 4-6 小时 | 2 小时 |
| 可维护性 | 低 | 中 | **高** | 高 |
| 依赖 | 无 | PB JSVM | PB JSVM API 稳定 | 无 |

## 建议路线

**短期（本周）：方案 A** — 把 `plugins.pb.js` 拆成每个插件自己的 `.pb.js`，软链接注册。
- 投入小（1h），立即消除"编辑核心文件"的痛点
- 每个插件的 `bookmarks.pb.js` 样板是固定的，可以从 `moments.pb.js` 复制改路径

**中期（下次发版）：方案 B** — Go 层 `$plugins.autoDiscover()`。
- 彻底消除样板代码
- 插件开发者只需要 3 个文件：manifest.json + 两个 HTML 模板

**辅助：方案 C** 可以与 A 或 B 组合，提供 `vanblog plugin create` 命令。
