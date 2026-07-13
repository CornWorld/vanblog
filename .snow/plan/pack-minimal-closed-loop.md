# Vanblog Pack 最小闭环实施方案

## Context

Vanblog 已有一套“插件”雏形：`plugins/moments` / `plugins/bookmarks` 提供 JSON Manifest、PB JSVM hooks 与 HTML fragment，`vault/internal/plugins/plugins.go` 负责运行时模板和路由，Astro 通过 `/p/[plugin]` 与 `/admin/plugins/[plugin]` 动态包装 fragment；同时 PB 官方 Go migrations、用户 JS migrations、Zod v4 models→Vite CJS→Go embed、Astro 单应用 Node SSR、Caddy JSON config builder 已各自独立存在。

本方案把它收敛为 **Pack**：一个被仓库/镜像所有、在构建时发现并解析、横切 PocketBase、Astro、Caddy 的最小功能截面。Pack 不是独立应用容器，也不是 Java 式声明平台；核心只描述身份与入口存在性，系统细节由各 adapter 按目录约定解析。首个闭环选择 `moments`，将其从“PB 渲染 HTML fragment”迁移为真正参与 Astro build-time composition 的 feature overlay，同时保留 PB 原生 CRUD、JSVM hooks 和 Caddy→Astro 总体路由。

### 最小闭环与明确边界

闭环定义：**发现本地 Pack → 校验/解析 → PB migration 建表并加载 hooks → Astro 在构建时合成页面/导航/前端资源 → Caddy 路由可达 → dev/prod 均可启动并完成 moments CRUD**。

只做到：本地内置 Pack、启动/构建时发现、校验、确定性排序、启用（存在即启用）、状态解析、构建与启动失败可诊断。明确不做：远程商店、下载/签名分发、运行时安装、数据库驱动启停、复杂 capability/权限系统、依赖求解、多版本共存、卸载/down migration、多进程协调、Pack 独立 Node/Go 服务、任意 Caddy JSON 注入、运行时替换 Astro 路由。

## Analysis

- **现状关键文件**
  - `plugins/moments/manifest.json`：现有字段偏多且混入各系统配置，是收敛对象。
  - `plugins/moments/moments.pb.js`：JSVM hooks 与 `$vanblog.servePlugin()` 耦合；业务 hooks 可复用，页面注册应移出 PB。
  - `vault/pb_migrations/1783000000_create_moments_collection.go`：官方 migration 已建立 moments schema，但不在 Pack 目录，需建立 Pack 所有权约定。
  - `vault/internal/plugins/plugins.go`：现有运行时 fragment/静态文件机制；最小闭环后缩为兼容层或删除 moments 对它的依赖。
  - `app/src/pages/p/[plugin].astro`、`app/src/pages/admin/plugins/[plugin].astro`、`app/src/lib/plugin-loader.ts`：当前通用动态 fragment 路径；不能满足 Astro 源码级 composition。
  - `app/src/layouts/BaseLayout.astro`：运行时从 PB 取 plugin nav；应改为 build-time resolved Pack nav，并保留站点动态数据。
  - `app/src/layouts/AdminLayout.astro`：管理后台统一鉴权与禁用缓存边界，应继续由 core 持有。
  - `app/astro.config.mjs`：接入 Pack Astro integration/Vite plugin 的构建入口。
  - `vault/internal/caddy/config_builder.go`：当前系统路由→用户规则→Astro fallback 顺序明确，是 Pack route adapter 的合并点。
  - `Dockerfile`、`docker/entrypoint.dev.sh`、`docker/entrypoint.prod.sh`：目前 Astro build stage 未复制 `plugins/`，生产镜像也未明确复制 Pack hooks；需统一 Pack root。
  - `models.config.mjs`、`vault/internal/validation/validation.go`：保持现有 Zod map→CJS→embed 链路；Pack v1 不允许动态扩充 core models map，Pack collection validation 由 PB schema/rules/hooks 承担。
