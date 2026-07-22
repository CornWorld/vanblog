# 从 Plugin 到 Pack：扩展系统演进史

> **文档定位**：系统性总结 VanBlog 扩展架构的设计动机、实践教训与方向选择。
> 供维护者理解"为什么先做 Plugin、为什么转向 Pack、两者如何对比"。
>
> **关联文档**：
>
> - `docs/future-pack-architecture.md` — Pack 架构设计文档（前瞻性规范）
> - `docs/architecture-layering.md` — 三层架构（Go / JSVM / Astro）
> - ~~`docs/plugin-authoring.md`~~ — 已删除（内容已整合到本文档）
> - `docs/lessons-learned.md` — 通用实施经验教训

---

## 1. 背景：为什么需要扩展系统

VanBlog 从 NestJS 单体重构为 PocketBase 架构后，核心业务（文章、图片、迁移、Caddy、RSS 等）全部收敛到 Go 业务层 + PocketBase 原生 API。但博客系统天然需要"可插拔功能"——说说(moments)、收藏(bookmarks)、友链、自定义页面等，这些功能：

- 不值得为每个功能编译一个 Go 二进制
- 需要独立的 Collection + CRUD + 前端页面
- 不同用户可能启用/禁用/自定义

因此需要一个"扩展系统"，让功能模块可以在不修改核心源码的前提下被添加。

---

## 2. Plugin 系统（Legacy）

### 2.1 设计动机

**核心约束**：重构初期，最高优先级是利用 PocketBase 原生 CRUD 消除 ~2400 行 NestJS 模板代码。扩展系统需要尽快落地，但不能增加 Go 编译负担。

**设计选择**：纯前端模板 + JSVM 后端。不依赖 Astro 编译、不需要 Tailwind 重建、不需要 Go 重新编译。插件作者只需写 HTML + `.pb.js` 文件。

### 2.2 架构演进：两个阶段

#### Phase A — 老模式（手写 CRUD + 手写路由）

最早期的 Plugin 设计，每个插件需要：

| 层       | 实现                                        | 代码量           |
| -------- | ------------------------------------------- | ---------------- |
| 数据层   | `onBootstrap` 运行时建表                    | ~30 行           |
| API 层   | `routerAdd` 手写 list/create/delete         | ~200 行          |
| UI 层    | 手写三条 `routerAdd`（public/admin/static） | ~30 行           |
| **总计** |                                             | **~260 行/插件** |

问题很明显：代码膨胀严重，每个插件重复大量样板代码（认证检查、参数解析、分页、错误处理）。

#### Phase B — 新模式（servePlugin + Go migration + pb 原生 CRUD）

为了把 260 行压缩到 ~20 行，做了三件事：

1. **Collection 由 Go migration 创建** — 编译时随二进制分发，消除 `onBootstrap` 时序竞态
2. **CRUD 走 PocketBase 原生 API** — `/api/collections/{name}/records` 自动提供完整 CRUD + 分页 + 过滤 + 权限
3. **页面路由由 `$vanblog.servePlugin(name)` 一行注册** — Go 侧自动注册 public/admin/static 三条路由 + nav items

```javascript
// 新模式下的完整插件代码
$vanblog.servePlugin("moments");

onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("author", e.auth.id);
  }
}, "moments");
```

这依赖一个 Go 兼容层：`vault/internal/plugins/plugins.go`，通过 `plugins.Manager.Bind()` 向 JSVM 注入 `$vanblog` 全局对象，提供 8 个 helper：`servePlugin`、`readManifest`、`buildPageData`、`renderTemplate`、`serveStatic`、`addNavItems`、`getNavItems`、`readFile`。

### 2.3 遇到的问题

#### 问题 1：JSVM 时序竞态

PocketBase 0.39.5 上，`onBootstrap` 创建 collection 存在时序竞态——JSVM hook 可能在 migration 完成前执行，导致 `findCollectionByNameOrId` 失败。

**影响**：插件首次安装时 collection 创建可能失败，需要重启容器才能恢复。

**缓解**：迁移到 Go migration（随二进制编译，PocketBase 启动时按时间戳顺序执行，已执行过的不重复跑）。但第三方插件无法发版 Go 代码，仍需 `onBootstrap` fallback。

