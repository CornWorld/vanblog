# 前端迁移方向

> 将 xxddccaa fork 的 UI 效果迁移到 Astro 前端
> 目标：保留视觉效果，代码精简 68%

---

## 1. 现状

```
当前前端: Astro 6 + Tailwind v4 + @vanblog/sdk (已部分实现)
目标参考: xxddccaa fork (Next.js App Router, ~7,800行)
         Mereithhh 原版 (Next.js Pages Router, ~7,800行)
```

当前 `app/src/` 已有:
- `layouts/BaseLayout.astro` — 基础布局（含内联 Nav/Footer）
- `components/` — PostCard, Comments, EmptyState 等
- `pages/` — 11 个页面（SSR）
- `lib/markdown/renderer.ts` — Markdown 渲染管线
- `styles/global.css` — 全局样式

---

## 2. 目标架构

### 2.1 组件映射

```
原版 35 组件                    → 本项目 13 组件 + 内联
─────────────────────────────────────────────────────
Layout + LayoutBody             → BaseLayout (1)
NavBar + NavBarMobile           → Nav (1) — 响应式+内联 script
Footer                          → Footer (1)
BackToTop                       → BackToTop (1)
AuthorCard                      → AuthorCard (1)
Toc + TocMobile + TocBar       → Toc (1) — 响应式

PostCard (3模式)                → ArticleCard (1)
PostViewer + Stats              → PostViewer (1)
PageNav                         → PageNav (1)
CopyRight                       → CopyRight (1)
Markdown/ (6文件)               → lib/markdown/renderer.ts (已有)
MarkdownTocBar                  → 合并到 Toc

内联到父组件 (15):
  TopPinIcon → ArticleCard
  LockCard   → ArticleCard
  Reward     → ArticleCard
  ThemeButton → Nav
  AdminButton → Nav
  SocialCard/SocialIcon → AuthorCard
  RssButton/RssLogo → Footer
  EmptyState/Loading/AlertCard → 页面内联
  BaiduAnalysis/gaAnalysis → BaseLayout script
  ImageBox → PostViewer
  PageNav/core/render → 保留

裁剪 (7):
  CustomLayout, RunningTime, KeyCard, ImageProvider,
  react-burger-menu, headroom.js, medium-zoom, lodash,
  react-hot-toast, react-photo-view, react-syntax-highlighter
```

### 2.2 文件结构

```
app/src/
├── layouts/
│   └── BaseLayout.astro        ← SEO + Nav + Footer + BackToTop
├── components/
│   ├── Nav.astro               ← 响应式导航 (内联 Headroom/主题/Ctrl+K)
│   ├── Footer.astro            ← 底部信息
│   ├── BackToTop.astro         ← 回到顶部
│   ├── AuthorCard.astro        ← 侧边栏
│   ├── ArticleCard.astro       ← 文章卡片 (3模式)
│   ├── PostViewer.astro        ← Markdown 渲染容器
│   ├── PageNav.astro           ← 分页
│   ├── Toc.astro               ← 目录 (响应式)
│   ├── CopyRight.astro         ← 版权
│   └── Comments.astro          ← 评论 (已有)
├── pages/                      ← 11个页面 (SSR)
├── lib/
│   └── markdown/renderer.ts    ← 渲染管线 (已有)
└── styles/
    └── global.css              ← 全局样式 (1个文件)
```

---

## 3. 迁移阶段

### Phase 1: 布局 Shell（已完成调研）
- [x] BaseLayout 使用 Nav/Footer/BackToTop 组件
- [x] Nav 内联 script（Headroom + 主题切换 + Ctrl+K）
- [x] 响应式导航（CSS hidden/sm:flex）
- [x] 主题系统 (localStorage + <html class="dark">)

### Phase 2: 内容组件
- [ ] ArticleCard（统一列表/详情模式）
- [ ] PostViewer（Markdown 渲染）
- [ ] Toc（响应式目录）
- [ ] PageNav（分页）
- [ ] CopyRight（版权声明）
- [ ] AuthorCard（侧边栏）

### Phase 3: 页面迁移
- [ ] 首页 / 文章详情 / 归档 / 时间轴
- [ ] 标签 / 分类 / 关于 / 搜索 / 404

### Phase 4: 样式整合
- [ ] 合并 CSS 文件（13→1）
- [ ] frontCardSurface 颜色变量
- [ ] 暗色模式完整支持

---

## 4. 依赖精简

```
保留:
  astro, @astrojs/node, tailwindcss, @vanblog/sdk
  katex, mermaid, rehype-katex, rehype-highlight
  remark-math, remark-directive, unified

移除:
  react, react-dom, next                    → Astro SSR
  bytemd/*, @bytemd/*                       → unified 管线
  headroom.js                               → 20行内联script
  react-burger-menu                         → CSS responsive
  medium-zoom                               → 内联click handler
  react-hot-toast                           → 内联通知
  react-photo-view                          → 内联图片modal
  react-syntax-highlighter                  → rehype-highlight
  react-copy-to-clipboard                   → navigator.clipboard
  lodash                                    → 原生JS
  dayjs                                     → 简单格式化
  react-use, react-tiny-popover             → 不依赖
  react-headroom, react-scroll types        → 不依赖

~29 → ~13 dependencies (-55%)
```

---

## 5. 代码量预估

| 文件 | 行数 | 说明 |
|------|------|------|
| BaseLayout.astro | ~100 | 含 SEO/JSON-LD |
| Nav.astro | ~80 | 含内联 3 个 script |
| Footer.astro | ~40 | |
| BackToTop.astro | ~20 | |
| AuthorCard.astro | ~40 | |
| ArticleCard.astro | ~80 | 3 模式合并 |
| PostViewer.astro | ~40 | |
| PageNav.astro | ~40 | |
| Toc.astro | ~60 | 响应式 |
| CopyRight.astro | ~20 | |
| 11 pages | ~800 | 平均 70 行/页 |
| lib/markdown/renderer.ts | ~80 | 已有 |
| styles/global.css | ~300 | 合并后 |
| **合计** | **~1,700** | |

目标：**<2,000 行**（原版 ~7,800 行的 1/4）

---

## 6. 参考文档

- `frontend-view-model.md` — 页面/组件视图模型
- `frontend-optimization.md` — 架构优化分析与裁剪方案
- `refs/mereithhh-original/` — 原版 Next.js 源码
- `refs/xxddccaa-fork/repo/packages/website/` — fork 源码