- **拟新增文件**
  - `vault/internal/pack/pack.go`：最小 `Pack`、`ResolvedPack`、adapter 接口与 resolver。
  - `vault/internal/pack/discover.go`、`discover_test.go`：目录发现、名称/路径校验、稳定排序。
  - `vault/internal/pack/pocketbase.go`、`pocketbase_test.go`：PB adapter resolved state 与 hooks 装载清单。
  - `vault/internal/pack/caddy.go`、`caddy_test.go`：受限 Caddy route intent→`UserRule`/route 的适配。
  - `app/integrations/packs/index.mjs`、`resolver.mjs`：Astro integration、冲突检查、虚拟模块生成、watch invalidation。
  - `app/src/pack-runtime/types.ts`：前端只读 resolved state 类型。
  - `plugins/moments/pack.json`、`plugins/moments/astro/pages/p/moments.astro`、`plugins/moments/astro/components/*`：首个源码级 feature overlay。
- **Dependencies**：不新增运行时框架；复用 Go stdlib、PocketBase、Astro integration hooks、Vite plugin API、现有 Caddy `caddyadmin` structs。JSON 仅承载最小 Pack identity；系统配置主要靠目录约定与代码导出。
- **Complexity**：complex（跨 Go/PB、Astro/Vite、Caddy、Docker，但刻意限制为单 Pack/单进程闭环）。
- **Risk areas**：Astro 文件路由在 config 完成前即扫描，不能只靠 virtual module“创造页面”；SSR server/client import 边界；dev watcher 对仓库外 `app/` 的 Pack 文件监听；official migration 的编译期注册与外挂 Pack 的矛盾；Caddy 路由优先级和 reserved paths；旧 plugin HTML 中 `set:html` 的 XSS 风险。

## 核心设计

### 1. 核心 Pack 定义：最小字段

`plugins/<name>/pack.json` 仅保留：

```json
{
  "name": "moments",
  "version": "1.0.0"
}
```

Go 定义保持最小：

```go
type Pack struct {
    Name    string `json:"name"`
    Version string `json:"version"`
    Root    string `json:"-"`
}

type ResolvedPack struct {
    Pack
    PocketBase *PocketBaseState
    Astro      *AstroState
    Caddy      *CaddyState
}

type Adapter interface {
    Resolve(context.Context, Pack) (any, error)
}
```

实际实现避免到处做 `any` 类型断言，可采用一个小型 orchestrator 持有三个窄接口：

```go
type PocketBaseAdapter interface { ResolvePB(context.Context, Pack) (*PocketBaseState, error) }
type CaddyAdapter interface { ResolveCaddy(context.Context, Pack) (*CaddyState, error) }
```

Astro adapter 用 JS 实现同一语义，不强行跨语言共享接口/序列化 schema。`title`、导航、页面路径等属于 Astro adapter 导出的 typed metadata，不进入核心 Pack。`author`、description、依赖、权限、安装脚本均不进入 v1。

### 2. 目录约定

```text
plugins/<name>/
  pack.json                         # 唯一最小描述文件
  pocketbase/
    hooks/*.pb.js                   # JSVM hooks，按文件名稳定排序
    migrations/                     # v1 官方内置 Pack 可有 Go 源码；用户 Pack 只支持 JS migration
      *.go | *.js
  astro/
    pack.ts                         # title/nav/layout intent 等小型 typed export
    pages/**                        # feature overlay 页面，路径相对 app/src/pages
    components/**                   # Pack 私有组件
    styles/**                       # 由页面/pack.ts 显式 import
    public/**                       # 复制到 /packs/<name>/，禁止覆盖 core public
  caddy/
    routes.json                     # 可选、受限 route intents；多数 overlay Pack 不需要
```

约定优先于声明：目录不存在即 adapter state 为 nil。Pack name 必须匹配 `^[a-z][a-z0-9-]{0,62}$` 且等于目录名；所有解析使用 `filepath.Rel`/realpath containment，拒绝 symlink 逃逸。发现顺序按 name 排序，保证构建可复现。

### 3. Resolved state（只含宿主真正需要的信息）