#### 问题 2：pb 0.39 Breaking Changes

- JSVM 不再自动注册，需在 `main.go` 显式调用 `jsvm.MustRegister(app, jsvm.Config{})`
- `--hooksDir` CLI flag 被移除，需自行在 `main.go` 注册
- 这些 breaking change 是**静默的**——编译通过但 hook 不执行，没有错误日志

#### 问题 3：自定义 Go helper 层（$vanblog）

`$vanblog` 命名空间是 Go 与 JSVM 的紧耦合点：

- 每个 helper 需要在 Go 侧实现、注册、维护类型声明（`vanblog.d.ts`）
- `servePlugin` 内部逻辑复杂：捕获插件名 → `OnServe` 时注册三条路由 + auth guard + nav items → 调用 `readManifest` + `buildPageData` + `renderTemplate`
- Go template 渲染 HTML 是一条**独立于 Astro 的渲染管线**，无法共享组件、布局、样式
- 8 个 helper 的 API 表面积极大，维护成本高

#### 问题 4：HTML fragment 与主应用割裂

Plugin 页面由 Go template 渲染为纯 HTML，通过 `/_plugin/{name}/render` 返回 JSON envelope（`{html, title, scripts, styles}`），再由 Astro 侧的动态路由 `app/src/pages/p/[plugin].astro` 注入到页面中。

这导致：

- **视觉不一致**：Plugin 页面无法使用 Astro 组件、共享 Layout、Tailwind 类名
- **类型不安全**：前端没有 TypeScript 类型检查，数据通过 `{{.User.id}}` Go template 注入
- **渲染管线复杂**：Go render → JSON → Astro inject → 浏览器，三层跳转
- **SEO 差**：HTML fragment 通过 JS 注入，搜索引擎可能无法正确索引

#### 问题 5：Symlink 安装与 Docker 不友好

插件通过 symlink 注册：

```bash
ln -s ../../plugins/{name}/{name}.pb.js vault/pb_hooks/{name}.pb.js
```

- Docker 镜像需要 `COPY plugins /plugins`，但插件源码在 `plugins/` 目录，与 `vault/pb_hooks/` 分离
- Symlink 在不同 OS/文件系统行为不一致
- 没有版本管理、没有验证、没有原子性保证

#### 问题 6：manifest.json 职责过载

一个 `manifest.json` 同时承担：插件元数据（name/title/description/version）、路由配置（routes.public/admin）、资源声明（scripts/styles）。这不是"身份标识"，而是一个跨系统 manifest，难以演进。

#### 问题 7：没有 Source/Artifact/Runtime 分离

Plugin 源码直接在 runtime 执行——没有构建步骤、没有 artifact 验证、没有"source 需要 build 才能运行"的概念。这意味着：

- 无法安全地让用户自定义前端代码（XSS 风险）
- 无法做前端优化（tree-shaking、minification）
- 无法保证 source 与 runtime 的兼容性

### 2.4 经验总结

| 教训                              | 说明                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| **不要建平行渲染管线**            | Go template HTML 渲染与 Astro 割裂，维护两套系统            |
| **Go migration > onBootstrap**    | 编译时安全 + 无时序竞态，但牺牲了第三方插件的运行时建表能力 |
| **不要注入自定义 Go→JSVM helper** | `$vanblog` 是耦合点，API 表面积大，维护成本高               |
| **PocketBase 原生 CRUD 足够**     | 99% 的场景不需要手写 `routerAdd`，collection rules 控制权限 |
| **symlink 不是安装方案**          | 需要原子性、验证、版本管理的正式安装流程                    |
| **pb breaking change 是静默的**   | 编译通过 ≠ 功能正常，必须验证所有功能路径                   |

---

## 3. Pack 系统（Current）

### 3.1 设计动机

Plugin 系统的核心问题不是"功能不够"，而是"架构方向错误"——它试图在 Astro 之外建一套独立的渲染和路由系统。Pack 的设计前提是：**扩展系统应该组合现有运行时（PocketBase / Astro / Caddy），而不是替代它们。**

### 3.2 核心概念

#### Pack = 身份 + 文件系统

