# 调色盘 & 主题架构设计

> **目标**：让非技术用户可以通过 AI agent 自定义 Vanblog 前端。分两层：
>
> - **调色盘 (Color Palette)**：改 CSS 变量（颜色、字体、间距）——零风险，纯 CSS
> - **主题 (Theme)**：替换 Astro 页面/布局/组件 —— 改 DOM 结构、布局、交互
>
> **参考**：WordPress / Typecho 的模板系统（template tags + 模板层级 + style.css），但适配 Astro 的组件模型和文件路由。

---

## 1. 概念区分

|                    | 调色盘 (Color Palette)                                 | 主题 (Theme)                                       |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------- |
| **改什么**         | CSS 变量：`--color-bg`、`--color-text`、字体大小、间距 | `.astro` 文件：`pages/`、`layouts/`、`components/` |
| **怎么改**         | 覆盖 `tokens.css`，不改任何 Astro 代码                 | 提供替换的 `.astro` 文件，按需覆盖系统默认         |
| **agent 能做什么** | 改颜色、调字号、换字体                                 | 重组布局、加组件、改 DOM 结构                      |
| **风险**           | 零——CSS 变量改了不会炸页面                             | 低——frontmatter 契约保护数据层不被破坏             |
| **类比**           | WordPress Customizer 的颜色面板                        | WordPress 切换整个 theme                           |

---

## 2. 核心洞察：PHP CMS 怎么做到"逻辑和样式在一起但不会炸"

WordPress 和 Typecho 的模板文件（`index.php`, `single.php`）里确实混着 PHP 逻辑和 HTML。但它们的"不会炸"靠的是：

| 机制             | WordPress                                                                   | Typecho                                                                   |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **数据访问封装** | `the_title()`, `the_content()` — 模板标签函数，内部处理 SQL/缓存/转义       | `$this->title()`, `$this->content()` — Widget 魔术方法，底层 SQL 完全隐藏 |
| **The Loop**     | `while (have_posts()) { the_post(); ... }` — 迭代逻辑和数据指针管理完全隐藏 | `while ($this->next()) { ... }` — 同上                                    |
| **模板层级**     | `single.php` → `singular.php` → `index.php` 逐级 fallback                   | `post.php` → `index.php`，缺失文件不报错                                  |
| **Partial 加载** | `get_header()` 加载 `header.php`，文件缺失 → 静默跳过                       | `$this->need('header.php')` — 同上                                        |

**关键发现**：模板作者从不写 SQL、不管理数据库连接、不处理认证。他们只接触"模板标签"这个窄 API。

---

## 3. Vanblog 的对等映射

| PHP CMS 概念              | Vanblog 现有等价物                                                 | 状态      |
| ------------------------- | ------------------------------------------------------------------ | --------- |
| 模板标签 (`the_title()`)  | SDK 函数：`fmtDate()`, `stripMarkdown()` + 类型化属性 `post.title` | ✅ 已实现 |
| The Loop                  | `{posts.map(post => <JSX />)}`                                     | ✅ 已实现 |
| `get_header()` / `need()` | `<BaseLayout>` + `<slot />`                                        | ✅ 已实现 |
| `style.css`               | `app/src/styles/global.css`（调色盘入口）                          | ✅ 已实现 |
| 模板层级 fallback         | Astro 文件路由（无 fallback 链）                                   | ❌ 待设计 |
| Child themes              | 无                                                                 | ❌ 待设计 |
| `functions.php`           | `middleware.ts` + SDK services                                     | ✅ 已实现 |

---

## 4. 调色盘目录结构（Color Palette）

只改 CSS 变量，不改 Astro 文件。轻量、安全、适合不想折腾的用户。

```
hooks/palettes/{name}/
├── palette.json            ← REQUIRED: 元数据
│   {
│     "name": "midnight",
│     "label": "午夜黑",
│     "version": "1.0.0",
│     "author": "..."
│   }
├── tokens.css              ← 覆盖设计 token（颜色、间距、字体）
├── typography.css          ← 标题/正文样式（可选）
└── components.css          ← 按钮/卡片/导航等组件样式（可选）
```

**加载**：容器启动时 Caddy 读取 `palette.json`，注入 `<link>` 覆盖默认 CSS 变量。不需要重新构建。

---

## 5. 主题目录结构（Theme）— Spike 3 模型（已实现）

每个 theme 是一个**独立的 Astro 项目**，通过 `@vanblog/builtin/*` alias 引用主仓库 `app/src/` 内的 builtin 文件；要改写哪个 builtin 文件，就在 `src/builtin-overrides/<rel>` 放同路径文件，integration 会优先解析它。

