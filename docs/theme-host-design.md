# Theme Host 设计文档

> **⚠️ 命名变更（2026-08）**：本模块已从「dispatcher」改名为 **theme host**（`app/src/theme-host/index.mjs`，健康端点 `/__theme_host_health`）。它本质是托管多 theme handler 的轻量请求路由宿主，不是重型编排器。本文档（原 `theme-dispatcher-design.md`）与 `theme-host-execution-plan.md` 作为设计历史保留。

> **状态**：**已实现**（2026-08）。核心模型落地：单进程 theme host 动态 import 主题 handler + 按 `site.activeTheme` 热切换。**静态服务已按设计演进为 Caddy file_server**（见 `vault/internal/caddy/static_routes.go`，不再是 theme host sirv）；admin 额外抽离为独立 SSR（`app/`，见 `docs/theme-concepts.md`）。本文档作为设计历史保留。
> **前置阅读**：[`theme-concepts.md`](./theme-concepts.md)、[`theme-implementer-guide.md`](./theme-implementer-guide.md) > **目标**：定义「单进程多 theme handler」的运行模型，让 theme 切换从「重建镜像」降到「<5s 热切换」。

---

## 0. 一句话模型

> **一个 Node 进程**通过 ESM 动态 `import()` 加载多个 theme 的 `dist/server/entry.mjs`，按 `site.activeTheme` 把请求路由给对应 theme 的 `handler`。切换 theme = 动态 import 新 handler + 缓存。Palette 是 theme 的「推荐配置」而非强制约束。

---

## 1. 动机与约束

### 1.1 当前架构的问题

| 问题                                                                               | 影响                        |
| ---------------------------------------------------------------------------------- | --------------------------- |
| `site.activeTheme` 改了，但 `entrypoint.prod.sh:82` 跑的是 `/app/dist`，字段不生效 | 字段成了「骗人的」          |
| 切换 theme 必须 `docker build` + 重启容器                                          | 个人博客场景不可接受        |
| theme 切换的复杂度由用户承担（重建镜像）                                           | UI 心智负担大               |
| palette 和 theme 互相不知道对方                                                    | 跨 theme 切换时颜色配置脱节 |

### 1.2 物理约束（已验证）

| 约束                                                            | 事实依据                                                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `entry.mjs` 导出 `handler`，**可以不启动 http server 独立使用** | `server_fAjPSDVI.mjs:8152` + `ASTRO_NODE_AUTOSTART=disabled` 环境变量                                                          |
| dist 目录**可以整体搬迁**到任意路径                             | `resolveClientDir` (server_fAjPSDVI.mjs:7825-7844) 用 `import.meta.url` + 相对路径，不依赖 `options.client` 里硬编码的绝对 URL |
| ESM 动态 import 多个 entry.mjs **天然隔离**                     | 不同 URL = 不同 module record = 独立的 `_manifest` 实例                                                                        |
| caddy translator **支持热重载路由**                             | `BootstrapSyncFromDB` → admin API → `LoadConfig` 已实现                                                                        |

---

## 2. 整体架构

```
┌─ Browser ────────────────────────────────────────────────────────────┐
│                                                                      │
│   GET /                          (page)                              │
│   GET /_astro/foo.ABC.js         (static, theme-scoped)              │
│   GET /api/posts/123             (data)                              │
└──────┬───────────────────────────────────────────────────────────────┘
       │
       ▼
┌─ Caddy (hot-reload routes via pb admin API) ─────────────────────────┐
│                                                                      │
│   /api/*                      → reverse_proxy 127.0.0.1:8090          │
│  /_/*                        → reverse_proxy 127.0.0.1:8090          │
│   /themes/<name>/static/*     → file_server  (theme-scoped assets)   │
│   /* (catch-all)              → reverse_proxy 127.0.0.1:4321         │
│                                                                      │
└──────┬───────────────────────────────────────────────────────────────┘
       │
       ▼
┌─ Theme Host (single Node process on :4321) ──────────────────────────┐
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  Theme Registry (in-memory Map<name, LoadedTheme>)           │   │
│   │                                                              │   │
│   │  ┌────────────────────────────────────────────────────────┐  │   │
│   │  │ 'default'  → { handler, options, version }  (loaded)   │  │   │
│   │  │ 'magazine' → { handler, options, version }  (loaded)   │  │   │
│   │  │ 'retro'    → <not loaded, disk only>                   │  │   │
│   │  └────────────────────────────────────────────────────────┘  │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   per-request flow:                                                  │
│   1. read site.activeTheme (cached, PB-realtime-subscribed)          │
│   2. look up registry; if not loaded, await import(entry.mjs)        │
│   3. rewrite URL: strip /themes/<name>/static prefix                 │
│   4. call theme.handler(req, res)                                    │
│   5. on theme change: lazy-load new, unload old after drain (5s)     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Theme 契约

### 3.1 目录布局（运行时）

所有已安装的 theme 都放在宿主机的固定目录下，theme host 扫描：

```
/var/lib/vanblog/themes/                  ← VANBLOG_THEMES_DIR
├── default/
│   ├── theme.json
│   └── dist/
│       ├── entry.mjs                     ← theme host 动态 import 这个
│       ├── server/
│       └── client/
│           └── _astro/                   ← caddy file_server 这里
└── magazine/
    ├── theme.json
    └── dist/...
```

**注意**：源码（`src/`、`astro.config.mjs` 等）**不进 prod 镜像**——只有 `dist/` 和 `theme.json` 是运行时需要的。

### 3.2 theme.json 扩展

```jsonc
{
  "name": "magazine",
  "label": "杂志风",
  "version": "1.2.0",
  "author": "...",
  "description": "...",

  // ↓ 新增字段（本次提案）
  "recommendedPalette": "sepia", // 推荐搭配的 palette name（不强求存在）
  "recommendedDarkMode": "auto", // light | dark | auto（推荐 dark mode 默认值）
  "schemaVersion": 1, // 用于将来升级时的迁移判断
  "vanblogCompatibility": "^1.0" // semver，theme host 拒绝加载不兼容的 theme
}
```

- `recommendedPalette` 只是**提示**——theme host 切换 theme 时如果当前 palette 跟新 theme 的推荐值不同，按用户配置的迁移策略处理（见 §6.2）。
- 不强制要求 palette 在 `hooks/palettes/` 中实际存在——不存在的 palette 就是普通字符串，theme 自己负责优雅降级。

### 3.3 Theme 作者要做什么

```js
// themes/magazine/astro.config.mjs
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import themes from "../../app/integrations/themes/index.mjs";
import packs from "../../app/integrations/packs/index.mjs";

const themeName = "magazine"; // ← 必须与目录名一致