- `PocketBaseState{HookFiles []string, JSMigrations []string, BuiltinMigrationPackage string}`；不复制 collection 大 Manifest。
- `AstroState{Entry string, Pages []Page, PublicDir string}`；`Page{Route, Source, Kind(public|admin), Layout(core|none)}`，其中 title/nav 从 `pack.ts` 进入 Vite virtual module。
- `CaddyState{Routes []RouteIntent}`；最小 intent 仅允许 `path` + `target`（`astro` 或 `pocketbase`）+ 可选 strip prefix，不接受原始 handler JSON。
- resolver 产出内存态；构建时可生成 `.astro/packs/resolved.json` 作为诊断缓存，但它不是用户编辑的 Manifest，也不作为运行时权威源。

## Phases

### Phase 1: 建立 Pack kernel、发现规则与 moments 所有权
- **Goal**：用最小定义替代现有胖 Manifest，并让 PB 侧能从同一 Pack root 得到确定的 resolved state。
- **Files**：`vault/internal/pack/{pack.go,discover.go,pocketbase.go,*_test.go}`（新建），`vault/main.go`，`plugins/moments/pack.json`（新建），`plugins/moments/pocketbase/hooks/moments.pb.js`（迁移），`vault/pb_migrations/1783000000_create_moments_collection.go`（保留注册入口/标注所有权），`plugins/moments/manifest.json`、`plugins/moments/moments.pb.js`（闭环切换后删除或暂留兼容）。
- **Steps**：
  - [ ] 实现 `Discover(root)`：只读一级目录、解析两字段 JSON、校验目录名/重复名/semver 基本格式、realpath containment，并按 name 排序；缺 adapter 目录不是错误，非法 Pack 构建/启动 fail fast。
  - [ ] 实现 PB adapter：发现 `pocketbase/hooks/*.pb.js` 与用户 JS migrations；将聚合后的 hooks 目录通过启动前 staging（建议 `/pb_data/.vanblog/packs/hooks`，原子重建）交给现有 `jsvm.MustRegister`，不要为每个 Pack 建 VM 或 watcher。
  - [ ] moments 保持现有 Go migration 为 **official/builtin migration**（Go migration 必须编译进二进制，不能假装运行时加载）；把 JS hook 移到 Pack 目录，移除 `$vanblog.servePlugin("moments")`，保留 author/audit hooks。用户 Pack v1 只能提供 PocketBase 官方 JS migration。
  - [ ] 在 `main.go` 以 `--packsDir`（兼容读取旧 `--pluginsDir` 一版）初始化 resolver；PB 启动只消费 resolved hooks/migrations，不承担 Astro 页面注册。
- **Done when**：发现测试覆盖合法/重复/逃逸/缺目录/排序；临时 PB 数据库执行 official moments migration；JSVM 加载 Pack hook 后创建记录能自动填 author 并写 audit；`go test ./internal/pack/... ./internal/plugins/...` 与 `go test ./...` 通过。