> **历史**：v0 草案曾用 `hooks/themes/{name}/` 目录 + 运行时 `injectRoute`。Spike 1-3 验证后改为「每个 theme 是独立 Astro 项目 + alias 覆盖」模型，理由是：Astro 6 的 `injectRoute` 对 `.astro` 文件支持不稳，HMR 不工作；而 `resolveId` 劫持 alias 路径稳定，且能享受 Astro 原生的文件路由和 HMR。

### 5.1 目录结构（绝对路径，基于仓库根）

```
vanblog/
├── app/                          ← 主仓库 Astro 项目（builtin 源头）
│   ├── astro.config.mjs
│   ├── integrations/
│   │   ├── packs/                ← 已存在（Pack 路由注入）
│   │   └── themes/index.mjs      ← ★ theme integration（30 行核心）
│   └── src/                      ← builtin 内容
│       ├── layouts/
│       ├── pages/
│       │   ├── admin/            ← 锁定，theme 不可覆盖
│       │   ├── api/              ← 锁定
│       │   └── ...public pages
│       ├── components/
│       ├── styles/
│       ├── lib/                  ← 锁定
│       ├── loaders/              ← 锁定
│       ├── live.config.ts        ← 锁定
│       └── middleware.ts         ← 锁定
├── themes/                       ← ★ 所有 theme 的根目录
│   └── {name}/                   ← 单个 theme = 一个独立 Astro 项目
│       ├── astro.config.mjs      ← 引用 themes() integration
│       ├── package.json          ← 声明对主仓库的依赖（pnpm workspace 或 file:）
│       ├── theme.json            ← REQUIRED: 主题元数据
│       ├── tsconfig.json
│       ├── public/               ← 主题静态资源（screenshot、字体、favicon 等）
│       └── src/
│           ├── pages/            ← Astro 标准文件路由（thin shell 或完整页面）
│           ├── layouts/          ← theme 自己的 layout（必须提供 PackPage.astro）
│           ├── components/       ← theme 专属组件
│           ├── middleware.ts     ← theme 必须自己提供（可 re-export builtin）
│           ├── live.config.ts    ← theme 必须自己提供（可空 collections）
│           ├── env.d.ts
│           └── builtin-overrides/ ← ★ 覆盖 @vanblog/builtin/<rel> 的同路径文件
│               ├── layouts/
│               ├── components/
│               ├── styles/
│               └── pages/        ← ⚠️ 不能含 admin/、api/
├── hooks/palettes/               ← palette 系统（路径不变，详见 §4）
└── vault/pb_migrations/
    └── 1783100000_add_site_palette_theme_fields.go  ← site.palette + site.activeTheme
```

### 5.2 theme.json 元数据

```json
{
  "name": "default",
  "label": "Vanblog 默认主题",
  "version": "1.0.0",
  "author": "vanblog",
  "description": "官方参考实现，演示 alias + builtin-overrides 模型",
  "screenshot": "./public/screenshot.png",
  "homepage": "https://github.com/.../themes/default"
}
```

`name` 必须与目录名一致；agent 只读这个文件就能知道主题身份。`palette` 字段在 Spike 3 中不再使用——palette 与 theme 解耦，分别由 `site.palette` 和 `site.activeTheme` 控制。

### 5.3 `@vanblog/builtin/*` alias 引用方式

theme 不需要 copy builtin 文件，直接 import 即可：

```astro
---
// themes/my-theme/src/pages/index.astro
import BaseLayout from '@vanblog/builtin/layouts/BaseLayout.astro';
import PostCard from '@vanblog/builtin/components/PostCard.astro';
import { fmtDate } from '@vanblog/sdk';

const posts = Astro.props.posts ?? [];
---
<BaseLayout title="首页">
  {posts.map(p => <PostCard post={p} mode="list" />)}
</BaseLayout>
```

integration 的 Vite plugin 会把 `@vanblog/builtin/layouts/BaseLayout.astro` 解析为：

1. **优先**：`themes/<active>/src/builtin-overrides/layouts/BaseLayout.astro`（如果存在）
2. **fallback**：`app/src/layouts/BaseLayout.astro`（builtin 源头）

### 5.4 覆盖 builtin（builtin-overrides）

要让某个 builtin 文件用 theme 自己的版本，在 `src/builtin-overrides/<rel>` 放同路径文件即可，所有 `import '@vanblog/builtin/<rel>'` 自动指向覆盖版本：