export default defineConfig({
  // ★ 关键：让所有资源 URL 自带 /themes/<name>/ 前缀
  base: `/themes/${themeName}/`,
  build: {
    assetsPrefix: `${themeName}/`, // Astro 会拼到 /themes/<name>/_astro/...
  },
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    themes({ themeSrcDir: "./src", mainAppSrcDir: "../../app/src" }),
    packs({ themePage: "./src/layouts/PackPage.astro" }),
  ],
});
```

**vs 当前**：只多了 `base` + `assetsPrefix` 两行。其他（薄壳 pages、base-overrides、middleware.ts、live.config.ts）**完全不变**。

### 3.4 静态资源路径变化

| 资源        | 旧 URL                       | 新 URL                                       |
| ----------- | ---------------------------- | -------------------------------------------- |
| 页面 HTML   | `/posts/123`                 | `/posts/123`（**不变**）                     |
| CSS chunk   | `/_astro/BaseLayout.ABC.css` | `/themes/magazine/_astro/BaseLayout.ABC.css` |
| JS chunk    | `/_astro/Editor.DEF.js`      | `/themes/magazine/_astro/Editor.DEF.js`      |
| Public 资源 | `/favicon.ico`               | `/themes/magazine/favicon.ico`               |
| API         | `/api/posts`                 | `/api/posts`（**不变**）                     |

主题作者**无需关心**这些——Astro `base` 配置会自动处理所有资源 URL 生成。

---

## 4. Theme Host 实现规范

### 4.1 接口

theme host 是一个独立的 Node 进程，监听 `127.0.0.1:4321`。它的入口是 `app/src/theme-host/index.ts`（新建）：

```ts
// 简化伪代码
interface LoadedTheme {
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  options: { version: string; client: string /* ... */ };
  themeJson: ThemeJson;
  loadedAt: number;
  refCount: number; // for LRU eviction
}

const registry = new Map<string, LoadedTheme>();
let activeThemeName: string; // cached from PB site.activeTheme

async function loadTheme(name: string): Promise<LoadedTheme> {
  const distDir = join(THEMES_DIR, name, "dist");
  const entryUrl = pathToFileURL(join(distDir, "server", "entry.mjs")).href;
  const mod = await import(entryUrl); // ← ESM 动态 import
  const themeJson = JSON.parse(
    await readFile(join(THEMES_DIR, name, "theme.json"), "utf8")
  );
  return {
    handler: mod.handler,
    options: mod.options,
    themeJson,
    loadedAt: Date.now(),
    refCount: 0,
  };
}

async function route(req, res) {
  // 1. determine target theme
  const name = req.headers["x-vanblog-theme"] || activeThemeName;
  let theme = registry.get(name);
  if (!theme) {
    theme = await loadTheme(name);
    registry.set(name, theme);
  }

  // 2. rewrite URL: /themes/<name>/static/foo.js → /foo.js
  //    (Astro handler expects original paths)
  const staticPrefix = `/themes/${name}/static`;
  if (req.url!.startsWith(staticPrefix)) {
    req.url = req.url!.slice(staticPrefix.length) || "/";
  }

  // 3. dispatch
  theme.refCount++;
  try {
    await theme.handler(req, res);
  } finally {
    theme.refCount--;
  }
}

const server = http.createServer(route);
server.listen(4321, "127.0.0.1");

// PB realtime subscription for site.activeTheme changes
subscribeToSiteChanges((newSite) => {
  if (newSite.activeTheme !== activeThemeName) {
    handleThemeSwitch(newSite.activeTheme);
  }
});

async function handleThemeSwitch(newName: string) {
  const oldName = activeThemeName;
  activeThemeName = newName;
  if (!registry.has(newName)) {
    await loadTheme(newName).then((t) => registry.set(newName, t));
  }
  // Drain old theme: wait up to 5s for in-flight requests, then evict
  setTimeout(() => {
    const old = registry.get(oldName);
    if (old && old.refCount === 0) {
      registry.delete(oldName);
      // ESM modules can't be truly unloaded, but dropping the reference
      // lets GC reclaim everything except the compiled module code itself.
    }
  }, 5000).unref();
}
```

### 4.2 错误处理

| 场景                                       | 行为                                                             |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `site.activeTheme` 指向不存在的 theme      | theme host 拒绝加载，**继续用当前 theme**，admin UI 显示红色警告 |
| theme dist 损坏（import 抛错）             | 同上，**不破坏当前服务**                                         |
| theme handler 内部异常                     | theme host 不吞错，原样返回 500                                  |
| PB 不可达（启动时读不到 site.activeTheme） | fallback 到 `VANBLOG_DEFAULT_THEME`（build-arg 写入）            |

### 4.3 启动顺序（新 entrypoint.prod.sh）

```sh
# 1. Caddy bootstrap
# 2. PocketBase up
# 3. Theme Host up (replaces direct Astro server)
cd /app/dist
VANBLOG_THEMES_DIR=/var/lib/vanblog/themes \
ASTRO_NODE_AUTOSTART=disabled \
node ./theme-host/index.mjs &

