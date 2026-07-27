# 前端架构优化分析

> 基于 Mereithhh/vanblog 原版 + xxddccaa fork 逆向分析
> 范围：纯前端，不涉及全栈/后端

---

## 1. 原版规模分析

| 类别 | 文件数 | 代码行数 | 说明 |
|------|--------|----------|------|
| Pages | 13 | ~954 | ISR 页面 |
| Components | 35 | ~3,200 | 组件目录 |
| Utils | 18 | ~1,200 | 工具函数 |
| Styles | 13 | ~2,074 | CSS 文件 |
| Types | 1 | ~200 | 类型定义 |
| API | 5 | ~200 | 数据获取 |
| **合计** | **85** | **~7,828** | |

原版 npm dependencies：
```
next, react, react-dom, bytemd(×6), headroom.js, medium-zoom,
react-burger-menu, react-hot-toast, react-photo-view,
react-syntax-highlighter, react-copy-to-clipboard, lodash,
dayjs, katex, mermaid, rehype-raw, remark-*
tailwindcss, autoprefixer, postcss
```

---

## 2. 裁剪方案：从 35 组件到 13 组件

### 2.1 保留（13 组件）

| 组件 | 原版行数 | 预计精简后 | 策略 |
|------|----------|------------|------|
| `BaseLayout` | Layout(206) + LayoutBody(40) | ~120 | 合并 Layout+LayoutBody |
| `Nav` | NavBar(232) + NavBarMobile(87) | ~100 | 响应式合并，内联 script 替代 headroom.js |
| `Footer` | 50 | ~40 | 保留 |
| `AuthorCard` | 93 | ~50 | 保留 |
| `Toc` | Toc(80) + TocMobile(82) + MarkdownTocBar(120) | ~80 | 响应式合并 |
| `ArticleCard` | PostCard(280) | ~100 | 合并 overview/article/about 模式 |
| `PostViewer` | PostViewer(110) + PostViewerStats(30) | ~80 | 保留 |
| `PageNav` | PageNav(113) | ~50 | 保留 |
| `CopyRight` | 50 | ~30 | 保留 |
| `BackToTop` | 25 | ~20 | 保留 |
| `SearchCard` | 70 | ~50 | 保留，或内联到 search 页面 |
| `Markdown` | ~400(6个子文件) | ~150 | Astro unified 管线替代 bytemd |
| `Comments/WaLine` | 60 | ~40 | 保留评论集成 |

### 2.2 内联到父组件（不独立文件）

| 原组件 | 行数 | 合并目标 | 原因 |
|--------|------|----------|------|
| `TopPinIcon` | 15 | ArticleCard | 只有一行 SVG |
| `LockCard` | 60 | ArticleCard | 只有文章详情用 |
| `Reward` | 70 | ArticleCard | 只有文章底部用 |
| `EmptyState` | 15 | 各页面内联 | 一行判断 |
| `Loading` | 10 | 各页面内联 | 一行判断 |
| `AlertCard` | 30 | 各页面内联 | 三元表达式 |
| `BaiduAnalysis` | 15 | BaseLayout script | 一行 script |
| `gaAnalysis` | 12 | BaseLayout script | 一行 script |
| `RssButton` | 25 | Footer 内联 | 一个按钮 |
| `RssLogo` | 10 | Footer 内联 | 一行 SVG |
| `SocialCard` | 25 | AuthorCard 内联 | 循环渲染 |
| `SocialIcon` | 25 | AuthorCard 内联 | 循环渲染 |
| `ThemeButton` | 25 | Nav 内联 | 一个按钮 |
| `AdminButton` | 20 | Nav 内联 | 一个链接 |
| `ImageBox` | 40 | PostViewer 内联 | 点击放大 |

### 2.3 裁剪（不实现）

| 组件 | 行数 | 原因 |
|------|------|------|
| `CustomLayout` | 80 | 用户自定义 CSS/HTML 注入，非核心 |
| `KeyCard` | 40 | 快捷键提示，非核心 |
| `RunningTime` | 40 | 建站运行时间，非核心 |
| `ImageProvider` | 50 | 图片处理，fork 已注释禁用 |
| `react-burger-menu` | 依赖 | CSS 响应式替代 |
| `headroom.js` | 依赖 | 20 行内联 script 替代 |
| `medium-zoom` | 依赖 | 轻量 modal 替代 |
| `react-hot-toast` | 依赖 | 内联提示替代 |
| `react-photo-view` | 依赖 | 内联 modal 替代 |
| `react-syntax-highlighter` | 依赖 | rehype-highlight 替代 |
| `react-copy-to-clipboard` | 依赖 | navigator.clipboard 替代 |
| `lodash` | 依赖 | 原生 JS 替代 |

---

## 3. 依赖裁剪（package.json）

### 原版 29 个 dependencies

```
next                    →  Astro 6 (已迁移)
react/react-dom         →  Astro (零运行时)
bytemd(×6)              →  unified/remark/rehype (已迁移)
headroom.js             →  20 行内联 script
react-burger-menu       →  CSS responsive nav
medium-zoom             →  20 行内联 script
react-hot-toast         →  内联或省略
react-photo-view        →  内联图片 modal
react-syntax-highlighter → rehype-highlight
react-copy-to-clipboard → navigator.clipboard
lodash                  →  原生 JS
dayjs                   →  原生 Date / 简单格式化
katex                   →  保留（数学公式必需）
mermaid                 →  保留（图表必需）
react-use               →  全部移除
react-tiny-popover      →  全部移除
rehype-raw              →  保留（HTML 注入）
remark-directive        →  保留（自定义容器）
remark-gfm              →  保留
```