```go
type Pack struct {
    Name    string
    Version string
    FS      fs.FS
    Source  Source  // Builtin | Local
}
```

Pack 不携带行为——它只是"一组有名字、有版本的文件"。行为由各 host 的 adapter 独立消费：

```
Pack kernel -> []Pack

Schema adapter    reads schema.ts
Migration adapter reads migrations/
Hook adapter      reads hooks/
Astro adapter     reads pages/ or an Astro project
Admin adapter     reads admin/
Asset adapter     reads assets/
Caddy             consumes only deployed frontend targets
```

没有通用 `Adapter` 接口，没有中心化 `ResolvedPack` 对象。每个 host 定义自己的窄输入类型。

#### Source / Artifact / Runtime 三层分离

| 层           | 职责                                                      | 谁操作                         |
| ------------ | --------------------------------------------------------- | ------------------------------ |
| **Source**   | 作者控制的 Pack 文件（pack.json, hooks, pages, assets）   | `vanblog pack` CLI / dev image |
| **Artifact** | 构建产出的 runtime 契约（前端编译结果、hash、兼容性标记） | dev-image builder（未来）      |
| **Runtime**  | 验证 artifact → 加载/跳过+warning → 服务                  | 生产服务器                     |

**关键规则**：Runtime **永不**安装依赖、**永不**运行包管理器、**永不**构建 Pack source。

#### 整体替换（Whole-Pack Replacement）

```text
local bookmarks exists -> use local bookmarks
otherwise              -> use builtin bookmarks
```

不做文件级 overlay。Local Pack 替换整个 Builtin Pack，所有权和调试链路清晰。

#### 最小身份文件

```json
{
  "name": "bookmarks",
  "version": "1.0.0"
}
```

只是身份标识，不是跨系统 manifest。路由、脚本、样式由各自的 adapter 独立处理。

### 3.3 Pack 如何解决 Plugin 的问题

| Plugin 的问题                     | Pack 的解决方案                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| JSVM 时序竞态                     | Go migration 随二进制编译（Builtin Pack）；Local Pack 的 JS migration 是未来功能                                       |
| pb 0.39 breaking changes          | Pack hook 只用 pb 原生 API（`$app`, `onRecord*`），不依赖自定义注入                                                    |
| 自定义 Go helper 层 ($vanblog)    | **完全移除**。Pack hook 使用 pb 原生全局 API，不需要 `$vanblog` 命名空间                                               |
| HTML fragment 与主应用割裂        | Pack 页面是 `.astro` 文件，通过 `vanblog:theme` host 组合到主应用，共享 Layout/Tailwind/组件                           |
| Symlink 安装                      | `vanblog pack add` 原子复制 builtin source 到 managed local 目录；严格验证（symlink 拒绝、path escape 拒绝、大小限制） |
| manifest.json 职责过载            | `pack.json` 携带身份 + 可选展示元数据(title/nav/frontend)。资源约定由目录结构表达(hooks/, pages/, assets/)             |
| 没有 Source/Artifact/Runtime 分离 | 明确三层分离。Runtime 跳过需要 build 的 local Pack 并 warning，不执行 source                                           |
| Nav 聚合端点复杂                  | `getNavItems()` 返回空数组，`/_plugin/nav` 已删除。导航由 site config 或 Pack page 路由自然表达                        |

### 3.4 当前实现状态（Pack v0）

以 `bookmarks` 为第一个验证用例：

```
packs/bookmarks/
├── pack.json          # {"name":"bookmarks","version":"1.0.0", ...可选 title/nav/frontend}
├── hooks/
│   └── bookmarks.pb.js    # onRecordBeforeCreateRequest → 自动填充 owner
└── pages/
    └── index.astro        # /p/bookmarks，使用 vanblog:theme host
```

**Go Pack kernel**（`vault/internal/pack/`）：

| 文件          | 职责                                                             |
| ------------- | ---------------------------------------------------------------- |
| `pack.go`     | `Pack` struct、`Validate()`、`Inspect()`                         |
| `source.go`   | `Source` enum、`Builtins()` 从 embed.FS 加载 builtin Pack        |
| `discover.go` | `LoadLocal()`、`DiscoverLocal()`、`Resolve()` 合并 builtin+local |
| `hooks.go`    | `StageHooks()` 原子暂存 core hooks + Pack hooks                  |
| `add.go`      | `Add()` 原子复制 builtin Pack 到 local 目录                      |
| `v0.go`       | `RuntimeLoadableV0()` 运行时可加载性检查                         |

