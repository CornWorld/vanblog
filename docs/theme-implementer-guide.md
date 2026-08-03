# Vanblog Theme 作者手册

> **目标读者**：想写自己 theme 的人（或写 theme 的 AI agent）。
> **前置阅读**：[`docs/theme-concepts.md`](./theme-concepts.md)（平台层 / base 主题 / vanblog 主题 的概念区分）。
>
> **Spike 3 模型一句话**：每个 theme 是一个**独立的 Astro 项目**，通过 `@vanblog/base/*` alias 引用主仓库的 base 文件；要改写哪个 base 文件，就在 `src/base-overrides/<rel>` 放同路径文件。

---

## 目录

1. [Quick Start](#1-quick-start)
2. [Theme 项目结构](#2-theme-项目结构)
3. [`@vanblog/base/*` alias 引用方式](#3-vanblogbase-alias-引用方式)
4. [覆盖 base（base-overrides）](#4-覆盖-basebase-overrides)
5. [L0/L1/L2 三层 API Surface](#5-l0l1l2-三层-api-surface)
6. [模板契约清单（frontmatter 变量）](#6-模板契约清单frontmatter-变量)
7. [禁区列表](#7-禁区列表)
8. [升级流程](#8-升级流程)
9. [完整最小 theme 示例](#9-完整最小-theme-示例)
10. [Dockerfile build](#10-dockerfile-build)

---

## 1. Quick Start

```bash
# 1. 从模板初始化（脚本会创建 themes/my-theme/ 目录）
node scripts/theme-init.mjs my-theme

# 2. 进入 theme 项目
cd themes/my-theme

# 3. 安装依赖（pnpm workspace 会自动链接主仓库的 app/ 作为 base 源）
pnpm install

# 4. 启动 dev server（默认 http://localhost:4321）
pnpm dev
```

打开浏览器看到首页 = theme 已经跑起来了。`themes/base` 是官方最小模板，克隆后自带一套极简 public 页面（首页/文章/归档/时间轴/搜索/分类/标签/关于/404），页面直接通过 `@vanblog/base/*` alias 引用平台层（`app/src/`）的布局、lib、admin、api。

**下一步**：改首页布局 → 编辑 `themes/my-theme/src/pages/index.astro`；覆盖 base BaseLayout → 新建 `themes/my-theme/src/base-overrides/layouts/BaseLayout.astro`。

---

## 2. Theme 项目结构

一个 theme 就是一个标准 Astro 项目，目录树（基于仓库根的绝对路径）：

```
themes/{name}/                       ← 单个 theme 的根
├── astro.config.mjs                 ← 引用 themes() integration
├── package.json                     ← 声明对主仓库的依赖
├── theme.json                       ← REQUIRED: 主题元数据
├── tsconfig.json
├── public/                          ← 主题静态资源
│   ├── screenshot.png               ← theme.json.screenshot 指向
│   ├── favicon.ico
│   └── fonts/
└── src/
    ├── pages/                       ← Astro 标准文件路由
    │   ├── index.astro              ← 首页（thin shell 或完整重写）
    │   ├── posts/
    │   │   └── [id].astro           ← 文章页
    │   ├── archive.astro            ← 归档
    │   ├── timeline.astro           ← 时间轴
    │   ├── search.astro             ← 搜索
    │   ├── categories/
    │   │   ├── index.astro          ← 分类索引
    │   │   └── [id].astro           ← 分类详情
    │   ├── tags/
    │   │   ├── index.astro          ← 标签索引
    │   │   └── [id].astro           ← 标签详情
    │   ├── about.astro              ← 关于
    │   └── 404.astro
    ├── layouts/
    │   └── PackPage.astro           ← REQUIRED: Pack 页面的 host
    ├── components/                  ← theme 专属组件
    ├── middleware.ts                ← REQUIRED: 可 re-export base
    ├── live.config.ts               ← REQUIRED: 可空 collections
    ├── env.d.ts
    └── base-overrides/           ← ★ 覆盖 @vanblog/base/<rel>
        ├── layouts/
        ├── components/
        ├── styles/
        └── pages/                   ← ⚠️ 不能含 admin/、api/
```

### 2.1 theme.json（REQUIRED）

```json
{
  "name": "my-theme",                              ← 必须与目录名一致
  "label": "我的主题",                              ← 用户可见的显示名
  "version": "1.0.0",
  "author": "你的名字 <email@example.com>",
  "description": "一句话描述这个主题",
  "screenshot": "./public/screenshot.png",
  "homepage": "https://github.com/.../my-theme"
}
```

> `name` 是主仓库 `site.activeTheme` 字段要填的值——admin 改这个字段切换主题。

### 2.2 package.json（最小示例）

```json
{
  "name": "@vanblog/theme-my-theme",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  },
  "dependencies": {
    "astro": "^6.0.0",
    "@vanblog/sdk": "workspace:*"
  }
}
```

主仓库通过 pnpm workspace 暴露 `@vanblog/sdk`；`@vanblog/base/*` alias 不需要写进 dependencies，由 `themes()` integration 在 Vite plugin 层解析。

### 2.3 astro.config.mjs（最小示例）

```js
import { defineConfig } from "astro/config";
import themesIntegration from "../../app/integrations/themes/index.mjs";
import packsIntegration from "../../app/integrations/packs/index.mjs";

export default defineConfig({
  integrations: [
    themesIntegration({
      themeSrcDir: "./src", // 当前 theme 的 src/
      mainAppSrcDir: "../../app/src", // 主仓库 base 源头
    }),
    packsIntegration({
      themePage: "./src/layouts/PackPage.astro", // 让 Pack 路由用 theme 的 host
    }),
  ],
});
```

### 2.4 必须存在的文件

| 文件                         | 为什么必须                                             | 最小内容                                                    |
| ---------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `src/middleware.ts`          | Astro 项目要求；base 页面通过 `Astro.locals.pb` 拿数据 | `export { onRequest } from '@vanblog/base/middleware';`     |
| `src/live.config.ts`         | Astro Live Collections 注册                            | `export const collections = {};`（可空）                    |
| `src/layouts/PackPage.astro` | Pack 页面（`/p/<pack>`）必须有 host                    | 见 [§9.4](#94-packpageastro-必须提供)                       |
| `src/env.d.ts`               | TypeScript 引用类型                                    | `/// <reference path="../.astro/types.d.ts" />`（脚本生成） |

---

## 3. `@vanblog/base/*` alias 引用方式

theme 永远用 `@vanblog/base/<rel>` 引用 base，**不要相对路径跨进 `app/src/`**。integration 的 Vite plugin 会把 alias 解析为：

1. **优先**：`themes/<active>/src/base-overrides/<rel>`（如果存在）
2. **fallback**：`app/src/<rel>`（base 源头）

### 3.1 引用 base 组件

```astro
---
// themes/my-theme/src/pages/index.astro
import BaseLayout from '@vanblog/base/layouts/BaseLayout.astro';
import PostCard from '@vanblog/base/components/PostCard.astro';
---
<BaseLayout title="首页">
  {posts.map(p => <PostCard post={p} mode="list" />)}
</BaseLayout>
```

### 3.2 引用 base 样式

```astro
---
// 在任意 .astro 文件顶部
import '@vanblog/base/styles/global.css';
import '@vanblog/base/styles/markdown.css';
---
```

### 3.3 引用 base 工具函数（如果有）

```ts
// themes/my-theme/src/components/MyCard.astro
import { fmtDate } from "@vanblog/sdk"; // ← SDK 走 @vanblog/sdk，不是 @vanblog/base
import { safe } from "@vanblog/base/lib/safe"; // ← 内部工具走 @vanblog/base/lib/...
```

> **注意**：公开 API（`fmtDate`、`stripMarkdown`、`safe`、`pb.vanblog.*`）走 `@vanblog/sdk`，是 L0 契约层；`@vanblog/base/lib/*` 是 L2 内部层，**无稳定性保证**，升级时自负。

### 3.4 alias 解析规则（重要）

| 情况                                                                                                   | 解析结果                                      |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `import '@vanblog/base/layouts/BaseLayout.astro'` + 无 override                                        | `app/src/layouts/BaseLayout.astro`            |
| `import '@vanblog/base/layouts/BaseLayout.astro'` + `src/base-overrides/layouts/BaseLayout.astro` 存在 | `src/base-overrides/layouts/BaseLayout.astro` |
| `import '@vanblog/base/pages/api/revalidate'`                                                          | **永远解析到 `app/src/`，禁止覆盖**（见 §7）  |
| `import '@vanblog/base/lib/markdown.ts'`                                                               | **永远解析到 `app/src/`，禁止覆盖**           |

---

## 4. 覆盖 base（base-overrides）

要让某个 base 文件用 theme 自己的版本，在 `src/base-overrides/<rel>` 放同路径文件——**所有** `import '@vanblog/base/<rel>'` 自动指向覆盖版本。

### 4.1 覆盖规则

| 项                    | 说明                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **路径必须精确匹配**  | 覆盖 `app/src/layouts/BaseLayout.astro` → 放 `src/base-overrides/layouts/BaseLayout.astro`（相对路径不带 `app/src/` 前缀） |
| **覆盖是全局的**      | 一旦放 override，所有引用该 alias 的位置都拿到 override（包括 base 自己内部 import）                                       |
| **覆盖是 opt-in**     | 只覆盖你想改的；其余 import 自动落到 base                                                                                  |
| **覆盖会被 HMR 监听** | 改 override 文件 → 即时热更                                                                                                |

### 4.2 例子 1：给 BaseLayout 加自定义 banner

base 的 `app/src/layouts/BaseLayout.astro` 长这样（简化）：

```astro
---
const { title } = Astro.props;
---
<html>
  <head><title>{title}</title></head>
  <body><slot /></body>
</html>
```

theme 想在所有页面顶部加一个 banner。**新建** `themes/my-theme/src/base-overrides/layouts/BaseLayout.astro`：

```astro
---
import '@vanblog/base/styles/global.css';
const { title } = Astro.props;
---
<html>
  <head><title>{title}</title></head>
  <body>
    <header class="theme-banner">✨ 我的主题</header>
    <slot />
  </body>
</html>

<style>
.theme-banner {
  padding: 0.5rem 1rem;
  background: var(--color-accent, #0070f3);
  color: white;
  text-align: center;
}
</style>
```

保存后所有页面顶部自动出现 banner——因为 base 页面都 `import BaseLayout from '@vanblog/base/layouts/BaseLayout.astro'`，alias 解析到这个 override 文件。

### 4.3 例子 2：覆盖 PostCard 组件

base 的 `app/src/components/PostCard.astro` 接受 `post` 和 `mode` props（L1 契约）。theme 想改卡片样式：

```astro
---
// themes/my-theme/src/base-overrides/components/PostCard.astro
const { post, mode = 'list' } = Astro.props;
---
<article class={`card card--${mode}`}>
  <h3><a href={`/posts/${post.id}`}>{post.title}</a></h3>
  <time>{new Date(post.created).toLocaleDateString()}</time>
  {mode === 'list' && <p>{post.excerpt}</p>}
</article>

<style>
.card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: transform 0.2s;
}
.card:hover { transform: translateY(-2px); }
</style>
```

> **L1 契约提醒**：`post` 和 `mode` 是 L1 props，**必须保留**（不能改名、不能改类型语义）。可以加新 props（必须 optional + 有默认值）。详见 [§5](#5-l0l1l2-三层-api-surface)。

### 4.4 例子 3：覆盖全局样式

base 的 `app/src/styles/global.css` 定义了 CSS 变量。theme 想覆盖某个变量但保留其他：

```css
/* themes/my-theme/src/base-overrides/styles/global.css */
@import "@vanblog/base/styles/global.css"; /* ← 这样写会递归指向自己！*/

/* 正确做法：直接复制 base 的 global.css 内容，然后改 */
:root {
  --color-bg: #fafafa;
  --color-text: #1a1a1a;
  --color-accent: #ff6b6b;
  --font-sans: "Inter", system-ui, sans-serif;
  --max-width: 720px;
}
/* ...其余 base 变量原样复制... */
```

> ⚠️ **覆盖 CSS 文件时不能用 `@import` 引用被覆盖的同名文件**——那会递归指向自己。要么完整复制 base 的 CSS 然后改，要么把覆盖拆成两个文件（覆盖 `global.css` 时只写新增变量，base 那份在 `app/src/styles/global.css` 不动，通过 `@vanblog/base/styles/base.css` 引用——如果 base 拆分了的话）。

---

## 5. L0/L1/L2 三层 API Surface

base 升级时哪些改动安全、哪些会破坏 theme？按"距 theme 作者远近"分三层：

### 5.1 L0 契约层（永远稳定）

| 类型                     | 示例                                                                                                           | 稳定性保证                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **frontmatter 变量名**   | `posts`、`post`、`site`、`pb`、`totalPages`、`page`                                                            | 永远不删、不改语义；新增字段允许（必须 optional）       |
| **SDK 函数签名**         | `pb.vanblog.posts.listPublished(page, perPage)`、`stripMarkdown(content, len)`、`fmtDate(ts)`、`safe(fn, key)` | 参数名/顺序/返回类型不变；新增参数必须 optional         |
| **PB collection 字段名** | `posts.title`、`posts.content`、`posts.created`、`posts.tags`、`posts.category`                                | 与 `vault/pb_migrations/*.go` 锁定，破坏需 major + 迁移 |

**theme 该怎么用 L0**：放心依赖，base 升级不会炸。对应 PHP CMS 的 `the_title()` / `$this->title()`。

```astro
---
// ✅ 安全：依赖 L0 frontmatter 变量
const { posts, totalPages, page } = Astro.props;
// ✅ 安全：依赖 L0 SDK 函数
import { fmtDate, stripMarkdown } from '@vanblog/sdk';
---
```

### 5.2 L1 组件 API 层（语义稳定，可加不可减）

| 类型                   | 示例                                                                   | 稳定性保证                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **base 组件 props 名** | `BaseLayout.title`、`PostCard.post`、`PostCard.mode`、`PackPage.title` | 可加新 props（必须 optional + 合理默认）；**不可删旧 props**；不可改 prop 类型语义（`string` 不能变 `string \| undefined`） |
| **组件 import 路径**   | `@vanblog/base/layouts/BaseLayout.astro`                               | alias 路径不变；文件位置可在 `app/src/` 内部移动                                                                            |

**theme 该怎么用 L1**：覆盖组件时保留所有现有 props 的名字和类型；可以加新 props 但要给默认值。

```astro
---
// themes/my-theme/src/base-overrides/components/PostCard.astro
// ✅ 保留 L1 props：post, mode
// ✅ 加新 props：variant（optional + 有默认值）
const { post, mode = 'list', variant = 'default' } = Astro.props;
---
```

### 5.3 L2 内部实现层（无保证，theme 自负）

| 类型                  | 示例                                                     | 稳定性保证                          |
| --------------------- | -------------------------------------------------------- | ----------------------------------- |
| **组件内部 DOM 结构** | `<div class="post-card__inner">` 的层级                  | 无保证，theme 不应依赖具体 class 名 |
| **CSS class 名**      | `.post-card`、`.btn-primary`、`.header__nav`             | 无保证，升级可能改名                |
| **内部 helper 函数**  | `app/src/lib/markdown.ts` 内的私有函数                   | 无保证                              |
| **组件嵌套结构**      | PostCard 是否包了 `<article>`；BaseLayout 是否含 `<nav>` | 无保证                              |

**theme 该怎么用 L2**：**尽量别依赖**。如果你的 override 复制了 base 组件源码然后改 class 名，base 升级时你需要跑 `upgrade_diff` MCP 工具看 diff，手动适配。

```astro
---
// ❌ 危险：依赖 L2 内部 class 名
import '@vanblog/base/components/PostCard.astro';
---
<!-- 假设 base 的 PostCard 输出 .post-card__inner，升级可能改名 -->
<div class="wrapper">
  <div class="post-card__inner">...</div>   <!-- ← 这个 class 名无保证 -->
</div>
```

### 5.4 升级时的破坏性判断

| 你的 override 依赖的层                         | base 升级时                                   | 你需要做什么                     |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------- |
| 只依赖 L0                                      | 不会炸                                        | 无需做事                         |
| 依赖 L1（覆盖 base 组件，保留 props）          | 极少炸（除非 base 删了 prop，这违反 L1 契约） | 跑 `upgrade_diff` 看一眼         |
| 依赖 L2（复制源码改 class、依赖内部 DOM 结构） | 可能炸                                        | 必须跑 `upgrade_diff` + 手动适配 |

---

## 6. 模板契约清单（frontmatter 变量）

每个 base 页面在 frontmatter 里拿到一组固定变量（L0 契约）。theme 的 `src/pages/<same-path>.astro` 必须消费这些变量——可以重组布局，不能改变量名。

### 6.1 Public 页面（路径前缀 `pages/`，被 BaseLayout 包裹）

| 页面路径                       | frontmatter 契约变量                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `pages/index.astro`            | `posts: PostExpand[]`, `totalPages: number`, `page: number`                       |
| `pages/posts/[id].astro`       | `post: Post \| null`, `html: string \| null`, `id: string`, `site: Site`          |
| `pages/archive.astro`          | `posts: Post[]`, `years: number[]`                                                |
| `pages/timeline.astro`         | `entries: TimelineEntry[]`                                                        |
| `pages/search.astro`           | `q: string`, `results: SearchResult[]`                                            |
| `pages/categories/index.astro` | `categories: Category[]`                                                          |
| `pages/categories/[id].astro`  | `category: Category`, `posts: PostExpand[]`, `totalPages: number`, `page: number` |
| `pages/tags/index.astro`       | `tags: Tag[]`                                                                     |
| `pages/tags/[id].astro`        | `tag: Tag`, `posts: PostExpand[]`, `totalPages: number`, `page: number`           |
| `pages/about.astro`            | `site: Site`, `html: string`, `updatedAt: string`                                 |
| `pages/404.astro`              | （无）                                                                            |

### 6.2 Pack 页面（`packs/*/pages/index.astro`，不是 theme 的页面）

Pack 页面（如 `/p/bookmarks`）必须用 theme 提供的 PackPage host 包裹：

```astro
---
// packs/bookmarks/pages/index.astro
import { Page } from 'vanblog:theme';       // ← 这是 packs integration 注入的虚拟模块
const { items } = Astro.props;
---
<Page title="书签">
  <ul>{items.map(b => <li>{b.title}</li>)}</ul>
</Page>
```

theme 必须提供 `src/layouts/PackPage.astro`（或 `src/base-overrides/layouts/PackPage.astro`），详见 [§9.4](#94-packpageastro-必须提供)。

### 6.3 Admin 页面（独立 admin SSR app，**不随主题编译**）

admin / login / setup 是 control plane，由**独立的 admin SSR app**（`app/`，构建产物 `app/dist`）服务，theme host 在 `/admin`、`/login`、`/setup` 特判转发到该 app。**theme 不提供、也不覆盖 admin 页面**——它们甚至不存在于主题构建产物里，因此主题构建更轻。主题作者无需关心 admin 的实现与契约。

### 6.4 frontmatter 变量的标准消费模式

```astro
---
// themes/my-theme/src/pages/index.astro
import BaseLayout from '@vanblog/base/layouts/BaseLayout.astro';
import PostCard from '@vanblog/base/components/PostCard.astro';
import { fmtDate } from '@vanblog/sdk';

// L0 契约变量：posts, totalPages, page
const { posts, totalPages, page } = Astro.props;
---
<BaseLayout title="首页">
  <main class="post-list">
    {posts.map(p => <PostCard post={p} mode="list" />)}
  </main>

  {totalPages > 1 && (
    <nav class="pagination">
      {page > 1 && <a href={`/?page=${page - 1}`}>上一页</a>}
      <span>{page} / {totalPages}</span>
      {page < totalPages && <a href={`/?page=${page + 1}`}>下一页</a>}
    </nav>
  )}
</BaseLayout>
```

> **frontmatter 变量从哪来**：base 的 `app/src/pages/index.astro` 通过 `live.config.ts` 注册的 Live Collection 在 frontmatter 注入这些变量。theme 的同名页面也会被 Astro 注入同样的变量——这是 L0 契约的运行时保证。

---

## 7. 禁区列表

`themes/{name}/src/base-overrides/` 内**不允许**覆盖以下路径。integration 在 Vite plugin `resolveId` 钩子里校验，命中即 `throw new Error('FORBIDDEN override: ...')`，dev server 与 prod build 都会 fail closed。

| 禁区路径                                     | 为什么锁定                                                        |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `src/base-overrides/pages/admin/**`          | admin 是 control plane，锁定                                      |
| `src/base-overrides/pages/api/**`            | API 端点是数据层一部分                                            |
| `src/base-overrides/lib/**`                  | Markdown 渲染、图片处理、内部 helper                              |
| `src/base-overrides/loaders/**`              | Live Collection loaders 喂 base 页面                              |
| `src/base-overrides/live.config.{ts,js,mjs}` | Live Collection 注册（theme 必须自己写一份，但**不是 override**） |
| `src/base-overrides/middleware.{ts,js}`      | 认证 / pb client 注入（同上）                                     |

### 7.1 theme 必须自己提供（但不是 override）

以下文件 theme **必须**在 `src/` 里有一份（不在 `base-overrides/` 里），Astro 项目才能跑：

| 文件                 | 最小内容                                                | 说明                                            |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `src/middleware.ts`  | `export { onRequest } from '@vanblog/base/middleware';` | re-export base，让 `Astro.locals.pb` 可用       |
| `src/live.config.ts` | `export const collections = {};`                        | 可空；theme 想加自己的 Live Collection 在这里加 |

这两个文件**在 theme 的 `src/` 里**，不在 `src/base-overrides/` 里。区别：

- `src/middleware.ts` = Astro 项目的入口文件，theme 必须自己有
- `src/base-overrides/middleware.ts` = 覆盖 base 的 middleware 给别人 import，**禁止**

### 7.2 主仓库内 agent/theme 不能碰的目录

```
app/src/             ← base 源头，由 vanblog 维护者管理
sdk/src/             ← SDK 源码
vault/               ← Go 后端
vault/pb_migrations/ ← 数据库迁移（已锁定）
```

---

## 8. 升级流程

theme 作者 pull 主仓库后，base 自动更新（alias 解析到新的 `app/src/`）。**绝大多数升级不会炸 theme**，因为：

- 你的 `src/pages/*.astro` 只依赖 L0 frontmatter 变量（永远稳定）
- 你的 `src/base-overrides/` 如果只覆盖 L1（保留 props），base 加新 props 也不影响你
- 只有当你的 override 依赖 L2（复制源码改 class 名、依赖内部 DOM 结构）时，才可能炸

### 8.1 标准升级流程

```bash
# 1. 拉主仓库
cd /path/to/vanblog
git pull origin main

# 2. 进 theme 目录，跑 upgrade_diff（MCP 工具，或手动 diff）
cd themes/my-theme
# 通过 MCP 调用 upgrade_diff，扫描 src/base-overrides/ 与 app/src/ 的同名文件 diff
# 输出：哪些 override 涉及 L0/L1 破坏性变更、哪些只是 L2 视觉差异

# 3. 根据 diff 报告修复（通常只需要改几个 class 名）
# 4. dev 预览 + build 验证
pnpm dev
pnpm build
```

### 8.2 手动 diff（没有 MCP 工具时）

```bash
# 列出 theme 的所有 override 文件
find themes/my-theme/src/base-overrides -type f

# 对每个 override，与 base 源头 diff
diff themes/my-theme/src/base-overrides/layouts/BaseLayout.astro \
     app/src/layouts/BaseLayout.astro
```

重点看：

- **L0 破坏**：frontmatter 变量名变了？SDK 函数签名变了？（极少见，会写在 CHANGELOG）
- **L1 破坏**：base 删了某个 prop？改了 prop 类型？（违反契约，应该报 bug）
- **L2 差异**：DOM 结构、class 名变了？（你自己适配）

### 8.3 升级检查清单

| 检查项                             | 怎么做                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| theme 还能 build                   | `pnpm build` 不报错                                                            |
| 首页/文章页/归档正常渲染           | dev 模式逐个点一遍                                                             |
| 覆盖的 BaseLayout 没破坏 base 页面 | 看 admin 页面（admin 也用 BaseLayout，如果你的 override 破坏了它会有视觉异常） |
| Pack 页面（`/p/<pack>`）还能用     | 访问 `/p/bookmarks` 看 PackPage host 正常                                      |
| Palette 切换不影响 theme           | admin 改 `site.palette`，theme 的 CSS 变量应该跟着变                           |

---

## 9. 完整最小 theme 示例

从空 theme 开始，覆盖首页 + 加自定义组件，演示完整流程。

### 9.1 初始化

```bash
node scripts/theme-init.mjs my-theme
cd themes/my-theme
pnpm install
pnpm dev   # 此时所有页面都是 thin shell，re-export base
```

### 9.2 项目结构（初始化后）

```
themes/my-theme/
├── astro.config.mjs
├── package.json
├── theme.json
├── tsconfig.json
├── public/
│   └── screenshot.png
└── src/
    ├── pages/                    ← thin shells（re-export base）
    │   ├── index.astro           ← export { default } from '@vanblog/base/pages/index.astro';
    │   ├── posts/[id].astro
    │   ├── ...（其余 25 个页面）
    │   └── 404.astro
    ├── layouts/
    │   └── PackPage.astro        ← REQUIRED
    ├── components/               ← 空
    ├── middleware.ts             ← export { onRequest } from '@vanblog/base/middleware';
    ├── live.config.ts            ← export const collections = {};
    ├── env.d.ts
    └── base-overrides/        ← 空（先不覆盖任何东西）
```

### 9.3 覆盖首页布局

把 `src/pages/index.astro` 从 thin shell 改成完整页面：

```astro
---
// themes/my-theme/src/pages/index.astro
import BaseLayout from '@vanblog/base/layouts/BaseLayout.astro';
import { fmtDate } from '@vanblog/sdk';
import HeroBanner from '../components/HeroBanner.astro';

// L0 契约变量
const { posts, totalPages, page } = Astro.props;
---
<BaseLayout title="首页">
  <HeroBanner />

  <main class="post-grid">
    {posts.map(p => (
      <article class="post-item">
        <h2><a href={`/posts/${p.id}`}>{p.title}</a></h2>
        <time>{fmtDate(p.created)}</time>
        {p.excerpt && <p>{p.excerpt}</p>}
      </article>
    ))}
  </main>

  {totalPages > 1 && (
    <nav class="pagination">
      {page > 1 && <a href={`/?page=${page - 1}`}>← 上一页</a>}
      <span>{page} / {totalPages}</span>
      {page < totalPages && <a href={`/?page=${page + 1}`}>下一页 →</a>}
    </nav>
  )}
</BaseLayout>

<style>
.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}
.post-item {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
}
.pagination {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 2rem 0;
}
</style>
```

### 9.4 PackPage.astro（必须提供）

Pack 路由（`/p/<pack>`）需要一个 host 组件。最小实现：

```astro
---
// themes/my-theme/src/layouts/PackPage.astro
import BaseLayout from '@vanblog/base/layouts/BaseLayout.astro';
const { title } = Astro.props;
---
<BaseLayout title={title}>
  <slot />
</BaseLayout>
```

`packs` integration 注入的虚拟模块 `vanblog:theme` 会 resolve 到这个文件，Pack 页面 `import { Page } from 'vanblog:theme'` 拿到的就是它。

### 9.5 加自定义组件

```astro
---
// themes/my-theme/src/components/HeroBanner.astro
const site = Astro.props.site ?? { name: 'My Blog', description: '' };
---
<section class="hero">
  <h1>{site.name}</h1>
  {site.description && <p>{site.description}</p>}
</section>

<style>
.hero {
  text-align: center;
  padding: 4rem 1rem;
  background: linear-gradient(135deg, var(--color-accent, #0070f3), #0050d0);
  color: white;
}
.hero h1 { font-size: 3rem; margin: 0; }
.hero p { font-size: 1.25rem; opacity: 0.9; }
</style>
```

### 9.6 覆盖 BaseLayout 让全站加 banner

```astro
---
// themes/my-theme/src/base-overrides/layouts/BaseLayout.astro
import '@vanblog/base/styles/global.css';
const { title } = Astro.props;
---
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>{title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <header class="site-header">
      <a href="/" class="logo">My Blog</a>
      <nav>
        <a href="/archive">归档</a>
        <a href="/categories">分类</a>
        <a href="/tags">标签</a>
        <a href="/about">关于</a>
      </nav>
    </header>
    <main><slot /></main>
    <footer>© {new Date().getFullYear()} My Blog</footer>
  </body>
</html>

<style>
.site-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--color-border);
}
.site-header nav { display: flex; gap: 1rem; }
main { max-width: var(--max-width, 720px); margin: 0 auto; padding: 2rem 1rem; }
</style>
```

### 9.7 验证

```bash
pnpm dev
# 访问 http://localhost:4321
#   - 首页：grid 布局 + HeroBanner
#   - 文章/归档/etc：用新的 BaseLayout（顶部有 header）
#   - /p/bookmarks：用 PackPage host（也套了新 BaseLayout）
pnpm build   # 确保能构建出 dist/
```

---

## 10. Dockerfile build

prod 镜像构建时由 `--build-arg VANBLOG_ACTIVE_THEME=<name>` 选定主题。主仓库的 `Dockerfile` 已经实现了完整流程，theme 作者只需要：

### 10.1 构建命令

```bash
# 在主仓库根目录执行
docker build \
  --build-arg VANBLOG_ACTIVE_THEME=my-theme \
  -t vanblog:my-theme \
  .
```

### 10.2 Dockerfile 流程（已实现，仅供参考）

> 注：下面为历史单主题构建流程，仅供理解。**当前实际流程**：Dockerfile 循环构建 `themes/*/` 全部主题，整体挂到 `/var/lib/vanblog/themes/`（`/build/themes` symlink）；`VANBLOG_ACTIVE_THEME`（默认 `vanblog`）只写入 `/etc/vanblog/default-theme` 作为启动 fallback。

```dockerfile
ARG VANBLOG_ACTIVE_THEME=vanblog

# astro-build stage
COPY themes/ ./themes/
# 循环构建所有主题（而非只 build active）
RUN for theme in themes/*/; do \
      name=$(basename "$theme"); \
      if [ -f "$theme/astro.config.mjs" ]; then \
        (cd "$theme" && VANBLOG_THEME_NAME="$name" pnpm build) || exit 1; \
      fi; \
    done
RUN echo "${VANBLOG_ACTIVE_THEME}" > /build/.default-theme

# prod stage:
COPY --from=astro-build /build/themes /var/lib/vanblog/themes
COPY --from=astro-build /build/.default-theme /etc/vanblog/default-theme
```

### 10.3 切换主题

| 模式     | 操作                                                 | 生效方式                                                          |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **dev**  | admin 改 `site.activeTheme` → 保存 → 重启 dev server | dev 直接跑 `astro dev`（单主题，无 theme host），重启才生效       |
| **prod** | admin 改 `site.activeTheme` → 保存                   | theme host 每 5s 轮询 PB，检测到变化后热切换（<5s），无需重建镜像 |

运行时切换已由 **theme host** 实现（`app/src/theme-host/index.mjs`）：每 5s 轮询 PB `site.activeTheme`，变化后 `switchTheme()` 动态 import 新主题 handler。`/etc/vanblog/default-theme` 只作为启动 fallback，不阻塞运行时切换。

**新增/删除主题**后，Caddy 的 `/themes/<name>/` file_server 静态路由不会自动更新（config-build 时枚举 themes 目录）——在后台「站点配置 → 外观」点「重新加载主题」，触发一次 Caddy 重扫（等价于 `POST /api/vanblog/themes/reload`）。

### 10.4 CI 建议

在 theme 仓库的 CI 里加一个 build 检查：

```yaml
# .github/workflows/build.yml
name: Build theme
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          # 如果 theme 是独立仓库，需要 submodule 或 clone 主仓库
          submodules: recursive
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm check # astro check
      - run: pnpm build # 必须成功
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }
```

---

## 附录：常见问题

### Q: theme 能加自己的 API 端点吗？

**不能**。`src/base-overrides/pages/api/**` 是禁区；theme 的 `src/pages/api/` 也不被主仓库的 prod 镜像识别（主仓库只 build theme 的 public 页面）。如果需要新 API，去主仓库加，或用 PocketBase hooks（Pack 形式）。

### Q: theme 能改 admin 页面吗？

**不能**。admin 是 control plane，锁定。`src/base-overrides/pages/admin/**` 会被 integration 拒绝。

### Q: theme 能依赖某个具体的 Pack 吗？

可以，但不推荐硬依赖。theme 提供的 `PackPage.astro` 应该是通用的 host（接受任意 Pack 的 `title` 和 children）；如果 theme 想为特定 Pack 定制样式，可以根据 `Astro.url.pathname` 判断：

```astro
---
// themes/my-theme/src/layouts/PackPage.astro
const { title } = Astro.props;
const packName = Astro.url.pathname.split('/')[2];  // '/p/bookmarks' -> 'bookmarks'
---
<BaseLayout title={title}>
  <div class={`pack pack--${packName}`}>
    <slot />
  </div>
</BaseLayout>
```

### Q: 多个 theme 能共存吗？

能。`themes/` 下可以放任意多个 theme 子目录，prod 镜像构建时通过 `--build-arg VANBLOG_ACTIVE_THEME=<name>` 选一个。dev 模式下 `cd themes/<which>/ && astro dev` 切换。

### Q: theme 能覆盖另一个 theme 吗？

**不能**。Spike 3 模型没有 child theme 继承（`theme.json.parent` 字段未实现）。每个 theme 独立覆盖 base，theme 之间互不可见。

### Q: 平台层加了新页面（比如新的 admin/api 端点），我的 theme 会自动有吗？

**分两类**：public / API 端点（如 `/api/revalidate`）——theme 用 thin shell re-export `@vanblog/base/pages/api/...`，平台层加 API 端点后主题会自动带上。**admin / login / setup 不会随主题更新**——它们是独立 admin SSR app（`app/`），由 theme host 单独服务，与 theme 无关。

**public 页面（首页/文章/归档/...）不是平台层的**，它们是主题自有的。要给站点加一个全新页面（比如 `photos`），直接在你的 theme 里写 `src/pages/photos.astro`，参考 `themes/vanblog` 的写法：

```astro
---
// themes/my-theme/src/pages/photos.astro
import BaseLayout from '@vanblog/base/layouts/BaseLayout.astro';
---
<BaseLayout title="照片">
  ...
</BaseLayout>
```

`upgrade_diff` MCP 工具会列出平台层新增/变更的页面。

---

## 参考

- [`docs/theme-concepts.md`](./theme-concepts.md) — 平台层 / base 主题 / vanblog 主题 概念模型
- `themes/base/` — 官方最小模板（纯布局 + 简单颜色，脚手架起点）
- `themes/vanblog/` — 官方旗舰主题（mereithhh 的 vanblog 前端迁移而来，独立视觉）
- `app/integrations/themes/index.mjs` — alias 解析与 FORBIDDEN 校验的实现
- `app/integrations/packs/index.mjs` — Pack 路由注入与 `vanblog:theme` 虚拟模块
