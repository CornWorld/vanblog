# 调色盘 & 主题架构设计

> **目标**：让非技术用户可以通过 AI agent 自定义 Vanblog 前端。分两层：
> - **调色盘 (Color Palette)**：改 CSS 变量（颜色、字体、间距）——零风险，纯 CSS
> - **主题 (Theme)**：替换 Astro 页面/布局/组件 —— 改 DOM 结构、布局、交互
>
> **参考**：WordPress / Typecho 的模板系统（template tags + 模板层级 + style.css），但适配 Astro 的组件模型和文件路由。

---

## 1. 概念区分

| | 调色盘 (Color Palette) | 主题 (Theme) |
|---|---|---|
| **改什么** | CSS 变量：`--color-bg`、`--color-text`、字体大小、间距 | `.astro` 文件：`pages/`、`layouts/`、`components/` |
| **怎么改** | 覆盖 `tokens.css`，不改任何 Astro 代码 | 提供替换的 `.astro` 文件，按需覆盖系统默认 |
| **agent 能做什么** | 改颜色、调字号、换字体 | 重组布局、加组件、改 DOM 结构 |
| **风险** | 零——CSS 变量改了不会炸页面 | 低——frontmatter 契约保护数据层不被破坏 |
| **类比** | WordPress Customizer 的颜色面板 | WordPress 切换整个 theme |

---

## 2. 核心洞察：PHP CMS 怎么做到"逻辑和样式在一起但不会炸"

WordPress 和 Typecho 的模板文件（`index.php`, `single.php`）里确实混着 PHP 逻辑和 HTML。但它们的"不会炸"靠的是：

| 机制 | WordPress | Typecho |
|------|-----------|---------|
| **数据访问封装** | `the_title()`, `the_content()` — 模板标签函数，内部处理 SQL/缓存/转义 | `$this->title()`, `$this->content()` — Widget 魔术方法，底层 SQL 完全隐藏 |
| **The Loop** | `while (have_posts()) { the_post(); ... }` — 迭代逻辑和数据指针管理完全隐藏 | `while ($this->next()) { ... }` — 同上 |
| **模板层级** | `single.php` → `singular.php` → `index.php` 逐级 fallback | `post.php` → `index.php`，缺失文件不报错 |
| **Partial 加载** | `get_header()` 加载 `header.php`，文件缺失 → 静默跳过 | `$this->need('header.php')` — 同上 |

**关键发现**：模板作者从不写 SQL、不管理数据库连接、不处理认证。他们只接触"模板标签"这个窄 API。

---

## 3. Vanblog 的对等映射

| PHP CMS 概念 | Vanblog 现有等价物 | 状态 |
|-------------|-------------------|------|
| 模板标签 (`the_title()`) | SDK 函数：`fmtDate()`, `stripMarkdown()` + 类型化属性 `post.title` | ✅ 已实现 |
| The Loop | `{posts.map(post => <JSX />)}` | ✅ 已实现 |
| `get_header()` / `need()` | `<BaseLayout>` + `<slot />` | ✅ 已实现 |
| `style.css` | `app/src/styles/global.css`（调色盘入口） | ✅ 已实现 |
| 模板层级 fallback | Astro 文件路由（无 fallback 链） | ❌ 待设计 |
| Child themes | 无 | ❌ 待设计 |
| `functions.php` | `middleware.ts` + SDK services | ✅ 已实现 |

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

## 5. 主题目录结构（Theme）

替换 Astro 源文件。适合想彻底改布局的用户。

```
hooks/themes/{name}/
├── theme.json              ← REQUIRED: 主题元数据
│   {
│     "name": "magazine",
│     "label": "杂志风",
│     "version": "1.0.0",
│     "author": "...",
│     "parent": null,        ← 可选：继承父主题
│     "palette": "midnight", ← 可选：绑定的调色盘
│     "screenshot": "./screenshot.png"
│   }
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
- **主题可以绑定调色盘**：`"palette": "midnight"` 引用一个已安装的调色盘

### 模板契约（Agent 必须遵守的规则）

每个可覆盖的 `.astro` 页面有一个"契约"——agent 不能删除或修改这些部分：

```astro
---
// ⛔ AGENT: DO NOT EDIT BELOW THIS LINE
// Page data contract — these imports and variables are REQUIRED.
import BaseLayout from '../layouts/BaseLayout.astro';
import { fmtDate, stripMarkdown } from '@vanblog/sdk';
import type { Post } from '@vanblog/sdk';

const pb = Astro.locals.pb;
const result = await safe(() => pb.vanblog.posts.listPublished(1, 10), 'index');
const posts = result?.items ?? [];
// ⛔ AGENT: DO NOT EDIT ABOVE THIS LINE
---