**main.go 集成**（`OnServe` 回调）：

```go
// 1. 加载 builtin Packs（从 /packs embed.FS）
builtins, _ := pack.Builtins(os.DirFS(builtinPacksDir))
// 2. 加载 local Packs（可选，--packsDir）
locals, _ := pack.DiscoverLocal(packsDir)
// 3. 合并（whole-Pack replacement）
resolved, _ := pack.Resolve(builtins, locals)
// 4. 运行时可加载性检查（跳过需要 build 的 local Pack）
loadable, warnings, _ := pack.RuntimeLoadableV0(resolved)
// 5. 原子暂存 hooks
pack.StageHooks(coreHooksDir, loadable, staging)
```

**Moments 的处理**：

Moments 的 legacy UI/fragment 已删除，但 collection + model + migration + author hook 保留为 core hook：

```javascript
// vault/pb_hooks/moments.pb.js（当前）
onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("author", e.auth.id);
  }
}, "moments");
```

不再有 `$vanblog.servePlugin("moments")`。如果未来需要恢复 `/p/moments` 页面，应走 Pack/Astro composition 方案。

### 3.5 Pack 的缺点与限制

| 缺点                             | 说明                                                                                            | 缓解/未来方向                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Pack 页面需要编译**            | `.astro` 文件不能像 plugin HTML 那样改了就刷新，需要 Astro build                                | dev image 提供 HMR；生产接受"build 后部署"的模型                                                                      |
| **Local Pack 前端需 dev image**  | 含 `pages/`/`admin/`/`package.json`/`astro.config.*` 的 local Pack 在 runtime 被跳过            | 明确的 warning + `vanblog pack build` 指引；启动摘要保持安全且不输出源码；未来 builder 自动化                         |
| **Lifecycle 不是运行时插件控制** | Pack 是构建/部署期 whole unit；`status` / `plan` 只读诊断，不会驱动任何 backup/migration 执行器 | v1 撤回了 callback-based `ExecutePlan` 死代码；如需修改 collection，走 `vault/pb_migrations/` Go migration 随镜像发布 |
| **Go migration 不能动态加载**    | Builtin Pack 的 Go migration 编译进二进制；Local Pack 无法提供 Go migration                     | 未来支持 PocketBase JS migration                                                                                      |
| **整体替换，不能部分覆盖**       | 想改一个 hook 必须复制整个 Pack                                                                 | 这是有意的设计——保持所有权清晰                                                                                        |
| **路由命名空间受限**             | Pack 页面只能用 `/p/<pack>` 和 `/p/<pack>/:id`                                                  | 消除了通用路由优先级语言的需求                                                                                        |
| **没有第三方插件市场**           | Pack v0 是 trusted/admin-controlled，不是沙箱                                                   | 未来可能有 signed remote Pack artifact                                                                                |
| **没有 admin SPA 集成**          | Pack `admin/` 资源保留给未来阶段                                                                | Admin SPA 是独立的前瞻性工作                                                                                          |
| **概念开销**                     | Source/Artifact/Runtime 三层 + whole-Pack replacement + adapter ownership                       | 对小项目可能 over-engineered，但对可维护性必要                                                                        |

---

## 4. Plugin vs Pack 对比

### 4.1 架构对比

