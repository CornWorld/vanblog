# VanBlog Frontend View Model

> 100% 重写前端，保留 UI 效果，极致精简代码

---

## 1. 页面与组件树

### 1.1 公共布局 (BaseLayout)

```
BaseLayout
├── <head>
│   ├── inline script: 防 FOUC (读 localStorage → 设 dark class)
│   ├── title, description, canonical, OG, Twitter Card, JSON-LD
│   ├── RSS (/api/feed.xml) + Atom (/api/atom.xml)
│   └── Pack styles
│
├── Nav (site, isLoggedIn, path)
│   ├── [左] Logo + 站点名
│   ├── [中] 首页 | 归档 | 时间轴 | 标签 | 分类 | 🔍 | 关于 | {Pack items}
│   ├── [右] 登录/管理/退出 | 🌙/☀️
│   └── script: Headroom (scroll>56 隐藏) + 主题切换 + Ctrl+K
│
├── <main class="container-page">
│   ├── <article>  ← slot: 页面主内容
│   └── <aside>    ← slot: AuthorCard | Toc
│
├── Footer (site)
│   └── 站点信息 + 社交链接 + © + RSS/Atom + ICP 备案
│
└── BackToTop — script: scrollY>400 显示, click 平滑到顶
```

### 1.2 页面详情

```
/              SSR  |  posts.listPublished(page,10,{expand})
                组件: ArticleCard[](post, showExcerpt=true) + PageNav(page,totalPages,"/")
                空态: "暂无文章"
                分页: 上/下页 + 第X/Y页

/post/[id]     SSR  |  posts.getOne(id,{expand}) + renderMarkdown(content)
                组件: ArticleCard(post, detail) + PostViewer(html) + Toc(html) + CopyRight(site,post)
                侧边栏: Toc

/archive       SSR  |  posts.listPublished(1,500) → 按年分组
                结构: YearGroup[] → 年标题 + 文章链接(日期+标题)

/timeline      SSR  |  timeline.list() → TimelineEntry[]
                结构: Year[] → Month[] → 文章标题链接(每层计数)

/tag           SSR+CSR |  posts 提取 tags + fetch /api/public/tags/paginated
                组件: 搜索框 + 排序下拉 + TagCard[](名称+计数badge) + 分页

/tag/[name]    SSR  |  posts.listPublished(1,50,{tag:name,expand})
                结构: 标签标题 + ArticleCard[]

/category      SSR  |  posts 提取 categories
                组件: CategoryCard[](名称+计数)

/category/[n]  SSR  |  posts.listPublished(1,50,{category:id,expand})
                结构: 分类标题 + ArticleCard[]

/about         SSR  |  site.aboutContent → renderMarkdown
                结构: Markdown HTML 内容

/search        CSR  |  fetch /api/vanblog/search?q=xxx
                组件: 输入框 + 结果列表

/*             静态 | 404 提示 + 返回首页链接
```

---

## 2. VanBlog 特殊实现细节

### 2.1 颜色系统: frontCardSurface

最关键的视觉特征。从 2 个用户配置颜色衍生 18 个 CSS 变量:

```
输入:
  frontCardBackgroundColor: string      // 默认 "#ffffff"
  frontCardBackgroundColorDark: string   // 默认 "#1a1a2e"

输出 (18 CSS 变量):
  --vb-front-card-bg-light        卡片亮色背景
  --vb-front-card-bg-light-soft   卡片亮色次背景
  --vb-front-card-bg-light-deep   卡片亮色深背景 (= 页面背景)
  --vb-front-card-bg-dark         卡片暗色背景
  --vb-front-card-bg-dark-soft    卡片暗色次背景
  --vb-front-card-bg-dark-deep    卡片暗色深背景
  --vb-front-page-bg-light        亮色页面背景 (= lightDeep)
  --vb-front-page-bg-dark         暗色页面背景
  --vb-front-dark-hover           暗色 hover
  --vb-front-dark-hover-soft      暗色 hover 柔和
  --vb-front-dark-border          暗色边框
  --vb-front-dark-border-strong   暗色强边框
  --vb-front-dark-text            暗色文字
  --vb-front-dark-text-muted      暗色次要文字
  --vb-front-dark-text-soft       暗色柔和文字
  --vb-front-dark-text-strong     暗色强调文字
  --vb-front-dark-text-on-accent  暗色强调色文字
  --vb-front-dark-fill            暗色填充

衍生规则:
  输入颜色 → 变亮/变暗/变透明 → 18 个变体
```

这些变量在 `<html>` 标签上通过 `style` 属性注入，全局可用。
同时 `/api/palette.css` 端点也提供等价的 CSS（带 `?v=site.updated` 缓存破坏）。

### 2.2 Navigation: Headroom + 主题一体化

Nav 组件内联的 script 处理 3 件事:

```js
// 1. Headroom — 滚动隐藏导航
let lastScroll = 0;
window.addEventListener(
  "scroll",
  () => {
    const cur = window.scrollY;
    if (Math.abs(cur - lastScroll) < 8) return; // 容差 8px 防抖动
    nav.style.transform =
      cur > lastScroll && cur > 56 // 56px = nav 高度
        ? "translateY(-100%)"
        : "";
    lastScroll = cur;
  },
  { passive: true }
);

// 2. 主题切换
themeBtn.addEventListener("click", () => {
  html.classList.toggle("dark");
  localStorage.setItem("vanblog-theme", isDark ? "dark" : "light");
  html.dispatchEvent(new CustomEvent("darkmodechange", { detail: { dark } }));
});

// 3. Ctrl+K → 搜索
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    window.location.href = "/search";
  }
});
```

Nav 的移动端方案: 用 CSS `hidden sm:flex` 控制显示/隐藏, 不需要独立 MobileNav 组件。

### 2.3 SSR-only + 内联脚本模式

每个页面 `export const prerender = false`。所有数据在 SSR 阶段通过 `Astro.locals.pb` 获取。
交互行为用**内联 `<script>`** 实现，不含任何前端框架运行时。

### 2.4 Markdown 渲染

```typescript
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
// 自定义 rehype 插件:
//   - headingLinks: 为 h1-h6 添加锚点 id
//   - imageWrapper: 包装 <img> 供 medium-zoom
//   - linkTarget: 外部链接加 target="_blank"

const result = await unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeHighlight)
  .use(customPlugins)
  .process(content);
```

### 2.5 文章加密锁 (LockCard)

当 `post.private === true` 时，文章内容会被 LockCard 替换:
显示密码输入框，提交后验证 `post.password`，正确才显示内容。
状态由客户端 cookie/session 维护（登录后自动解锁）。

### 2.6 置顶 + 过期提醒

```
置顶:     post.top > 0 → 卡片左上角显示 📌 图标，排序在最前
过期提醒: post.updated > 1年 → 卡片顶部显示黄色横幅 "本文最后更新于 X 年前"
```

### 2.7 站点隐私模式

```
Site.privateSite === 'true':
  所有公开页面检查登录状态 → 未登录重定向到 /login
  用内联 script 在 Layout 层实现:
    if (privateSite && !isLoggedIn) window.location.href = '/login'
```

---

## 3. 组件 Props 清单

### 3.1 布局组件

```
Nav          { site: Site | null, isLoggedIn: boolean, path: string }
Footer       { site: Site | null }
BackToTop    (无 props，纯内联 script)
AuthorCard   { site: Site | null }
Toc          { html: string }          ← 从 markdown HTML 提取 h2/h3
PageNav      { page, totalPages, baseUrl }
CopyRight    { site, post? }
```

### 3.2 内容组件

```
ArticleCard  { post: PostExpand, showExcerpt?: boolean }
              列表模式: 标题链接 + 日期 + 分类 + 标签 + 摘要(200字) + 阅读全文
              详情模式: <slot> 嵌入 PostViewer
PostViewer   { html: string }
              <div set:html={html}> + script: 图片点击放大
```

### 3.3 内联脚本 (无独立组件)

```
Loading      空 →  显示加载动画
EmptyState   空 →  "暂无文章" / "暂无数据"
ErrorState   空 →  错误提示
```

---

## 4. 数据流

```
SSR 数据获取 (Astro.locals.pb):
  posts.listPublished(p, pp, {expand: 'category,tags'})
    → { items: PostExpand[], totalItems, totalPages }
  posts.getOne(id, {expand: 'category,tags'})
    → PostExpand
  timeline.list()
    → TimelineEntry[]
  search.query(q)
    → SearchResult[]

CSR 数据获取 (browser fetch):
  fetch('/api/vanblog/search?q=xxx')
    → SearchResult[]
  fetch('/api/public/tags/paginated?page=1&pageSize=120&sortBy=articleCount&sortOrder=desc')
    → { tags: TagWithCount[], page, total, totalPages }
```

---

## 5. 状态管理

```
全局:
  Theme: localStorage('vanblog-theme') + <html class="dark">
         + CustomEvent('darkmodechange') 通知评论
  Auth: pb.authStore.isValid

页面级:
  Tag 页: searchKeyword, sortBy, sortOrder, currentPage — useState (CSR)
  Search 页: query string, results — useState (CSR)
  Post 详情: content — useState (CSR 重新挂载)
```

---

## 6. 交互行为

```
Headroom        scroll 监听 | >56px 向下隐藏 nav, 向上显示
主题切换        click 🌙/☀️ | toggle dark class + localStorage + dispatchEvent
Ctrl+K          全局 keydown | e.ctrlKey && e.key==='k' → /search
BackToTop       scroll 监听 | >400 显示 fade, click 平滑到顶
退出登录        click | import('@vanblog/sdk/browser').logout('/')
Toc 高亮        scroll/IntersectionObserver | 高亮当前可见 heading
图片点击放大    click | 轻量 modal (class="medium-zoom")
Mermaid 渲染    MutationObserver | 检测 mermaid 容器 → 渲染图表
```

---

## 7. 裁剪参考

详细裁剪方案见 `docs/frontend-optimization.md`：

- §2 35→13 组件映射
- §3 29→13 依赖精简
- §4 CSS / Utils / 架构优化
- §5 最终规模预估
