# Agent-Safe 主题架构设计

> **目标**：让非技术用户可以通过 AI agent 自定义 Vanblog 前端的样式和布局，agent 修改不会破坏数据流、认证、路由等基础设施。
>
> **参考**：WordPress / Typecho 的模板系统（template tags + 模板层级 + style.css），但适配 Astro 的组件模型和文件路由。

---

## 1. 核心洞察：PHP CMS 怎么做到"逻辑和样式在一起但不会炸"

WordPress 和 Typecho 的模板文件（`index.php`, `single.php`）里确实混着 PHP 逻辑和 HTML。但它们的"不会炸"靠的是：

| 机制 | WordPress | Typecho |
|------|-----------|---------|
| **数据访问封装** | `the_title()`, `the_content()` — 模板标签函数，内部处理 SQL/缓存/转义 | `$this->title()`, `$this->content()` — Widget 魔术方法，底层 SQL 完全隐藏 |
| **The Loop** | `while (have_posts()) { the_post(); ... }` — 迭代逻辑和数据指针管理完全隐藏 | `while ($this->next()) { ... }` — 同上 |
| **模板层级** | `single.php` → `singular.php` → `index.php` 逐级 fallback | `post.php` → `index.php`，缺失文件不报错 |
| **CSS 约定** | `style.css` 是主题入口，样式集中在 CSS 文件而非内联 | 同 |
| **Partial 加载** | `get_header()` 加载 `header.php`，文件缺失 → 静默跳过 | `$this->need('header.php')` — 同上 |

**关键发现**：模板作者从不写 SQL、不管理数据库连接、不处理认证。他们只接触"模板标签"这个窄 API。

---

## 2. Vanblog 的对等映射

Vanblog 已经有这些等价物：

| PHP CMS 概念 | Vanblog 现有等价物 | 状态 |
|-------------|-------------------|------|
| 模板标签 (`the_title()`) | SDK 函数：`fmtDate()`, `stripMarkdown()` + 类型化属性 `post.title` | ✅ 已实现 |
| The Loop | `{posts.map(post => <JSX />)}` | ✅ 已实现 |
| `get_header()` / `need()` | `<BaseLayout>` + `<slot />` | ✅ 已实现 |
| `style.css` | `app/src/styles/global.css` + `@theme` 设计 token | ⚠️ 有，但需拆分为主题文件 |
| 模板层级 fallback | Astro 文件路由（无 fallback 链） | ❌ 待设计 |
| Child themes | 无 | ❌ 待设计 |
| `functions.php` | `middleware.ts` + SDK services | ✅ 已实现 |

---

## 3. 主题目录结构

借鉴 PHP CMS 模式，Vanblog 主题是一个包含页面覆盖、样式和可选组件的目录：

```
vanblog-theme-{name}/
├── theme.json              ← REQUIRED: 主题元数据
│   {
│     "name": "midnight",
│     "label": "午夜黑",
│     "version": "1.0.0",
│     "author": "...",
│     "description": "...",
│     "parent": null,        ← 可选：继承父主题
│     "screenshot": "./screenshot.png"
│   }
├── styles/
│   ├── tokens.css          ← 覆盖设计 token（颜色、间距、字体）
│   ├── typography.css      ← 标题/正文样式
│   └── components.css      ← 按钮/卡片/导航等组件样式
├── layouts/                ← 覆盖默认布局（可选）
│   └── BaseLayout.astro    ← 替代 app/src/layouts/BaseLayout.astro
├── pages/                  ← 覆盖页面（可选，按需覆盖）
│   ├── index.astro         ← 只覆盖首页
│   └── posts/[id].astro    ← 只覆盖文章页
├── components/             ← 主题专属组件（可选）
│   └── HeroBanner.astro
├── public/                 ← 静态资源
│   ├── screenshot.png
│   └── fonts/
└── README.md               ← 主题使用说明（agent 可读）
```

**设计原则**：
- **按需覆盖**：主题只放想改的文件，未覆盖的文件 → 系统默认
- **theme.json 声明元数据**：agent 只读这个文件就知道主题叫什么、继承了什么
- **styles/ 是 agent 的主要工作区**：改颜色、字体、间距只碰这三个 CSS 文件