```
themes/my-theme/src/builtin-overrides/
├── layouts/BaseLayout.astro       ← 覆盖 app/src/layouts/BaseLayout.astro
├── components/PostCard.astro      ← 覆盖 app/src/components/PostCard.astro
└── styles/global.css              ← 覆盖 app/src/styles/global.css
```

**最简覆盖例子**（让 BaseLayout 加一个自定义 banner）：

```astro
---
// themes/my-theme/src/builtin-overrides/layouts/BaseLayout.astro
import '@vanblog/builtin/styles/global.css';
const { title } = Astro.props;
---
<html>
  <head><title>{title}</title></head>
  <body>
    <header class="theme-banner">✨ 我的主题</header>
    <slot />
  </body>
</html>
```

### 5.5 设计原则

- **每个 theme 是独立 Astro 项目**：标准 `src/pages/` 文件路由，HMR 原生工作
- **alias 是唯一的 builtin 入口**：theme 永远 `import ... from '@vanblog/builtin/...'`，不要相对路径跨进 `app/src/`
- **覆盖是 opt-in**：`src/builtin-overrides/` 只放你想改的文件，未覆盖的 import 自动落到 builtin
- **theme 必须自带 middleware.ts / live.config.ts**：Astro 项目要求；可以 re-export builtin 的同名文件，详见 theme 作者手册

---

## 5.5 L0/L1/L2 三层 API Surface（约束 builtin 升级破坏性变更）

builtin 升级时哪些改动安全、哪些会破坏 theme？按"距 theme 作者远近"分三层：

### L0 契约层（永远稳定，破坏 = major 版本）

| 类型                     | 示例                                                                                                           | 稳定性保证                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **frontmatter 变量名**   | `posts`、`post`、`site`、`pb`、`totalPages`、`page`                                                            | 永远不删、不改语义；新增字段允许（必须 optional）       |
| **SDK 函数签名**         | `pb.vanblog.posts.listPublished(page, perPage)`、`stripMarkdown(content, len)`、`fmtDate(ts)`、`safe(fn, key)` | 参数名/顺序/返回类型不变；新增参数必须 optional         |
| **PB collection 字段名** | `posts.title`、`posts.content`、`posts.created`                                                                | 与 `vault/pb_migrations/*.go` 锁定，破坏需 major + 迁移 |

L0 是 theme 的"模板标签层"——对应 WordPress 的 `the_title()` / Typecho 的 `$this->title()`。

### L1 组件 API 层（语义稳定，可加不可减）

| 类型                      | 示例                                                                   | 稳定性保证                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **builtin 组件 props 名** | `BaseLayout.title`、`PostCard.post`、`PostCard.mode`、`PackPage.title` | 可加新 props（必须 optional + 合理默认）；不可删旧 props；不可改 prop 类型语义（`string` 不能变 `string \| undefined`） |
| **组件 import 路径**      | `@vanblog/builtin/layouts/BaseLayout.astro`                            | alias 路径不变；文件位置可在 `app/src/` 内部移动                                                                        |

L1 对应 PHP CMS 的 `get_header()` 接口契约。

### L2 内部实现层（无保证，theme 自负）

| 类型                  | 示例                                    | 稳定性保证                          |
| --------------------- | --------------------------------------- | ----------------------------------- |
| **组件内部 DOM 结构** | `<div class="post-card__inner">` 的层级 | 无保证，theme 不应依赖具体 class 名 |
| **CSS class 名**      | `.post-card`、`.btn-primary`            | 无保证，升级可能改名                |
| **内部 helper 函数**  | `app/src/lib/markdown.ts` 内的私有函数  | 无保证                              |
| **组件嵌套结构**      | PostCard 是否包了 `<article>`           | 无保证                              |

**升级规则**：theme 的 `src/builtin-overrides/` 如果只覆盖 L0/L1（重写 frontmatter 调用顺序、改 props 透传），升级 builtin 不会炸；如果依赖 L2（复制 builtin 组件源码后微调 class 名），升级时需要手动 diff。

---

## 6. Agent 安全边界（Spike 3）

### 6.1 Agent 可以碰的区域（SAFE ZONE）

```
themes/{name}/                      ← ✅ 单个 theme 的整个项目根
├── theme.json
├── astro.config.mjs
├── package.json
├── public/
└── src/
    ├── pages/                      ← ✅ theme 自己的页面（Astro 文件路由）
    ├── layouts/                    ← ✅ theme 自己的 layout（含 PackPage.astro）
    ├── components/                 ← ✅ theme 专属组件
    ├── middleware.ts               ← ✅ 必须存在（可 re-export builtin）
    ├── live.config.ts              ← ✅ 必须存在（可空 collections）
    └── builtin-overrides/          ← ✅ 覆盖 builtin（除 §6.2 禁区外）
        ├── layouts/
        ├── components/
        ├── styles/
        └── pages/                  ← ⚠️ 不能含 admin/、api/（见 §6.2）

hooks/palettes/{name}/              ← ✅ 调色盘：改 CSS（零风险）
├── palette.json
├── tokens.css
└── *.css
```