### Phase 2: Astro build-time composition（核心闭环）
- **Goal**：让 moments 成为 Astro 单应用 SSR 的源码级 feature overlay，而不是 PB 返回的 HTML fragment。
- **Files**：`app/integrations/packs/{index.mjs,resolver.mjs,resolver.test.mjs}`（新建），`app/src/pack-runtime/{types.ts,registry.ts}`（新建），`app/astro.config.mjs`，`app/src/layouts/BaseLayout.astro`，`app/src/layouts/AdminLayout.astro`，`plugins/moments/astro/pack.ts`、`plugins/moments/astro/pages/p/moments.astro`、`plugins/moments/astro/components/*`（新建），`app/src/pages/p/[plugin].astro`、`app/src/pages/admin/plugins/[plugin].astro`、`app/src/lib/plugin-loader.ts`（兼容边界调整），`app/package.json`。
- **Steps**：
  - [ ] **页面合成机制**：Astro integration 在 `astro:config:setup` 之前解析 `plugins/*/astro/pages/**`，把每个页面以确定性方式 materialize/link 到 `app/.astro/packs/pages/<pack>/...`，再用 integration 的 page injection API（Astro 6 优先 `injectRoute`；若该 API 不接受任意 `.astro` 文件，则生成固定 core catch-all route 并由 virtual registry 静态 import 映射）。不要把源码复制进 `src/pages`，避免污染 Git。生成物只在 `.astro/`。
  - [ ] **路由冲突规则**：先枚举 core `app/src/pages` 的 route pattern，再枚举 Pack pages；exact route、同等动态 pattern（如 `[id]` vs `[slug]`）、rest route 覆盖均在 build 前报错。core 永远优先且 Pack 不允许 `/api/*`、`/_/*`、`/admin` core 路由、`/login`、`/setup`、`/404`；Pack 间不设 priority，冲突即失败，按 pack name 输出双方源文件。
  - [ ] **Vite virtual modules**：插件提供 `virtual:vanblog/packs`（仅 JSON-safe `name/version/nav/routes`）、`virtual:vanblog/pack-pages`（构建器生成的静态 import map）和类型声明。服务端 Astro 页面可 import 完整 registry；浏览器 bundle 只能 import client-safe metadata，严禁把绝对路径、PB secret、server-only modules带入 client。`BaseLayout` 改用 build-time nav registry，不再请求 PB plugin nav；动态 site/nav core 数据保持原逻辑。
  - [ ] **layout 与主题边界**：feature overlay 页面自己显式 import core `BaseLayout`；admin overlay 必须显式使用 `AdminLayout`，继续继承 middleware `/admin/*` 鉴权和 `Astro.cache.set(false)`。Pack 不能 shadow/patch layout。v1 只实现 feature overlay；“完整前端主题”定义为未来另一种互斥 build profile（可替换 public page set/layout，但绝不替换 admin），本阶段不实现，避免 theme 与 feature overlay 的冲突矩阵。
  - [ ] **SSR/HMR/artifact**：Pack 页面参与同一个 `@astrojs/node` standalone SSR build，不能单独 bundle/启动；integration 调用 `addWatchFile` 并在 Vite `configureServer` 监听 `${packsDir}/**`，metadata 变化 invalidates virtual modules，`.astro` 新增/删除触发一次受控 server restart，普通组件修改走 Vite HMR。生产 `dist/server`/`dist/client` 必须已包含编译后的 moments 代码与 hashed assets，运行时不依赖 Astro Pack 源码；resolved snapshot 写入 `dist/pack-state.json` 仅供诊断。
- **Done when**：`/p/moments` 是编译后的 Astro SSR 页面，可调用 PB records API并使用 BaseLayout；admin moments 页若纳入首闭环则必须走 AdminLayout 且未登录重定向；删除/制造冲突页面时 build 给出清晰错误；修改 moments component 可 HMR，新增 page 可自动重启后出现；`pnpm --filter vanblog-app build`、`astro check`、现有 cache e2e 通过。

### Phase 3: Caddy adapter、Docker 产物与端到端联通
- **Goal**：将 Pack route intent 安全合并进现有 Caddy 顺序，并确保 dev/prod 镜像得到相同 Pack 集。
- **Files**：`vault/internal/pack/caddy.go`、测试（新建），`vault/internal/caddy/config_builder.go`、`config_builder_test.go`、`translator.go`，`vault/internal/caddy/bootstrap.go`，`Dockerfile`，`docker/entrypoint.dev.sh`、`docker/entrypoint.prod.sh`，`pnpm-workspace.yaml`（仅当 Pack 需要作为 workspace package时；首闭环不需要）。
- **Steps**：
  - [ ] Caddy adapter 只把受限 intent 转为带稳定 ID `vanblog-pack-<pack>-<index>` 的 system-owned routes；禁止目标 URL、任意 headers/handler、`/api/*`、`/_/*`、core admin、安全/健康检查路径。moments 作为 Astro overlay 默认无需专属 Caddy route，`/p/moments` 由现有 Astro fallback 自动闭环；测试用一个显式 fixture route 验证 adapter，避免为展示而增加生产配置。
  - [ ] 扩展 `BuildFullConfig` 输入为 `system Pack routes + system cache + user rules`，顺序固定为 PB reserved routes → Pack routes → cache/user routes → Astro fallback；Pack route 与 user route 冲突采用 reserved ownership，用户不得覆盖。HTTPS、HTTP_ONLY、`:8080` 行为一致；仍经 typed `caddyadmin` structs 与原子 `LoadConfig`。
  - [ ] Docker `astro-build` 明确 `COPY plugins/` 后再 build；Go build 获得 official Pack migration；prod 只复制编译后的 Astro dist、Vanblog binary、Pack PB hooks/JS migrations 所需文件，不复制未使用前端源码。dev 将仓库 Pack root 暴露给 Astro watcher和 PB hooks staging，保留单容器三进程现状，不引入 Pack 进程。
  - [ ] 启动日志一次性输出 resolved Pack 摘要（name/version/adapters），不得输出文件内容、cookie、secret；Caddy sync 失败维持现有 maintenance + `:8080` 恢复语义。