---

## 4. Agent 安全边界

### 4.1 Agent 可以碰的区域（SAFE ZONE）

```
hooks/themes/{theme-name}/
├── theme.json        ← ✅ 可编辑
├── styles/           ← ✅ 主要工作区
├── layouts/          ← ✅ 可编辑（但 agent 应知道这是外壳）
├── pages/            ← ⚠️ 可编辑，但 agent 需遵守模板契约
├── components/       ← ✅ 可编辑
└── public/           ← ✅ 可编辑
```

### 4.2 Agent 绝对不能碰的区域（NO-GO ZONE）

```
app/src/
├── middleware.ts     ← ❌ 认证/路由守卫
├── lib/              ← ❌ Markdown 渲染、图片处理
├── pages/api/        ← ❌ API 端点
└── live.config.ts    ← ❌ 数据加载器

sdk/src/              ← ❌ SDK 源码（编译产物在 node_modules）
vault/                ← ❌ Go 后端
```

### 4.3 模板契约（Agent 必须遵守的规则）

每个可覆盖的 `.astro` 页面有一个"契约"——agent 不能删除或修改这些部分：

```astro
---
// ⛔ AGENT: DO NOT EDIT BELOW THIS LINE
// Page data contract — these imports and variables are REQUIRED.
import BaseLayout from '../layouts/BaseLayout.astro';
import { fmtDate, stripMarkdown } from '@vanblog/sdk';
import type { Post } from '@vanblog/sdk';

const pb = Astro.locals.pb;
const result = await pb.vanblog.posts.listPublished(/* ... */);
const posts = result.items;
// ⛔ AGENT: DO NOT EDIT ABOVE THIS LINE
---

<!-- ✅ AGENT: Everything below is yours to style -->
<BaseLayout title="首页">
  {posts.map(post => (
    <article>
      <h2><a href={`/posts/${post.id}`}>{post.title}</a></h2>
      <time>{fmtDate(post.created)}</time>
      <p>{stripMarkdown(post.content, 150)}</p>
    </article>
  ))}
</BaseLayout>
```

**契约规则**：
1. **frontmatter 不许碰**：数据获取逻辑归系统
2. **SDK import 不许删**：`fmtDate`、`stripMarkdown` 等模板标签必须保留
3. **变量名不许改**：`posts`、`post`、`site` 等是契约变量，改了模板就炸
4. **Layout 组件必须保留**：每个页面必须包裹在 `<BaseLayout>` 或 `<AdminLayout>` 中
5. **`{posts.map(...)}` 结构保留**：可以改里面的 HTML/CSS，但不能改迭代逻辑

---

## 5. 主题加载与时机制

### 5.1 开发模式（dev 镜像 → Agent 工作环境）

```
1. 用户选择/创建主题 → /opt/vanblog/hooks/themes/{name}/
2. Agent（通过 MCP）读写主题目录下的文件
3. Astro dev server 监听文件变化 → HMR 实时预览
4. 用户满意后 → 构建主题产物
```

**MCP Tools（Agent 可用）**：

| Tool | 能力 | 安全边界 |
|------|------|----------|
| `theme_read_file` | 读主题目录内的任何文件 | 路径限制在 `themes/{name}/` 内 |
| `theme_write_file` | 写主题目录内的文件 | 同 |
| `theme_list` | 列出主题目录结构 | 只读 |
| `theme_preview` | 触发浏览器预览（截图/URL） | 只读 |
| `theme_build` | 构建主题（编译 CSS + 校验） | 写产物到 `dist/` |
| `pb_schema` | 读取 pb 集合 schema | 只读 |
| `pb_query` | 执行只读 pb API 查询 | `GET` only, admin 权限 |

### 5.2 生产模式（prod 镜像 → 加载自定义主题）