### 6.2 Agent 绝对不能碰的区域（NO-GO ZONE）

`themes/{name}/src/builtin-overrides/` 内不允许覆盖以下路径（integration fail closed，build 时抛错）：

```
src/builtin-overrides/
├── pages/admin/              ← ❌ admin 是 control plane，锁定
├── pages/api/                ← ❌ API 端点是数据层一部分
├── lib/                      ← ❌ Markdown 渲染、图片处理
├── loaders/                  ← ❌ Live Collection loaders
├── live.config.ts            ← ❌ Live Collection 注册（theme 必须自己写一份，但不是 override）
└── middleware.ts             ← ❌ 认证 / pb client 注入（同上）
```

主仓库内以下目录永远不允许 agent 直接修改：

```
app/src/                       ← ❌ builtin 源头，由 vanblog 维护者管理
sdk/src/                       ← ❌ SDK 源码
vault/                         ← ❌ Go 后端
vault/pb_migrations/           ← ❌ 数据库迁移（已锁定）
```

> **机制**：`app/integrations/themes/index.mjs` 中的 `FORBIDDEN_OVERRIDE_PATTERNS` 在 Vite plugin 的 `resolveId` 钩子里校验——只要 `src/builtin-overrides/` 出现上述路径的文件且被 import 触发解析，integration 立即 `throw new Error('FORBIDDEN override: ...')`，dev server 与 prod build 都会 fail。

---

## 7. 加载机制（Spike 3，已实现）

### 7.1 Dev 模式

```
cd themes/<active-theme>/ && astro dev
```

1. theme 自己的 `astro.config.mjs` 注册 `themes()` integration
2. integration 在 `astro:config:setup` 钩子里注册 Vite plugin `vanblog-builtin-resolver`
3. plugin 的 `resolveId` 劫持所有 `@vanblog/builtin/<rel>` 前缀的 import：
   - 先看 `themes/<active>/src/builtin-overrides/<rel>` 是否存在 → 存在则用它
   - 否则 fallback 到 `app/src/<rel>`
4. Astro 标准 HMR 自动工作（修改 override 文件、builtin 文件都触发热更）
5. 修改 site.activeTheme 后需要重启 dev server（alias 解析在启动时配置）

### 7.2 Prod 模式（Dockerfile 已实现）

```dockerfile
ARG VANBLOG_ACTIVE_THEME=default
COPY themes/${VANBLOG_ACTIVE_THEME}/ /build/theme/
COPY app/ /build/app/        # integration + builtin 源头
WORKDIR /build/theme
RUN pnpm install && pnpm build
# 输出 /build/themes/<active>/dist/
RUN echo "${VANBLOG_ACTIVE_THEME}" > /build/.active-theme

# prod stage:
COPY --from=astro-build /build/.active-theme /etc/vanblog/active-theme
RUN ln -s "/build/themes/$(cat /etc/vanblog/active-theme)" /app
```

- prod 镜像构建时由 `--build-arg VANBLOG_ACTIVE_THEME=<name>` 选定主题
- entrypoint.prod.sh 启动时读 `/etc/vanblog/active-theme` 校验与 `site.activeTheme` 一致

### 7.3 Theme 切换

| 模式     | 操作                               | 生效方式                                                                                   |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| **dev**  | admin 改 `site.activeTheme` → 保存 | 重启 dev server（alias 在启动时配置）                                                      |
| **prod** | admin 改 `site.activeTheme` → 保存 | 提示用户重建镜像：`docker build --build-arg VANBLOG_ACTIVE_THEME=<name> -t vanblog:prod .` |

prod 不能运行时切换主题，因为 Astro 是编译时生成路由——切主题等于换一个 build 产物。

### 7.4 Palette 切换（零 build，已实现）

Palette 与 theme 完全解耦，**任何时候都可以零 build 切换**：

1. `app/src/pages/api/palette.css.ts` 端点动态返回 CSS：读 `site.palette` → 拼接 `hooks/palettes/<name>/{tokens,typography,components}.css`
2. BaseLayout 注入 `<link rel="stylesheet" href="/api/palette.css?v={site.updated}">`
3. 端点返回 `Cache-Control: no-cache` + URL 的 `?v={site.updated}` 防缓存
4. admin 改 `site.palette` → 前端自动重新拉 CSS，无需重启、无需 build