- **Done when**：Caddy config 单测断言顺序、reserved conflict、HTTPOnly parity、无任意 target/SSRF；`docker build --target prod` 和 `--target dev` 均成功；prod 容器不挂载源码也能访问 moments 页面/API；`go test ./internal/caddy/... ./internal/pack/...` 通过。

### Phase 4: 安全、兼容收口与闭环验收
- **Goal**：删除 moments 的旧 fragment 路径依赖，明确所有权，并用端到端测试冻结 v1 生命周期边界。
- **Files**：`vault/internal/plugins/plugins.go` 及测试，`app/src/pages/p/[plugin].astro`、`app/src/pages/admin/plugins/[plugin].astro`、`app/src/lib/plugin-loader.ts`，`plugins/moments/manifest.json`、`plugins/moments/frontend/*`，`plugins/bookmarks/*`，`app/test/pack-moments-e2e.test.mjs`（新建），`vault/scripts/verify_pack_moments.go`（可选新建），`README.md` 或 `docs/*`（仅在实现阶段同步已有插件说明，不新建完成总结文档）。
- **Steps**：
  - [ ] moments 验收后删除旧 `manifest.json`、HTML fragment、`servePlugin` 注册依赖；动态 `[plugin]` renderer 暂留 bookmarks 兼容但明确 deprecated，不在同一阶段强迁 bookmarks，避免闭环扩张。待 bookmarks 迁完再删除 `internal/plugins`。
  - [ ] 固化所有权：Pack root/源码由镜像构建者所有、运行用户只读；Pack 可读写自己的 PB collections 仍完全受 PB collection rules 控制；admin UI、认证 cookie、core layouts、Caddy admin API和 system routes 始终由 core 所有。Pack 前端代码与 core 同等可信（构建期代码执行），不是沙箱，因此仅允许管理员/镜像作者安装，禁止从可写 `pb_data` 自动执行前端源码。
  - [ ] 增加 E2E：匿名读取 visible moments；匿名创建失败；登录创建自动 author；owner/admin 更新删除；public SSR 输出内容；admin 未登录受保护；Caddy `/p/moments` 到 Astro、`/api/collections/moments/records` 到 PB；生产 artifact 在移走源码后仍运行。
  - [ ] 验证 lifecycle 仅有 `discover → resolve → migrate/load hooks → compose/build → serve`；修改 Pack identity/page 需要 dev restart 或 prod rebuild，schema 变化走追加 migration。无 disable/uninstall/rollback/down migration API，无跨进程状态。
- **Done when**：moments 全链路不再调用 `/_plugin/moments/*`；bookmarks 旧路径无回归；全量 `go test ./...`、`pnpm build:models`、`pnpm --filter vanblog-app build`、`astro check`、Pack E2E、dev/prod Docker smoke 全通过；相关文件 IDE diagnostics 无新增 error/warning。

## Astro 机制的关键决策说明