| 维度           | Plugin (Legacy)                                         | Pack (Current)                                                      |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| **身份文件**   | `manifest.json`（name, title, routes, scripts, styles） | `pack.json`（name, version + 可选 title/nav/frontend）              |
| **数据层**     | `onBootstrap`（老）→ Go migration（新）                 | Go migration（builtin）；JS migration（未来，local）                |
| **API 层**     | `routerAdd` 手写 CRUD（老）→ pb 原生 API（新）          | pb 原生 API                                                         |
| **业务 hook**  | JSVM `onRecord*`                                        | JSVM `onRecord*`（相同）                                            |
| **UI 层**      | Go template HTML fragment → JSON → Astro inject         | `.astro` 文件编译进主应用                                           |
| **Go 依赖**    | `vault/internal/plugins/plugins.go`（8 个 helper）      | 无（Pack kernel 只做 list/validate/resolve/stage）                  |
| **安装方式**   | symlink + `COPY plugins /plugins`                       | `vanblog pack add` 原子复制                                         |
| **生命周期**   | 源码直接在 runtime 执行                                 | Source → Artifact → Runtime 三层分离                                |
| **路由注册**   | `$vanblog.servePlugin(name)` 一行注册三条路由           | Astro adapter 静态注入 `/p/<pack>`                                  |
| **导航**       | `/_plugin/nav` 聚合端点 + `addNavItems`                 | `getNavItems()` 返回空数组（site config 控制）                      |
| **覆盖模型**   | 文件级 symlink                                          | 整体替换（whole-Pack replacement）                                  |
| **验证**       | 无                                                      | 严格 name/version pattern、symlink 拒绝、path escape 拒绝、大小限制 |
| **热更新**     | `.pb.js` + HTML 模板可热更新                            | `.pb.js` 可热更新；`.astro` 需重新编译                              |
| **第三方扩展** | 支持（symlink + tar.gz 分发）                           | v0 不支持（trusted/admin-controlled only）                          |

### 4.2 代码量对比

以 bookmarks 功能为例：

| 文件       | Plugin (Legacy)                                                                     | Pack (Current)                                                 |
| ---------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Hook       | `{name}.pb.js`：`$vanblog.servePlugin("bookmarks")` + `onRecordBeforeCreateRequest` | `hooks/bookmarks.pb.js`：`onRecordBeforeCreateRequest`（7 行） |
| 前端       | `frontend/index.html` + `frontend/admin.html`（Go template HTML，~100 行/页）       | `pages/index.astro`（50 行，TypeScript + Astro 组件）          |
| 身份       | `manifest.json`（~15 行，含 routes/scripts/styles）                                 | `pack.json`（~8 行，含可选 title/nav）                         |
| Go 兼容层  | `vault/internal/plugins/plugins.go`（~150 行）                                      | 无                                                             |
| Astro 桥接 | `app/src/pages/p/[plugin].astro` + `plugin-loader.ts`（~100 行）                    | 无（Astro adapter 静态注入）                                   |
| **总计**   | **~380 行 + 150 行 Go**                                                             | **~60 行**                                                     |

### 4.3 hook 对比

**Plugin hook（Legacy）**：

```javascript
// 需要调用 $vanblog.servePlugin 注册路由
$vanblog.servePlugin("bookmarks");

// 业务 hook 与 Pack 相同
onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("owner", e.auth.id);
  }
}, "bookmarks");
```

**Pack hook（Current）**：

```javascript
// 不需要 $vanblog，只用 pb 原生 API
onRecordBeforeCreateRequest(function (e) {
  if (e.auth && e.auth.id) {
    e.record.set("owner", e.auth.id);
  }
}, "bookmarks");
```

### 4.4 前端页面对比

**Plugin 页面（Legacy，Go template HTML）**：

```html
<!-- plugins/bookmarks/frontend/index.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>{{.Title}}</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      // 手写 fetch + DOM 操作，无类型安全
      fetch("/api/collections/bookmarks/records?perPage=100")
        .then((r) => r.json())
        .then((data) => {
          /* 手动渲染 DOM */
        });
    </script>
  </body>
</html>
```

**Pack 页面（Current，Astro）**：

```astro
---
import { Page } from 'vanblog:theme';
import { BookmarkSchema, type Bookmark } from '@vanblog/sdk';

export const prerender = false;

let bookmarks: Bookmark[] = [];
try {
  const result = await Astro.locals.pb.collection('bookmarks').getList(1, 100, {
    sort: '-created',
  });
  bookmarks = result.items.flatMap((item) => {
    const parsed = BookmarkSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
} catch {}
---
<Page title="收藏">
  <ul>
    {bookmarks.map((b) => <li><a href={b.url}>{b.title}</a></li>)}
  </ul>
</Page>
```