---

## 8. MCP Tools（Agent 可用）

### 8.1 文件操作类

| Tool         | 能力                                | 安全边界                                                                                                                            |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `read_file`  | 读 theme / palette 目录内的任何文件 | 路径限制在 `themes/{name}/` 或 `hooks/palettes/{name}/`                                                                             |
| `write_file` | 写文件                              | 同上；`themes/{name}/src/builtin-overrides/{admin,api,lib,loaders,live.config,middleware}` 路径写入会被 integration 在 build 时拒绝 |
| `list_dir`   | 列出目录结构                        | 只读                                                                                                                                |
| `preview`    | 触发浏览器预览（截图/URL）          | 只读                                                                                                                                |

### 8.2 构建与验证类

| Tool           | 能力                                                                         | 安全边界                                         |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `build`        | `pnpm build` 构建 theme                                                      | dev 模式专用；触发 integration 的 FORBIDDEN 校验 |
| `upgrade_diff` | 扫描 `src/builtin-overrides/` 与 builtin 源头 diff，列出 L0/L1/L2 破坏性变更 | 只读；agent 升级 builtin 时必须先跑              |

### 8.3 数据查询类（只读）

| Tool        | 能力                 | 安全边界                   |
| ----------- | -------------------- | -------------------------- |
| `pb_schema` | 读取 pb 集合 schema  | 只读                       |
| `pb_query`  | 执行只读 pb API 查询 | `GET` only，不能写 pb 数据 |

> **最小权限原则**：agent 只能写 `themes/{name}/` 和 `hooks/palettes/{name}/` 两个根目录；admin/api/lib/loaders/middleware/live.config 在 integration 层 fail closed。

---

## 9. 与 PHP CMS 的差异

| PHP CMS 能做到的                                      | Vanblog 当前                 | 计划                                                                  |
| ----------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| 模板层级 fallback（缺 `single.php` → 用 `index.php`） | ❌ Astro 文件路由无 fallback | 通过构建脚本生成 fallback（非运行时）                                 |
| 运行时切换调色盘                                      | ❌                           | ✅ site.palette → `/api/palette.css` 端点动态返回（已实现，零 build） |
| 运行时切换主题                                        | ❌                           | ⚠️ dev 重启 / prod 重建镜像（Astro 编译时生成路由）                   |
| Child theme 继承                                      | ❌                           | `theme.json.parent` 字段（不在 v1 范围）                              |
| `wp_enqueue_style()` / 条件加载 CSS                   | ⚠️ 手动 `<link>`             | 保留手动方式（agent 可控）                                            |
| Widget areas / 动态侧边栏                             | ❌                           | 不在 v1 范围                                                          |
| 模板内条件标签 (`is_home()`, `is_single()`)           | ✅ `Astro.url.pathname`      | 已可用                                                                |

---

## 10. 已决问题与待决问题

### 已决（Spike 3，2026-07-26）

1. **Astro 页面覆盖的实现方式**：✅ 已决——alias + `src/builtin-overrides/` 覆盖模型。每个 theme 是独立 Astro 项目，通过 Vite plugin `resolveId` 劫持 `@vanblog/builtin/*` alias 实现按需覆盖。无需 `injectRoute`、无需 submodule、无需 Dockerfile cp。
2. **theme.json 覆盖 vs 完整模板**：✅ 已决——**alias + builtin-overrides 覆盖模式**（Spike 3）。theme 只放想改的文件，未覆盖的 import 自动落到 builtin。介于 child theme（文件级覆盖）和独立 theme（完整副本）之间，兼顾灵活性和升级安全。
3. **Agent 契约注释的格式**：✅ 已决——三层 API surface 模型（L0 契约层 / L1 组件 API 层 / L2 内部实现层），由 `upgrade_diff` MCP 工具在升级时扫描 builtin-overrides 与 builtin 源头的 diff 自动判断破坏性变更。无需在文件内写 `⛔ AGENT:` 注释。

### 待决

4. **MCP 安全性**：Agent 通过 MCP 获得什么权限？最小权限原则——只能写 `themes/{name}/` 和 `hooks/palettes/{name}/` 目录，只能 GET 读 pb API，不能写 pb 数据。具体实现细节待 MCP 协议层落地。
5. **调色盘 vs 主题的优先级**：✅ 已决（Spike 3）——palette 与 theme 解耦，`site.palette` 和 `site.activeTheme` 是两个独立字段；theme 不再在 `theme.json` 里绑定 palette。用户单独选的 palette 永远生效，与当前 theme 无关。