# 4. Caddy fallback route still → 127.0.0.1:4321
#    New: caddy also serves /themes/<name>/static/* via file_server
```

---

## 5. Caddy Translator 改动

### 5.1 当前 fallback（参考）

```go
// config_builder.go:305-312
{
  ID: systemFallbackID,
  Handle: []Handler{{
    Handler:   "reverse_proxy",
    Upstreams: []Upstream{{Dial: opts.AstroTarget}},  // 127.0.0.1:4321
  }},
}
```

### 5.2 新增系统规则：theme static file_server

在 `SystemCacheRules()` 前面插入一条新规则：

```go
// 新增：theme-scoped static assets
// /themes/<name>/static/* → file_server at /var/lib/vanblog/themes/<name>/dist/client/
//
// 用 caddy 的 file_server + root 模板，按 path 第 3 段（name）展开。
// 但因为 themes 是动态的，我们不能为每个 theme 编译一条规则——
// 用 caddy 的 route 单条规则 + path_vars 捕获 name，然后 file_server
// root = "/var/lib/vanblog/themes/{http.matchers.path.name}/dist/client/"
//
// 简化方案（MVP）：caddy 仍然 reverse_proxy static 给 theme host，
// theme host 自己处理静态文件服务。Phase 2 再优化到 caddy 直供。
```

**MVP 决策**：静态资源**先走 theme host**（theme host 内部用 `sirv` 或 `send` 处理 `/themes/<name>/static/*`）。Phase 2 再让 caddy 直接 file_server（性能更好，但需要改 Go translator）。

### 5.3 未来优化（Phase 2）

caddy translator 增加：

```go
{
  ID: "vanblog-system-theme-static",
  Match: []MatchRule{{
    Path: []string{"/themes/*/static/*"},
  }},
  Handle: []Handler{{
    Handler: "file_server",
    Root: "/var/lib/vanblog/themes",  // 配合 path_rewrite 去掉 /themes/X/static 前缀
  }},
}
```

收益：静态资源不再经过 Node，Caddy 直接零拷贝发送，TPS 提升 5-10 倍。

---

## 6. Palette 作为 Config 共识

### 6.1 核心思想

**Palette 不是 theme 的子集，也不是独立维度——它是 site 级 config item，theme 知道它的存在但只把它当推荐值。**

类比：macOS 的「强调色」是系统级设置，每个 App 知道它存在并尽量尊重它，但 App 可以选择忽略。

### 6.2 Theme 切换时的迁移策略

用户在 admin UI 改 `site.activeTheme` 时，后端处理逻辑：

```ts
// POST /api/site (admin endpoint)
async function updateSite(patch: Partial<Site>) {
  const oldTheme = currentSite.activeTheme;
  const newTheme = patch.activeTheme;

  if (newTheme && newTheme !== oldTheme) {
    const oldMeta = await loadThemeJson(oldTheme);
    const newMeta = await loadThemeJson(newTheme);

    // 检查当前 palette 是否「绑定」于旧 theme
    const currentPalette = patch.palette ?? currentSite.palette;
    const paletteIsThemeSpecific =
      currentPalette === oldMeta.recommendedPalette;

    if (
      paletteIsThemeSpecific &&
      currentPalette !== newMeta.recommendedPalette
    ) {
      // 两种策略，由 site.paletteMigrationMode 字段控制：
      //   'prompt'  → 返回 409，让前端弹确认框 "切换主题将把调色盘从 sepia 改为 default，是否继续？"
      //   'silent'  → 自动改 palette，前端 toast 一条提示
      //   'keep'    → 啥都不做，用户 palette 保持不变（默认）
      if (site.paletteMigrationMode === "prompt") {
        return new Response(
          JSON.stringify({
            error: "palette_migration_required",
            oldPalette: currentPalette,
            suggestedPalette: newMeta.recommendedPalette,
          }),
          { status: 409 }
        );
      }
      if (site.paletteMigrationMode === "silent") {
        patch.palette = newMeta.recommendedPalette;
      }
      // 'keep' → fall through, do nothing
    }
  }

  await pb.collection("site").update(siteId, patch);
}
```

### 6.3 用户可见的行为

| `paletteMigrationMode` | 用户操作 | 结果                                                                                                     |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `keep`（默认）         | 切 theme | palette 不变。可能出现「magazine 主题 + sepia 配色」这种组合，theme 自行优雅降级（用 CSS 变量 fallback） |
| `silent`               | 切 theme | palette 自动跟着改成新 theme 的推荐值，顶部 toast：「已将调色盘切换为 default」                          |
| `prompt`               | 切 theme | 弹窗：「magazine 推荐使用 default 配色，是否切换？」选是 → 一并改                                        |

**默认 `keep`**，最不惊讶。用户主动选过 palette 就尊重他的选择。

### 6.4 Theme 作者如何尊重 palette

theme 在自己的样式中**永远用 CSS 变量**，不要硬编码颜色：

```css
/* ✅ 正确：theme 的 styles */
.card {
  background: var(--color-surface, #fff); /* fallback 给一个默认值 */
  color: var(--color-text, #000);
  border: 1px solid var(--color-border, #ccc);
}

/* ❌ 错误：硬编码 */
.card {
  background: #ffffff;
  color: #1e293b;
}
```

这样不管 palette 是什么，theme 都能渲染；palette 切换时颜色会跟着变（因为 `/api/palette.css` 端点重写了变量）。

---

## 7. Admin UI 设计

### 7.1 简化的外观面板

```html
<fieldset>
  <legend>外观</legend>

  <label>主题</label>
  <select name="activeTheme">
    <option value="default">Vanblog Default</option>
    <option value="magazine">杂志风</option>
    <option value="retro">复古</option>
  </select>
  <small>切换立即生效（<5s）</small>

  <details>
    <summary>高级选项</summary>

    <label>调色盘</label>
    <select name="palette">
      <option value="default">默认</option>
      <option value="sepia">复古棕</option>
      <option value="midnight">午夜黑</option>
    </select>
    <small>当前主题推荐：<strong>default</strong></small>

    <!-- 明暗由 palette 的 type 决定（原子调色盘）；旧 defaultTheme(auto/light/dark) 三态已移除。
         访客端通过 Nav 的「跟随系统」system 伪 palette 覆盖站点明暗。 -->
    <label>明暗</label>
    <p class="muted">
      由调色盘 type 决定；访客可在站点顶栏选「跟随系统」或具体调色盘。
    </p>

    <label>切换主题时如何处理调色盘</label>
    <select name="paletteMigrationMode">
      <option value="keep">保持当前（默认）</option>
      <option value="silent">自动迁移到推荐值</option>
      <option value="prompt">每次询问</option>
    </select>
  </details>
</fieldset>
```

### 7.2 用户感知

- **90% 用户**：只看顶部「主题」下拉，选一个完事。
- **10% 爱折腾用户**：展开「高级选项」单独改 palette 或 dark mode。
- 切换 theme 是即时的（<5s），用户立刻看到新外观。
- palette 跟随策略默认 `keep`——用户选过的 palette 永远尊重。

---

## 8. Theme 安装与生命周期

### 8.1 安装方式（三选一）

| 方式                    | 场景                          | 流程                                                                          |
| ----------------------- | ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **内置**                | 镜像自带                      | themes 构建产物留在镜像 `/build/themes`（只读，`VANBLOG_THEMES_BUILTIN_DIR`） |
| **CLI 安装**            | 用户有预构建 theme（dir/zip） | `vanblog.sh pack theme install <dir                                           | zip>`→ 原子落盘到用户卷`/var/lib/vanblog/themes`（持久）→ themeWatcher 自动发现 |
| **Marketplace**（远期） | 一键安装                      | 未实现；依赖 CLI 安装 + 用户卷，当前无分发渠道                                |

### 8.2 生命周期

```
   installed          loaded              evicted
      │                  │                   │
      ▼                  ▼                   ▼
┌──────────┐  load()  ┌──────────┐  drain  ┌──────────┐
│ on disk  │ ───────► │ in memory│ ──────► │ on disk  │
│ (theme   │          │ (handler │         │ (handler │
│  .json + │          │  cached) │         │  GC'd)   │
│  dist/)  │          │          │         │          │
└──────────┘          └──────────┘         └──────────┘
      ▲                                        │
      └──────────── user re-activates ─────────┘
```

- **installed**：theme 在磁盘上，但 theme host 没加载它的 handler
- **loaded**：theme host 通过 `import()` 把 handler 载入内存
- **evicted**：用户切到别的 theme，老 theme 在 5s drain 后从 registry 移除引用（GC 回收内存）

### 8.3 LRU 限制（防内存膨胀）

```ts
// 最多同时保持 3 个 theme loaded（active + 2 缓存）
const MAX_LOADED_THEMES = 3;

// 当 registry.size > MAX_LOADED_THEMES 时，evict refCount=0 + loadedAt 最早的
```

对个人博客场景足够（active + 预览 1-2 个备选）。

---

## 9. 实施计划（分阶段）

### Phase 1（MVP，~1-2 天）—— 让架构自洽

**目标**：修复当前架构不一致，让 `site.activeTheme` 真的生效（但仍是「重启容器」级别切换）。

- [x] 修 `entrypoint.prod.sh:82`：从 `/app/dist` 改为读 `/etc/vanblog/active-theme`，`cd /var/lib/vanblog/themes/${active}/dist`（已实现：entrypoint 现直接启动 theme host，见 `docker/entrypoint.prod.sh` L86-95）
- [x] Dockerfile 把 `themes/` 整体 COPY 到 `/var/lib/vanblog/themes/`（当前只 COPY 编译产物）（已实现：Dockerfile 循环 build 全部 theme；内置留在 `/build/themes`，用户卷 `/var/lib/vanblog/themes`，prod/dev 均无 symlink）
- [x] ~~删除 `themes/default/` 里硬编码开发机路径的注释（误导）~~（该目录已被 base/vanblog 取代）

### Phase 2（Theme Host MVP，~3-5 天）—— 热切换核心能力

**目标**：用户改 `site.activeTheme` → 5s 内生效，无需重启容器。

- [x] 写 `app/src/theme-host/index.ts`（~200 行）（已实现：`app/src/theme-host/index.mjs` + `core.mjs`，纯编排、零依赖、可测试）
- [x] entrypoint 启动 theme host 替代直接跑 Astro（已实现：`docker/entrypoint.prod.sh` L86-95 + 健康端点 `/__theme_host_health`）
- [x] PB hook 推送 site 变更给 theme host（或 theme host 订阅 PB realtime）（已实现：采用 5s 轮询方案，`app/src/theme-host/index.mjs` pollSiteChanges）
- [x] theme astro.config 增加 `base` + `assetsPrefix`（已实现：收敛到 `themes/shared-config.mjs`，所有 theme 共用；Dockerfile 按 theme 注入 `VANBLOG_THEME_NAME`）
- [x] admin/site.astro UI 改造（单下拉 + 高级折叠）（已实现：演进为卡牌式主题/调色盘选择器 + iframe 实时预览）
- [x] 集成测试：切换 theme 不丢请求（已实现：`scripts/test/test-theme-switch.mjs` + `app/test/lifecycle.test.mjs`）

### Phase 3（生态完善，~1-2 周）

- [x] theme 安装与持久化 — **CLI 实现**：`vanblog pack theme install/list/remove`（并入 pack CLI，复用 cobra + 原子 staged copy）；`/var/lib/vanblog/themes` 改为用户卷（compose `themes_data`）+ 内置/用户双目录合并（theme host / Caddy / theme / palette，用户优先）；自动发现 ✅ themeWatcher。admin UI 上传不做了（CLI 已覆盖）
- [ ] palette migration 三种策略实现 — **部分实现**：字段 + UI + recommendedPalette fallback（silent 实质生效）✅；prompt confirm 未接线、去语义化（实时预览已取代，见状态说明）
- [x] caddy translator 增加 file_server 规则（静态资源零拷贝）（已实现：`vault/internal/caddy/static_routes.go` + themeWatcher 自动 resync）
- [ ] theme marketplace（远期）

> **状态说明（2026-08-12 更新）**：Phase 1 + Phase 2 已全部实现。实现方式与计划存在偏差，均已在上面逐条标注：theme host 用 `.mjs`（`index.mjs` + `core.mjs`）而非 `.ts`；PB 变更用 5s 轮询而非 PB hook；base/assetsPrefix 收敛到 `themes/shared-config.mjs`；admin UI 演进为卡牌式选择器 + iframe 实时预览；静态资源移交 Caddy file_server（方向 B）。
>
> **Theme 安装与持久化（2026-08-12 落地）**：`/var/lib/vanblog/themes` 已改为**用户卷**（compose `themes_data`），不再是镜像 symlink（旧 symlink 是 `cafa300a` 的 P0 bugfix，非故意非持久）。内置 themes 固定在 `/build/themes`（`VANBLOG_THEMES_BUILTIN_DIR`）；4 处消费方（theme host / Caddy / theme / palette）统一「内置+用户合并，用户优先」。安装走 **`vanblog.sh pack theme install/list/remove`**（并入 pack CLI，未来可泛化为 `van` CLI）。
>
> Phase 3 处置（更新）：
>
> - **theme.zip 上传 → CLI 安装（已实现）** —— admin UI 上传去语义化；预构建 theme 用 `pack theme install <dir|zip>` 原子落盘到持久卷，themeWatcher 自动发现；`pack theme remove` 拒绝删内置/活动主题。
> - **palette migration「prompt」** 去语义化 —— admin 已是卡牌选择器 + iframe 实时预览，保存前即可见效果，confirm() 无必要；保留 `paletteMigrationMode` 字段兼容。
> - **theme marketplace** 保持远期，不实现（依赖上传能力）。
> - **第二测试主题不新建** —— `themes/base` 即 minimal/兜底主题（theme.json 自述），`scripts/test/test-theme-switch.mjs` 已按 vanblog + base 双主题验证。

---

## 10. 风险与开放问题

### 10.1 已识别风险

| 风险                              | 缓解                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| 多 theme 共存内存膨胀             | LRU 上限 3 个；evict 后 GC                                          |
| `import()` 失败（dist 损坏）      | 拒绝切换，保持当前 theme，admin 显示警告                            |
| 资源路径前缀变化破坏 SEO          | 页面 HTML 路径不变（只有静态资源加前缀）；sitemap 仍正常            |
| 老 bookmark 指向 `/_astro/foo.js` | 404，但用户切 theme 本就会换页面；可加 redirect 规则                |
| theme 间状态共享（cookies 等）    | theme host 不持久化任何请求级状态；theme handler 内部用 locals 即可 |

### 10.2 开放问题

1. **PB Realtime vs Polling**：theme host 怎么最快感知 `site.activeTheme` 变化？
   - 倾向：PB Realtime subscribe（已存在），fallback 5s 轮询。
2. **Theme 在 build 时如何拿到自己的 name？** `astro.config.mjs` 里硬编码？还是从环境变量读？
   - 倾向：`process.env.VANBLOG_THEME_NAME`，由 build 系统注入。
3. **Dev 模式下 theme host 怎么工作？** ~~dev server 没有 `dist/`~~。
   - **已解决（2026-08-12）**：dev 是 prod 平替 —— dev 镜像同样构建 theme dist（`/build/themes`），dev 容器挂同款数据卷并跑 theme host，热切换与 prod 一致（不再跳过 theme host 跑 `astro dev`）。
4. **【P0】prerender 静态页面归属**：见 §13。
5. **【P1】单进程崩溃半径**：一个 theme handler 抛 unhandled rejection 会拖崩整个 theme host（因为所有 handler 共用 Node 事件循环）。需要 `process.on('unhandledRejection')` + `uncaughtException` 全局兜底 + 健康探活。考虑是否要用 `worker_threads` 做进程内隔离。
6. **【P1】Pack 路由 + theme `base` 的冲突**：theme build 时 pack metadata 烧死在 chunks 里（`packVirtualPlugin`），新装 Pack 需所有 theme 重 build。`base: '/themes/<name>/'` 还会把 Pack 的 `/p/<name>` 路由也加上前缀，可能破坏 Pack URL 稳定性。**Phase 2 实施前必须 spike 验证**。
7. **【P2】跨 theme session 共享**：cookie 按 domain 存，跨 theme 不丢。但每个 theme 的 `middleware.ts` 是独立 module instance，AsyncLocalStorage 也独立——认证状态能否跨 theme 正确传递需要实测。
8. **【P2】Theme 上传安全模型**：theme host `import()` 一个 theme 的 entry.mjs = 信任它执行任意代码。Phase 3 必须：签名验证 / 官方 marketplace / 沙箱（vm2 已不可用，isolated-vm 复杂）。
9. **【P3】多租户场景**：一个 vanblog 实例按 host 路由到不同 theme。当前设计假设单 site。明确「单 site 假设」写入契约，未来如需多租户再扩展。
10. **【P0】Astro 版本升级**：所有已安装 theme 必须用 theme host 的 Astro 版本。theme host 加载时检查 `themeJson.vanblogCompatibility` semver，拒绝不兼容的 theme。
11. **【P3】可观测性**：metrics（每 theme 请求量、加载时间、内存占用）+ 日志格式（区分 theme）+ 健康检查端点契约。MVP 不致命，生产化前必须补。
12. **【P0】Astro experimental.cache 与 theme host 的交互**：见 §13。

---

## 11. 与现有架构的兼容性

| 现有组件                                             | 改动                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `themes/vanblog/` 完整独立主题（自带页面/组件/布局） | ✅ 已是独立 Astro 项目，自带 `base`/`assetsPrefix`                              |
| `@vanblog/base/*` alias                              | ✅ 不变                                                                         |
| `hooks/palettes/`                                    | ✅ 不变，palette.css 端点继续工作                                               |
| `app/integrations/themes/index.mjs`                  | ✅ 不变                                                                         |
| `site.palette` / `site.activeTheme` 字段             | ✅ 不变，新增 `site.paletteMigrationMode`                                       |
| `app/src/layouts/BaseLayout.astro`                   | 🟡 移除 `<link href="/api/palette.css">` 改为 theme host 注入（或保留，没问题） |
| `Dockerfile`                                         | 🟡 改 COPY 目标 + 改 entrypoint cd 路径                                         |
| `docker/entrypoint.prod.sh`                          | 🟡 改启动命令（启动 theme host 而非 Astro 直接）                                |
| `vault/internal/caddy/config_builder.go`             | 🟡 MVP 不改，Phase 3 加 file_server 规则                                        |
| `app/src/pages/api/themes.ts`                        | ✅ 不变，继续枚举磁盘上的 theme                                                 |
| `app/src/pages/admin/site.astro`                     | 🟡 UI 改造                                                                      |

**关键**：所有 🟡 改动都是**增量的**，不破坏现有 theme 作者的工作流。

---

## 12. 总结

| 维度             | 评价                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| 开发者心智       | ✅ theme 作者只多写两行 astro.config；其他都不变                      |
| 用户心智         | ✅ 一个下拉切换主题，5s 生效，无 rebuild                              |
| 技术可行性       | ✅ 所有关键技术点已验证（动态 import、dist 可搬迁、handler 独立可用） |
| 内存占用         | ✅ 单进程 + LRU，接近单 theme                                         |
| 与现有架构兼容   | ✅ 增量改动，不破坏既有机制                                           |
| Palette 作为共识 | ✅ theme 知道它存在并尊重，但不强制；用户选择永远赢                   |

这个方案把 theme 从「需要重建镜像的编译时配置」变成「5s 热切换的运行时配置」，同时保留了 palette 作为用户可控的独立维度——通过「推荐 + 迁移策略」的软约束让两者协作而非冲突。

---

## 13. Astro experimental.cache 与 Theme Host 的交互

### 13.1 前置澄清：vanblog 不是「纯 SSR」

当前 `app/src/pages/*.astro` 全部 `export const prerender = false`，但这**不是放弃 Astro 性能优点**——而是选择了 **SSR + experimental.cache（SWR 语义）**，等同 Next.js ISR。

`themes/vanblog/astro.config.mjs` 的配置：

```js
experimental: {
  cache: { provider: memoryCache() },
  routeRules: {
    '/posts/[id]':     { maxAge: 300, swr: 60, tags: ['posts'] },
    '/':               { maxAge: 300, swr: 60, tags: ['posts', 'home'] },
    '/archive':        { maxAge: 600, swr: 120, tags: ['posts'] },
    '/api/feed.xml':   { maxAge: 1800, tags: ['posts', 'feed'] },
    '/api/sitemap.xml':{ maxAge: 3600, tags: ['posts', 'feed'] },
  },
}
```

| 请求类型                                      | 响应时间 | 说明                                   |
| --------------------------------------------- | -------- | -------------------------------------- |
| 首次请求（cache MISS）                        | ~200ms   | SSR 渲染 + 写入 cache                  |
| 后续请求（cache HIT，5 分钟内）               | **~1ms** | 读内存 cache，与 SSG 同等性能          |
| stale 后请求（swr 窗口内）                    | **~1ms** | 立即返回旧缓存，后台异步重验证         |
| PB hook 调 `/api/revalidate {tags:["posts"]}` | -        | 失效缓存，下次请求触发 MISS → 重新渲染 |

**为什么不用 `prerender = true`**：vanblog 是动态内容站（用户随时发文、改配置、切 theme/palette），prerender 的 build 时数据快照会立刻过时，必须反复 `astro build` 才能更新——而 theme host 的整个设计目标是「不 rebuild」。SWR cache 在 99% 请求下达到 SSG 性能，同时保留实时性。

### 13.2 Theme 切换时的 cache 失效问题

**核心问题**：theme host 切换 `site.activeTheme` 后，旧 theme 渲染的 HTML 仍在 `memoryCache()` 里。如果不清空，用户会看到：

- HTML 是 default 的（旧缓存）
- JS/CSS chunks 是 magazine 的（新 theme 资源 URL 自带 `/themes/magazine/` 前缀）
- **结果**：页面样式撕裂、JS 报错、React island 挂掉

### 13.3 方案对比：cache 失效策略

| 方案                          | 实现                                                                           | 优点                                                        | 缺点                                                      |
| ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------- |
| **A. 进程重启**               | 切 theme = kill 老 SSR 进程，起新进程                                          | ✅ 天然清空所有内存状态（cache、module cache、connections） | ❌ 切换有 1-2s downtime；失去 theme host 的「热切换」价值 |
| **B. 全局 cache clear**       | `await context.cache.invalidate('*')` 或类似 API                               | ✅ 无 downtime                                              | ❌ 需要 Astro cache API 支持「全局失效」，可能不存在      |
| **C. 按路由 tag 失效**        | 调 `invalidate({tags: ['posts','home','feed']})`                               | ✅ 精准，无 downtime                                        | ❌ 需要枚举所有 tag；漏一个就出问题                       |
| **D. 按 theme name 命名空间** | 每个 theme 的 cache 隔离（如 `theme:default:posts` vs `theme:magazine:posts`） | ✅ 彻底隔离，切回来 hit 老缓存                              | ❌ Astro `memoryCache()` 不支持 namespacing；需 fork      |

### 13.4 Astro experimental.cache API 能力边界（已 spike 验证）

> **实证结论**：直接读了 `node_modules/.pnpm/astro@6.4.8/.../dist/core/cache/memory-provider.js` 和 `types.d.ts`。

| 能力                                  | 支持情况                                 | 代码位置 / 说明                                            |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `invalidate({ path })`                | ✅ 精确字符串匹配（遍历所有 key）        | `memory-provider.js:282-288`                               |
| `invalidate({ tags })`                | ✅ 传 `string \| string[]`，Set 精确匹配 | `memory-provider.js:289-298`                               |
| `invalidateAll()` / `invalidate('*')` | ❌ **API 不存在**                        | types.d.ts 只有 `InvalidateOptions = { path?, tags? }`     |
| `memoryCache({ namespace })`          | ❌ **完全不存在**                        | `MemoryCacheProviderOptions = { max?, query? }`            |
| 清空整个 cache                        | ❌ 只能枚举所有 path/tag                 | 内部 LRUMap 是闭包私有（line 203）                         |
| 自定义 CacheProvider                  | ✅ 接口开放                              | `CacheProviderFactory`；memoryProvider 才 ~100 行，易 fork |

**关键事实**：

- `cache` LRUMap 实例是**闭包私有**，外部拿不到引用，无法直接 `.clear()`
- `path` 失效是**字符串严格相等**比较，不支持 glob
- 单进程 theme host 加载多个 theme handler 时，**每个 theme handler 都有自己的 `astro:cache` module instance**（因为 module URL 不同）→ 各自独立的 LRUMap → **天然隔离**

### 13.5 方案 F：tag 自带 theme name（推荐）

**核心思路**：让每个 theme build 时给所有 routeRule 都自动注入 `theme:<name>` tag。切换 theme 时调 `invalidate({ tags: ['theme:<oldName>'] })` 精准清空。

```js
// themes/<name>/astro.config.mjs
const themeName = process.env.VANBLOG_THEME_NAME;

export default defineConfig({
  experimental: {
    cache: { provider: memoryCache() },
    routeRules: {
      "/": { maxAge: 300, swr: 60, tags: ["posts", `theme:${themeName}`] },
      "/posts/[id]": {
        maxAge: 300,
        swr: 60,
        tags: ["posts", `theme:${themeName}`],
      },
      // ...
    },
  },
});
```

theme host 切换逻辑：

```ts
async function switchTheme(newName: string) {
  const oldName = activeThemeName;
  // 1. 失效旧 theme 的所有 cache entry
  const oldHandler = registry.get(oldName);
  await oldHandler.cache.invalidate({ tags: [`theme:${oldName}`] });
  // 2. load / switch to new theme handler
  activeThemeName = newName;
}
```

**优点**：

- ✅ 利用 Astro 原生 tag 机制，**零 fork、零 hack**
- ✅ 精准清空——只清旧 theme 的 entry，其他 theme 的缓存（如果同时 loaded）不受影响
- ✅ Theme 作者无需关心——theme host build 时自动注入
- ✅ admin、未 tag 的页面默认不缓存，不受影响

**缺点 / 边缘**：

- 🟡 Theme 代码里手动调 `Astro.cache.set({ tags: [...] })` 时，theme host 需要在 vite plugin 层自动 merge `theme:<name>` ——可做
- 🟡 实测：**如果每个 theme handler 有独立 module instance（独立 LRUMap），其实根本不需要 invalidate**——切 theme 后请求都走新 handler，新 handler 的 cache 是空的。需要 spike 确认。

### 13.6 重新评估：单进程多 handler 的 cache 隔离

读完 memory-provider.js 后发现一个**关键事实**：

```js
// memory-provider.js:200-203
const memoryProvider = (config) => {
  const cache = new LRUMap(max); // ← 闭包私有！
  return {
    /* onRequest, invalidate */
  };
};
```

**每个 `memoryCache()` 调用都创建独立的 LRUMap**。而在 theme host 模式下：

```
theme host process
├─ import('themes/vanblog/dist/server/entry.mjs')
│    └─ 内部 import 'astro/config' → 调用 memoryCache() → LRUMap #1
└─ import('themes/magazine/dist/server/entry.mjs')
     └─ 内部 import 'astro/config' → 调用 memoryCache() → LRUMap #2
```

**问题**：`astro/config` 是**同一个 module URL**，Node.js ESM cache 会返回同一个 module instance → **两个 theme handler 共享同一个 `memoryCache()` 返回值吗**？

需要 spike。两种可能：

**情况 A：共享同一个 LRUMap**（很可能）

- theme A 的 cache 写入：`{ path: '/posts/123', body: '<default>...' }`
- 切换到 theme B 后请求 `/posts/123` → 命中 theme A 的缓存 → **样式撕裂**
- 必须用方案 F（theme name as tag）

**情况 B：每个 handler 独立 LRUMap**（不太可能，但若真则完美）

- 天然隔离，无需做任何事
- 但意味着 ESM module instance 是 per-handler 的——这又会让 module unload 问题更严重

**待验证**：写一个最小 spike，theme host 同时 import 两个 entry.mjs，看它们的 `options.cache` 引用是否相同。

### 13.7 结论对方案 7 的影响

cache 隔离问题**不是 theme host 的致命伤**——方案 F 可以解决。但还有以下未解问题叠加：

| 问题                   | 严重性 | 是否已解                                                             |
| ---------------------- | ------ | -------------------------------------------------------------------- |
| cache 隔离             | 🟡 中  | 方案 F 可解（待 spike 确认是否真有问题）                             |
| ESM module 无法 unload | 🟡 中  | 切换 N 次后内存累积；只能周期性重启 theme host                       |
| 单进程崩溃半径         | 🔴 高  | 一个 theme 抛 unhandled rejection 全挂；需要 worker_threads 或多进程 |
| Pack 路由 + base 冲突  | 🔴 高  | 未 spike，可能是方案的致命问题                                       |

**综合判断**：cache 隔离本身不是决定性因素，但**叠加上其他三个问题**，方案 7「单进程 + 动态 import」相比方案 8「多进程 + supervisor」的优势越来越小。

**建议**：先做 Pack + base 冲突的 spike（P1）。如果它真的破坏方案，则直接转向方案 8；如果不破坏，方案 7 仍可考虑，cache 隔离用方案 F 即可。

---

## 14. Spike 报告：Pack 路由 + theme `base` 冲突（已验证）

> **结论**：**没有冲突**。`base` 不影响路由 pattern，Pack 路由 `/p/<name>` 保持不变。这个 P1 风险点**已解除**。

### 14.1 验证方法

1. 备份 `themes/vanblog/astro.config.mjs`
2. 在 `defineConfig({})` 里加 `base: '/themes/vanblog/'`
3. `pnpm build`，对比 manifest 里的路由 pattern
4. 查 Astro 源码确认机制
5. 恢复原配置

### 14.2 实测结果

加 `base: '/themes/vanblog/'` 前后对比 manifest（`themes/vanblog/dist/server/chunks/server_*.mjs` 里的 `_manifest`）：

| 路由        | 加 base 前 pattern    | 加 base 后 pattern    | 变化        |
| ----------- | --------------------- | --------------------- | ----------- |
| 首页        | `/`                   | `/`                   | ✅ 不变     |
| 文章页      | `/posts/[id]`         | `/posts/[id]`         | ✅ 不变     |
| **Pack 页** | `/p/bookmarks`        | `/p/bookmarks`        | ✅ **不变** |
| Pack 页     | `/p/live2d-companion` | `/p/live2d-companion` | ✅ 不变     |
| Pack 页     | `/p/moments`          | `/p/moments`          | ✅ 不变     |
| Admin       | `/admin/audits`       | `/admin/audits`       | ✅ 不变     |

manifest 里多了一个字段：`base: "/themes/vanblog/"`——这是 Astro 运行时用来**剥前缀**和**生成资源 URL** 的依据。

### 14.3 机制解释（Astro 源码实证）

**路由匹配层**（`node_modules/.../astro/dist/core/app/base.js:107-113`）：

```js
removeBase(pathname) {
  pathname = collapseDuplicateLeadingSlashes(pathname);
  if (pathname.startsWith(this.manifest.base)) {
    return pathname.slice(this.baseWithoutTrailingSlash.length + 1);
  }
  return pathname;
}
```

- 请求 `/themes/vanblog/posts/123` → removeBase → `/posts/123` → match `/posts/[id]` ✅
- 请求 `/themes/vanblog/p/bookmarks` → removeBase → `/p/bookmarks` → match Pack 路由 ✅
- 请求 `/posts/123`（无前缀）→ removeBase 不剥（因为 `pathname.startsWith(base)` false）→ 仍然 match `/posts/[id]` ✅（向后兼容）

**资源 URL 生成层**（`node_modules/.../astro/dist/core/app/pipeline.js:24`）：

```js
const resolve = async (specifier) => {
  const bundlePath = manifest.entryModules[specifier];
  return createAssetLink(bundlePath, manifest.base, manifest.assetsPrefix);
};
```

`createAssetLink` 会自动拼上 `base`：

- bundlePath = `_astro/foo.ABC.js`
- base = `/themes/vanblog/`
- 结果 = `/themes/vanblog/_astro/foo.ABC.js` ✅

**headElements**（pipeline.js:46-67）也用 `base` + `assetsPrefix` 生成 `<link>` / `<script>` 标签的 href。

### 14.4 结论

| 关心的点                                                          | 答案                                                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `base` 会改路由 pattern 吗？                                      | ❌ 不会。pattern 在 `injectRoute` 时固定。                                                                                          |
| `base` 会改资源 URL 吗？                                          | ✅ 会。HTML 里的 `<script src>`、`<link href>` 都自动带 `/themes/<name>/_astro/` 前缀。                                             |
| Pack URL `/p/bookmarks` 会变成 `/themes/vanblog/p/bookmarks` 吗？ | ❌ 不会。**Pattern 不变**，但请求时 Astro 会从 URL 里剥掉 base 前缀后再 match。                                                     |
| 老 bookmark `/p/bookmarks`（无前缀）还能用吗？                    | ✅ 能。removeBase 对无前缀的 pathname 是 no-op。                                                                                    |
| Caddy 需要特殊配置吗？                                            | 🟡 需要。Caddy 必须把 `/themes/<name>/*` 路由到 theme host，且 theme host 要把 base 前缀保留传给 Astro handler（不能 rewrite 掉）。 |

### 14.5 修正 §3.4 的资源 URL 表

之前文档说「Public 资源 `/favicon.ico` → `/themes/magazine/favicon.ico`」——这个**不完全对**。实测：

| 资源类型                            | URL 形式                                   | 说明                                         |
| ----------------------------------- | ------------------------------------------ | -------------------------------------------- |
| 页面 HTML                           | `/posts/123` 或 `/themes/<name>/posts/123` | 两种都 work（removeBase 兼容）               |
| **建议统一**：所有页面 URL 不带前缀 | `/posts/123`                               | theme host 不给 HTML 加前缀，避免 SEO 双地址 |
| JS/CSS chunks                       | `/themes/<name>/_astro/foo.ABC.js`         | 自动带前缀，caddy file_server 直供           |
| Public 静态资源                     | `/themes/<name>/favicon.ico`               | 自动带前缀                                   |
| API                                 | `/api/posts`                               | **永远不带前缀**（admin/api 禁区）           |
| Pack 页面 URL                       | `/p/bookmarks`                             | 不带前缀（路由 pattern 决定）                |

### 14.6 theme host 的 URL 处理契约（明确）

theme host 接收到请求后：

```ts
// 1. 判断是否是 theme 静态资源
if (
  req.url.startsWith(`/themes/${name}/_astro/`) ||
  req.url.startsWith(`/themes/${name}/static/`)
) {
  // 让 caddy file_server 处理，或 theme host 内部 sirv
  return serveStatic(req, res, themesDir(name));
}

// 2. 其他所有请求（HTML 页面、API、Pack）
//    直接传给 theme handler，URL 不重写
//    Astro handler 自己用 removeBase 兼容带/不带 base 前缀的 URL
return theme.handler(req, res);
```

**关键**：theme host **不重写 URL**，让 Astro 自己处理 base。用户看到的 URL 永远是 `/posts/123`（caddy fallback 路由到 theme host，theme host 透传给 handler）。

### 14.7 对方案 7/8 的影响

这个 spike **同时解除了方案 7 和方案 8 的 P1 风险**：

| 方案                        | 之前担忧                | 实测结论              |
| --------------------------- | ----------------------- | --------------------- |
| 方案 7（单进程 theme host） | Pack 路由会被 base 破坏 | ✅ 不会，pattern 不变 |
| 方案 8（多进程 supervisor） | 同上                    | ✅ 同上               |

**两个方案在「Pack + base」这点上没有差异**，都可以放心推进。

---

## 15. Spike 报告：单进程多 handler 的 cache 共享性（已验证）

> **结论**：**天然隔离**。单进程同时 import 两个 theme 的 `entry.mjs` 时，两个 theme handler 拥有**完全独立的 LRUMap**——无需方案 F、无需任何手动 invalidate。

### 15.1 之前的疑问

§13.6 推测：「`astro/config` 是同一个 module URL → Node ESM cache 返回同一 instance → 共享 LRUMap」。**这个推测是错的**。

### 15.2 源码实证：build 产物里**根本没有 `astro/config`**

```bash
$ grep -rn "from ['\"]astro/config['\"]" themes/vanblog/dist/server/
# (空输出)
```

**Astro 在 build 时已经把 `memoryCache()` inline 编译掉了**，替换成一个独立的虚拟 module：

```
themes/vanblog/dist/server/chunks/_virtual_astro_cache-provider_Nr7WGImU.mjs
                                                                       ^^^^^^^^^^
                                                                       build hash
```

每个 theme build 出来的 `_virtual_astro_cache-provider_<hash>.mjs`：

- 文件名带 build hash → **不同 theme 的 URL 不同**
- 内部 `const cache = new LRUMap(max)` 是**闭包私有**
- 通过 `mod.default` 导出一个 factory

### 15.3 manifest 里的 cacheProvider 是**箭头函数**

```js
// themes/vanblog/dist/server/chunks/server_8bSZCGiz.mjs (manifest)
cacheProvider: () => import("./_virtual_astro_cache-provider_Nr7WGImU.mjs");
```

**每次调用 `pipeline.getCacheProvider()` 都执行这个 `import()`**，Node ESM loader 按 module URL 查 cache。

### 15.4 调用链验证（每 theme 一条独立路径）

读 `server_8bSZCGiz.mjs`：

```
Theme A handler
  └─ appA.pipeline.cacheProvider = () => import('themes/A/dist/.../cache-provider_<hashA>.mjs')
       └─ pipeline.getCacheProvider() (line 3157)
            └─ resolvedCacheProvider = factory(options)   // per-pipeline 私有
                 └─ { onRequest, invalidate } 闭包了 LRUMap #A

Theme B handler
  └─ appB.pipeline.cacheProvider = () => import('themes/B/dist/.../cache-provider_<hashB>.mjs')
       └─ pipeline.getCacheProvider()
            └─ resolvedCacheProvider = factory(options)   // 不同 pipeline
                 └─ { onRequest, invalidate } 闭包了 LRUMap #B  (与 #A 无任何关联)
```

关键点：

- 每个 theme 有独立的 `app` 实例（manifest 不同）
- 每个 `app` 有独立的 `pipeline`（构造时 `cacheProvider = manifest.cacheProvider`）
- 每个 `pipeline.getCacheProvider()` 调用**自己的**箭头函数，import**自己的**虚拟 module
- 两个虚拟 module URL 不同（hash 或路径不同）→ ESM loader 给独立 instance → 独立 LRUMap 闭包

### 15.5 实证 spike：Node ESM 行为

写最小测试 `/tmp/spike-cache-isolation.mjs`：在两个不同临时目录创建**内容完全相同**的 module（模拟「不同 theme dist 里的相同 cache-provider 代码」），同时 import：

```
URL A: file:///.../spike-cache-a-xAfEb3/cache-provider.mjs
URL B: file:///.../spike-cache-b-eTTzKP/cache-provider.mjs
URLs equal? false

cacheA === cacheB? false
cacheA.set('foo', 'FROM_A')
cacheA.get('foo') = FROM_A
cacheB.get('foo') = undefined  (独立 ✅)

cacheA.size = 1
cacheB.size = 0

factoryA === factoryB? false  (不同 module instance)

切到 cacheB 后请求 foo，cacheB 应该 MISS（返回 undefined）
cacheB.get('foo') = undefined  ✅ 天然隔离
```

**Node ESM loader 对「不同 URL 但内容相同」的 module 给完全独立的 instance**——闭包变量互不干扰。

### 15.6 结论：方案 F 是多余的

§13.5 设计的「theme name as tag」方案 **完全不需要**。theme host 切换 theme 时：

```ts
async function switchTheme(newName: string) {
  activeThemeName = newName; // 就这一行
  // 新 theme handler 有自己的 LRUMap，老的 LRUMap 随旧 handler evict 自然 GC
}
```

**theme host 不需要调任何 invalidate API，不需要改 theme.json schema 加 recommendedPalette 之外的 tag，不需要改 theme build 流程注入 tag。**

### 15.7 更新方案 7/8 评判

| 问题                   | 之前的判断                 | 实测后                                                                |
| ---------------------- | -------------------------- | --------------------------------------------------------------------- |
| cache 隔离             | 🟡 方案 F 可解（可能需要） | ✅ **天然隔离**（无需任何代码）                                       |
| ESM module 无法 unload | 🟡 切换 N 次累积           | 🟡 仍存在，但每 theme ~30MB，LRU evict 引用即可让 GC 回收闭包外的对象 |
| 单进程崩溃半径         | 🔴 高                      | 🔴 仍存在，是方案 7 唯一比方案 8 差的地方                             |
| Pack + base 冲突       | 🔴 高                      | ✅ 不存在（§14 已证）                                                 |

**天平倾斜**：方案 7（单进程 theme host）的 4 个主要担忧里，**3 个已解除**。剩下「单进程崩溃半径」是唯一明显劣势——但可以通过 `process.on('unhandledRejection')` + 健康探活 + 自动重启缓解（生产级 Node 服务标准操作）。

**新判断**：方案 7 vs 方案 8 的选择倾向**回到均势**，甚至方案 7 略胜（代码量更少、内存更省、切换更快）。