Pack 页面享受：TypeScript 类型安全、Zod schema 验证、Astro 组件系统、共享 Layout/Tailwind、SSR 渲染。

---

## 5. 已删除的 Legacy 代码

以下代码已在 Pack v0 收尾中删除：

| 删除项                          | 位置                                         | 替代方案                                            |
| ------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Plugin manifest + HTML fragment | `plugins/moments/**`                         | Moments collection 保留为 core model，UI 待 Pack 化 |
| Astro 动态 plugin 页面          | `app/src/pages/p/[plugin].astro`             | Pack `.astro` 文件静态注入                          |
| Astro 动态 admin plugin 页面    | `app/src/pages/admin/plugins/[plugin].astro` | 未来 admin SPA                                      |
| Plugin loader                   | `app/src/lib/plugin-loader.ts`               | 不需要——Astro adapter 直接注入                      |
| Go plugin 兼容层                | `vault/internal/plugins/**`                  | Pack kernel（`vault/internal/pack/**`）             |
| Plugin nav 端点                 | `vault/pb_hooks/plugins.pb.js`               | `getNavItems()` 返回空数组                          |
| `$vanblog` JSVM 命名空间        | `vanblog.d.ts` 中的 plugin helper 声明       | 仅保留 core hook 数据类型                           |
| Docker plugin 复制              | `Dockerfile: COPY plugins /plugins`          | `COPY packs /packs`（builtin Pack source）          |

**保留的 Legacy 数据层**：

| 保留项                                                        | 原因                               |
| ------------------------------------------------------------- | ---------------------------------- |
| `vault/pb_migrations/1783000000_create_moments_collection.go` | Moments collection 数据不删除      |
| `vault/pb_hooks/moments.pb.js`（author hook）                 | 创建 moments 记录时自动填充 author |
| SDK moments model                                             | 数据模型保留                       |

---

## 6. 未来方向

Pack v0 是最小可验证闭环。未来独立评估的方向：

1. **Admin SPA + Pack admin 模块** — 将 admin 从 Astro 迁移到独立 SPA，Pack 可贡献 admin 扩展模块
2. **完整主题 Pack** — 一个主题本身是一个 Astro 项目，Pack kernel 解析 active theme + Pack page extensions
3. **运行时加载外部 Zod bundle** — `ModelSource` 接口支持从 data 目录加载编译好的 schema bundle
4. **Instance npm endpoint** — admin-only 的 npm 兼容端点，输入为当前 resolved Pack set + pb schema snapshot
5. **Signed remote Pack artifact** — 签名的远程 Pack 安装生命周期
6. **Pack 依赖/所有权迁移** — 当具体用例需要时

---

## 7. 给维护者的实践指引

### 7.1 新增功能时选 Plugin 还是 Pack？

**统一选 Pack。** Plugin 系统的代码路径已全部删除，不再有 `plugins/` 目录、`$vanblog` helper、Go template 渲染管线。

### 7.2 添加一个新 Pack 的步骤

1. 在 `packs/` 下创建目录：`packs/{name}/`
2. 创建 `pack.json`:`{"name":"{name}","version":"1.0.0"}`(可选追加 `title`/`nav`/`frontend`)
3. 创建 Go migration：`vault/pb_migrations/{timestamp}_create_{name}_collection.go`
4. 创建 Pack hook（可选）：`packs/{name}/hooks/{name}.pb.js`
5. 创建 Pack 页面（可选）：`packs/{name}/pages/index.astro`（路由自动映射到 `/p/{name}`）
6. 在 `vault/internal/pack/source.go` 的 `Builtins()` 中注册新 Pack
7. 在 `app/astro.config.mjs` 中注册 Pack 的 Astro 集成

### 7.3 常见陷阱

- **不要在 Pack hook 中使用 `$vanblog.*`** — 该命名空间已删除，只用 pb 原生 API
- **不要在 Pack 中手写 CRUD 路由** — PocketBase 原生 `/api/collections/{name}/records` 自动提供
- **Local Pack 含前端源码会被 runtime 跳过** — 需要通过 dev image build 产出 artifact
- **Pack name 必须全小写** — `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`
- **Pack version 必须是 SemVer** — `^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)...`