### 精简后 dependencies

```
astrO 6                  (框架)
@astrojs/node            (SSR)
tailwindcss              (样式)
katex                    (数学公式)
mermaid                  (图表)
rehype-katex             (公式渲染)
rehype-highlight         (代码高亮)
remark-math              (LaTeX 定界符)
remark-directive         (自定义容器)
remark-rehype            (MD→Hast)
rehype-raw               (HTML 注入)
unified                  (管线)
@vanblog/sdk             (数据层)
```

**~29 → ~13 个依赖**（不含 Astro 插件）

---

## 4. 架构优化

### 4.1 组件层数扁平化

原版组件嵌套深度（Post 详情页为例）：
```
Layout → LayoutBody → PostCard → PostViewer → RenderedMarkdown → Markdown/*
                                     → Toc (独立组件)
                                     → CopyRight
                                     → Reward
                                     → PostViewerStats
```

精简后：
```
BaseLayout → ArticleCard → PostViewer (包含全部子内容)
           → Toc (响应式侧边栏)
```

深度从 5 层降到 2-3 层。

### 4.2 移除前端框架运行时

原版：Next.js + React 18（CSR  hydration 整个页面）
本项目：Astro SSR + 内联 script（零 JS 运行时）

每个页面的 JS 从 ~100KB+ React bundle → ~2KB 内联 script。
只有需要交互的部分才加内联 script（Headroom、主题切换、Toc 高亮）。

### 4.3 Utils 合并

原版 18 个 utils 文件：

| 文件 | 处理方式 |
|------|----------|
| `theme.ts` / `themeBoot.ts` / `themeContext.ts` | → Nav 内联 script |
| `frontCardSurface.ts` | → BaseLayout style 属性 |
| `auth.ts` | → `@vanblog/sdk` server.ts (已有) |
| `getLayoutProps.ts` | → Astro.locals.getSite() (已有) |
| `getPageProps.ts`(6个) | → 各页面 Astro SSR 直接调用 pb |
| `getArticlePath.ts` | → `post.pathname \|\| post.id` |
| `getOverviewPreview.ts` | → `stripMarkdown(content, 200)` (SDK 已有) |
| `renderMarkdown.ts` | → `src/lib/markdown/renderer.ts` (已有) |
| `hasToc.ts` | → 读取 html 判断 |
| `keywords.ts` | → 移除（SEO 关键字不关键） |
| `encode.ts` | → `encodeURIComponent` |
| `loadConfig.ts` | → 移除（ISR revalidate 配置） |
| `markdownTheme.ts` | → 简化 |
| `getTarget.ts` | → `_blank` 判断一行代码 |

**18 个 → 3-4 个**（renderMarkdown / markdownTheme / 简单工具）

### 4.4 CSS 合并

原版 13 个 CSS 文件 (2074 行)：

```
globals.css (~50)     → 保留
var.css (~50)         → 合并到 global
side-bar.css (~200)   → 合并到 global
tip-card.css (~300)   → 合并到 global  
scrollbar.css (~30)   → 合并到 global
loader.css (~30)      → 合并到 global
github-markdown.css   → 移除（用 Tailwind typography 或自定义）
hljs/ (4个, ~800)     → rehype-highlight 自带主题
fonts.css (~50)       → 合并到 global
medium-zoom.css (~20) → 合并到 global
```

**13 个 → 1 个** `global.css`

### 4.5 数据层统一

原版：每个页面有自己的 `getPageProps()` 调用不同的 API
本项目：`Astro.locals.pb` 统一入口 + `@vanblog/sdk` 类型安全

```
原版:                    本项目:
getIndexPageProps()      pb.vanblog.posts.listPublished()
getPostPagesProps()      pb.collection('posts').getOne()
getAboutPageProps()      site.aboutContent → renderMarkdown
getTimeLinePageProps()   pb.vanblog.timeline.list()
getTagPageProps()        pb.vanblog.posts.listPublished()
getCategoryPageProps()   pb.vanblog.posts.listPublished()
```

全部统一为 `pb.vanblog.*` 调用，移除 6 个 `getXxxPageProps` 函数。

---

## 5. 最终规模预估

| 类别 | 原版 | 精简后 | 缩减 |
|------|------|--------|------|
| 页面文件 | 13 | 11 | 2 个 page/[page].tsx 和 link.tsx 不实现 |
| 组件文件 | 35 | 13 | **63%** |
| Utils 文件 | 18 | 3-4 | **78%** |
| CSS 文件 | 13 | 1 | **92%** |
| npm dependencies | 29 | ~13 | **55%** |
| 总代码行 | ~7,800 | ~2,500 | **~68%** |

### 最简组件树（最终形态）

```
BaseLayout (1 文件)
├── Nav (内联 3 个行为: Headroom/主题/Ctrl+K)
├── slot: 各页面内容
├── Footer (1 文件)
└── BackToTop (1 文件，可内联)

ArticleCard (1 文件, 3 模式: list/detail/about)
PostViewer (1 文件, = <div set:html> + 图片点击)
Toc (1 文件, 响应式)
PageNav (1 文件)
AuthorCard (1 文件)
CopyRight (1 文件)
SearchCard (1 文件, 或内联到 search 页面)

Markdown 管线 (1 文件 unified 链)
```

**共 11 页面 + 9 核心组件 ≈ 20 个文件，~2,500 行。**