```
/opt/vanblog/
├── data/                   ← pb_data
├── hooks/
│   ├── themes/
│   │   └── midnight/       ← 用户主题目录
│   │       ├── theme.json
│   │       ├── styles/
│   │       └── dist/       ← 构建产物（CSS + 静态资源）
│   └── system.pb.js        ← 系统 hooks
└── app/
    └── dist/               ← Astro SSR server + 默认前端产物
```

**加载流程**：
1. 容器启动 → Caddy 读取 `theme.json`（如果存在）
2. Caddy 优先 serve `hooks/themes/{name}/dist/*` 下的静态资源
3. `tokens.css` → Caddy 在响应中注入为 `<link>` 覆盖默认 token
4. 如果主题提供了 `layouts/BaseLayout.astro` 的编译产物 → 替换系统默认 layout

### 5.3 主题切换

- Admin UI 的 site 设置页选择主题 → 更新 `site.theme` 字段
- 重启后 Caddy 读取新主题名 → 加载对应目录
- 不需要重新构建 Docker 镜像

---

## 6. 从当前代码到目标架构的迁移路径

### Phase 1：主题基础设施（backend）

1. **`theme.json` schema 定义** — 类型化主题清单
2. **`theme.json` 加载器** — Go 端读取主题目录、验证 schema
3. **`site.theme` 字段** — 已有（`default/minimal/magazine/custom`），扩展为支持自定义主题名
4. **Caddy 静态资源路由** — 优先 serve 主题 `dist/` 目录

### Phase 2：Agent 安全化（frontend）

1. **给每个 `.astro` 页面加契约注释** — `⛔ AGENT: DO NOT EDIT` 标记
2. **`app/src/theme/` 目录** — 把 `global.css` 的设计 token 拆出来作为"默认主题"
3. **`safeQuery` 全面替换手写 try/catch** — 让页面更简洁、agent 更不容易碰炸数据层
4. **大 `<script>` 块抽成组件** — `routing.astro` 的 400 行 JS 移到 `components/RoutingEditor.astro`

### Phase 3：MCP / Agent 集成

1. **MCP server** — 实现 §5.1 的 tool 列表
2. **主题预览** — dev 容器内启动 Astro + HMR
3. **主题构建** — `astro build` → 产物输出到 `themes/{name}/dist/`
4. **主题分发** — 打包为 `.zip`，支持上传安装

---

## 7. 与 PHP CMS 的差异（诚实列出）

| PHP CMS 能做到的 | Vanblog 当前 | 计划 |
|-----------------|-------------|------|
| 模板层级 fallback（缺 `single.php` → 用 `index.php`）| ❌ Astro 文件路由无 fallback | 通过构建脚本生成 fallback（非运行时） |
| 运行时切换主题（不改文件） | ❌ | Phase 1 实现（site.theme → 重启生效） |
| Child theme 继承 | ❌ | `theme.json.parent` 字段，Phase 2 |
| `wp_enqueue_style()` / 条件加载 CSS | ⚠️ 手动 `<link>` | 保留手动方式（agent 可控） |
| Widget areas / 动态侧边栏 | ❌ | 不在 v1 范围 |
| 模板内条件标签 (`is_home()`, `is_single()`) | ✅ `Astro.url.pathname` | 已可用 |

---

## 8. 待决问题

1. **Astro 页面覆盖的实现方式**：编译时替换文件 vs 运行时动态 import？Astro 的文件路由是编译时的——覆盖 `pages/index.astro` 需要重新构建。方案：主题安装时触发 `astro build`，产物覆盖默认。
2. **theme.json 覆盖 vs 完整模板**：是"只覆盖改动的文件"（类似 child theme），还是"主题是完整副本"（类似独立 theme）？倾向：覆盖模式（按需覆盖），默认值来自系统。
3. **Agent 契约注释的格式**：`⛔ AGENT:` 注释 vs `@contract` JSDoc vs 独立 `page.contract.ts` 文件？倾向：注释 + 构建时校验脚本。
4. **MCP 安全性**：Agent 通过 MCP 获得什么权限？最小权限原则——只能写 `themes/` 目录，只能 GET 读 pb API，不能写 pb 数据。