1. **为什么不是仅靠 virtual module**：Vite virtual module 很适合 metadata/import registry，但 Astro 文件路由发现发生在构建管线中，virtual module 本身不会自动成为 route。必须用 Astro integration route injection，或由一个 core catch-all route 根据静态 import map分派。首选 injection，因为它保留 Astro 正常 route chunks、SSR status/redirect和错误定位；catch-all 仅作为 API 限制时的降级方案。
2. **为什么页面显式选择 layout**：自动 AST 包裹 `.astro` 页面脆弱且难调试。feature page 显式 import `BaseLayout`/`AdminLayout` 更符合 Go 式小接口与约定；resolver 只验证 admin route 的 declared kind，测试验证布局/鉴权。
3. **完整主题与 overlay 不混做**：完整主题拥有 public shell/page set，是 build profile；feature overlay只新增不覆盖。admin 永远 core-owned。v1 只交付 overlay，未来主题若实现，应在配置层选择单一 theme，并在 overlay 合成前产出 public base routes。
4. **管理后台边界**：Pack 可贡献 `/admin/packs/<name>/**` 页面和菜单 metadata，但不能替换 `/admin` core 页面、middleware 或 AdminLayout；菜单也来自 build-time registry，不经 PB HTML 注入。
5. **SSR 数据访问**：moments 页面使用 `Astro.locals.pb`/现有 SDK；服务端请求携带当前 cookie，客户端 mutation 使用 `@vanblog/sdk/browser`。不得在 virtual metadata中编码 PB URL/credential。
6. **CSS/资源**：Pack CSS 由页面/组件显式 import，进入 Vite hashed chunks；`astro/public` 统一命名空间 `/packs/<name>/`，禁止覆盖 `/favicon` 等 core 资源。Tailwind v4 对仓库外 source 扫描需在 Pack CSS 或 core global CSS增加明确 `@source`，并以 moments class 构建测试防止生产 CSS 被裁剪。

## PB adapter 细则

- **Migration**：official Pack 的 Go migration继续由 blank import 编译注册，迁移文件可物理保留在 `vault/pb_migrations`（最少改动），但注释与测试声明 owner=`moments`；若移动到 `plugins/moments/pocketbase/migrations-go`，则 Go module/import 和 Docker COPY复杂度上升，不建议首阶段采用。用户 Pack 走 PB 官方 JS migrations目录并 staging；migration 文件只追加不改名，按 PocketBase timestamp 顺序。
- **Schema**：collection schema、API rules和索引属于 migration；不复制进 `pack.json`。resolver 可做静态存在性检查，真正幂等/事务语义交给 PB migration engine。禁止启动 hook“顺便建表”。
- **Hooks**：按 Pack name、文件名排序复制/链接至单 hooks staging root，文件名加 namespace 防碰撞；共享 audit helper由 core `pb_hooks/lib` 提供稳定 contract。JSVM `hooksWatch` 继续只 watch一个目录；dev watcher同步 Pack hook变更到 staging。
- **Zod models**：v1 不让 Pack修改 core `sdk/src/models/index.ts` map；否则任意本地 Pack都会改变 Go embedded validator并强制重编 Go。moments 已有 core model时可继续使用；用户 Pack通过 PB schema/API rules保证数据边界。将 Pack model composition留到后续独立设计。

## 生命周期、安全与所有权

- **生命周期**：生产 build/boot发现；build 解析 Astro；PB boot执行未应用 migration并加载 hooks；Caddy OnServe合并路由。失败策略：非法 Pack/路由冲突/build source错误直接构建失败；PB migration失败阻止服务进入正常态；Caddy加载失败维持maintenance；单个运行时业务hook错误按PB现有语义处理。
- **信任模型**：Pack 是可信构建期代码，不是多租户插件沙箱。只有仓库维护者/镜像构建者能加入；容器中 `/plugins` root-owned read-only，不能通过管理后台上传 JS/TS/Go。
- **路径安全**：所有 adapter都做 root containment、拒绝symlink逃逸和绝对路径；public资源强制namespace；错误日志使用相对路径。
- **网络安全**：Caddy adapter不能声明任意 upstream；只允许枚举 `astro`/`pocketbase` 内部target，复用reserved paths/SSRF测试。Caddy admin仍仅监听`127.0.0.1:2019`。
- **数据所有权**：`moments` collection及其 migrations由moments Pack拥有；core只提供PB、auth、audit helper、SDK transport。无卸载意味着不定义drop collection行为，也不自动执行现有down migration。
- **前端安全**：移除 moments 的`set:html` fragment路径，默认Astro escaping；确需HTML时必须走现有sanitize能力。admin auth不能只靠页面UI，PB rules仍是最终授权边界。

## 测试与验收矩阵