<!-- ✅ AGENT: Everything below is yours to restructure -->
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

## 6. Agent 安全边界

### Agent 可以碰的区域（SAFE ZONE）

```
hooks/
├── themes/{name}/      ← ✅ 主题：改 .astro 文件（遵守模板契约）
│   ├── theme.json
│   ├── layouts/
│   ├── pages/
│   └── components/
└── palettes/{name}/    ← ✅ 调色盘：改 CSS（零风险）
    ├── palette.json
    └── *.css
```

### Agent 绝对不能碰的区域（NO-GO ZONE）

```
app/src/
├── middleware.ts     ← ❌ 认证/路由守卫
├── lib/              ← ❌ Markdown 渲染、图片处理
├── pages/api/        ← ❌ API 端点
└── live.config.ts    ← ❌ 数据加载器

sdk/src/              ← ❌ SDK 源码
vault/                ← ❌ Go 后端
```

---

## 7. 加载机制

### 7.1 开发模式（dev 镜像 → Agent 工作环境）

1. 用户选择/创建主题或调色盘 → `/opt/vanblog/hooks/themes/{name}/` 或 `hooks/palettes/{name}/`
2. Agent（通过 MCP）读写对应目录下的文件
3. Astro dev server 监听文件变化 → HMR 实时预览
4. 用户满意后 → `astro build` 构建主题产物

### 7.2 生产模式（prod 镜像）

调色盘通过 Caddy 注入 CSS `<link>` 实现，不需要重新构建 Astro。
主题需要 build 后的产物（`dist/`）覆盖默认前端。

### 7.3 调色盘切换（prod 可用）

- Admin UI 的 site 设置页选择调色盘 → 更新 `site.palette` 字段
- 重启后 Caddy 读取新调色盘名 → 注入对应的 CSS
- 不需要重新构建

### 7.4 主题切换（需要 dev 模式或预构建）

- Admin UI 选择主题 → 触发 `astro build`（dev 模式）或使用预构建产物
- 重启后加载新主题产物

---

## 8. MCP Tools（Agent 可用）

| Tool | 能力 | 安全边界 |
|------|------|----------|
| `read_file` | 读 themes/palettes 目录内的任何文件 | 路径限制在 `hooks/themes/` 或 `hooks/palettes/` |
| `write_file` | 写文件 | 同 |
| `list_dir` | 列出目录结构 | 只读 |
| `preview` | 触发浏览器预览（截图/URL） | 只读 |
| `build` | `astro build` 构建主题 | dev 模式专用 |
| `pb_schema` | 读取 pb 集合 schema | 只读 |
| `pb_query` | 执行只读 pb API 查询 | `GET` only |

---

## 9. 与 PHP CMS 的差异

| PHP CMS 能做到的 | Vanblog 当前 | 计划 |
|-----------------|-------------|------|
| 模板层级 fallback（缺 `single.php` → 用 `index.php`）| ❌ Astro 文件路由无 fallback | 通过构建脚本生成 fallback（非运行时） |
| 运行时切换调色盘 | ❌ | site.palette → 重启生效（纯 CSS，无需构建） |
| 运行时切换主题 | ❌ | 需要 astro build（编译时替换 .astro） |
| Child theme 继承 | ❌ | `theme.json.parent` 字段 |
| `wp_enqueue_style()` / 条件加载 CSS | ⚠️ 手动 `<link>` | 保留手动方式（agent 可控） |
| Widget areas / 动态侧边栏 | ❌ | 不在 v1 范围 |
| 模板内条件标签 (`is_home()`, `is_single()`) | ✅ `Astro.url.pathname` | 已可用 |

---

## 10. 待决问题

1. **Astro 页面覆盖的实现方式**：编译时替换文件 vs 运行时动态 import？Astro 的文件路由是编译时的——覆盖 `pages/index.astro` 需要重新构建。方案：主题安装时触发 `astro build`，产物覆盖默认。
2. **theme.json 覆盖 vs 完整模板**：是"只覆盖改动的文件"（类似 child theme），还是"主题是完整副本"（类似独立 theme）？倾向：覆盖模式（按需覆盖），默认值来自系统。
3. **Agent 契约注释的格式**：`⛔ AGENT:` 注释 vs `@contract` JSDoc vs 独立 `page.contract.ts` 文件？倾向：注释 + 构建时校验脚本。
4. **MCP 安全性**：Agent 通过 MCP 获得什么权限？最小权限原则——只能写 `hooks/themes/` 和 `hooks/palettes/` 目录，只能 GET 读 pb API，不能写 pb 数据。
5. **调色盘 vs 主题的优先级**：如果主题绑定了调色盘，用户又单独选了一个调色盘，哪个生效？倾向：主题绑定的调色盘是默认值，用户手动选的覆盖。