| 层 | 测试 | 验收 |
|---|---|---|
| Resolver | Go/Node fixture tests | 稳定排序、非法name/version、重复、路径逃逸、缺adapter、冲突信息完整 |
| PB | 临时PB DB + migration + JSVM | collection字段/rules正确，author/audit hook工作，匿名写拒绝 |
| Astro | resolver unit + build + SSR smoke | route注入、layout、nav、Tailwind、server/client virtual边界、无源码运行artifact |
| Caddy | config builder golden/struct assertions | HTTPS/HTTPOnly/:8080顺序一致，Pack reserved，fallback仍终止 |
| Docker | dev/prod build + container smoke | dev HMR/restart；prod仅dist即可运行；Pack root只读 |
| 回归 | 全量Go、Astro check、models build、bookmarks旧插件 | 无新增diagnostics，现有博客/admin/cache/Caddy测试通过 |

最终验收命令建议：

```sh
cd /Users/corn/Code/vanblog/vault && go test ./...
cd /Users/corn/Code/vanblog && pnpm build:models
cd /Users/corn/Code/vanblog && pnpm --filter vanblog-app exec astro check
cd /Users/corn/Code/vanblog && pnpm --filter vanblog-app build
cd /Users/corn/Code/vanblog && pnpm --filter vanblog-app test:e2e:cache
cd /Users/corn/Code/vanblog && docker build --target prod -t vanblog:pack-smoke .
cd /Users/corn/Code/vanblog && docker build --target dev -t vanblog:pack-dev-smoke .
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Astro 6 route injection API能力与预期不符 | 无法直接把Pack `.astro`变成文件路由 | 先做最小spike测试；首选官方integration API，降级为单core catch-all +静态import map，不运行时扫描源码 |
| Pack目录在`app`外导致HMR漏监听 | dev修改无反馈 | `addWatchFile` + Vite watcher显式add；新增/删除页面触发受控restart，组件内容走HMR |
| Go migration无法运行时加载 | 用户误以为外挂Pack可带Go schema | 明确official Go / user JS两轨；v1外部Pack仅JS migration，绝不使用Go plugin机制 |
| 旧plugin与新Pack双注册moments | 路由/nav重复或行为不一致 | 切换moments时一次性移除`servePlugin`和旧nav；E2E断言无`/_plugin/moments`调用 |
| Caddy Pack routes覆盖安全路径 | API/admin劫持 | intent枚举target、reserved path检查、稳定system ownership、typed config，无raw JSON |
| Astro Pack代码泄露server secret到client | 凭据泄漏 | 拆分server registry/client-safe metadata virtual module，build测试扫描client artifact |
| Tailwind未扫描Pack class | prod样式缺失 | 显式`@source` Pack路径并对关键class做artifact测试 |
| 生产运行依赖Pack源码 | 镜像膨胀/启动失败 | Astro只消费dist；只保留PB hooks/migrations运行时文件；移走前端源码做smoke |
| migration down删除数据 | 误触发数据损失 | v1无uninstall/down lifecycle；文档与命令层不暴露Pack rollback |

## Rollback Strategy

本方案实施时按Phase独立提交/发布，但**不执行任何自动Git回滚**。若新Astro composition失败，发布层可暂时恢复 moments 的旧`manifest.json`、`moments.pb.js`中的`$vanblog.servePlugin`及动态`[plugin]` renderer，同时保留已创建的moments collection；不要回滚或执行down migration，避免数据丢失。Caddy adapter失败时移除Pack route输入即可回到现有system/user/fallback顺序。PB hooks staging失败时恢复原`hooksDir`配置。任何Git rollback命令均需用户明确授权后执行。

## Alternative Approaches

- **继续PB渲染HTML fragment**：改动小，但不是真正Astro build-time composition，失去组件类型、Vite chunk、SSR集成和安全escaping，不满足目标。
- **每个Pack做独立Astro应用/进程**：隔离更强，但引入多进程、独立部署和Caddy upstream管理，明确超出边界。
- **生成/复制到`app/src/pages`**：容易理解但污染源码、watch与清理脆弱；仅可作为`.astro`临时目录的内部实现，不应写入tracked source。
- **大一统Manifest/schema DSL**：能声明一切，但会重复PB/Astro/Caddy已有模型并造成版本兼容负担；本方案坚持两字段identity +目录约定 + adapter code。
