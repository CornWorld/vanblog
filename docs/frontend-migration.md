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

当前 `app/src/` 已有: BaseLayout / PostCard / 11 个页面 / Markdown 管线 / global.css

---

## 2. 迁移阶段

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

## 3. 与 theme infrastructure 的关系

本仓库另有 `.snow/plan/migrate-vanblog-frontend-to-theme-palette.md` 定义了**主题基础设施**（7 个 Phase）：

```
Phase 1: docs 对齐（theme 架构文档）
Phase 2: theme kernel（30 行 integration + Dockerfile）
Phase 3: default-public theme 重写  ← ★ 本文档 cluster 的 UI 规格
Phase 4: default-admin 完善
Phase 5-7: palette / admin UI / MCP tools
```

### 文档关系图

```
.snow/plan/migrate-vanblog-frontend-to-theme-palette.md
  └── Phase 3: default-public theme 重写
        ├── docs/frontend-view-model.md      ← 页面组件树 / Props / 数据流 / 状态 / 交互
        └── docs/frontend-optimization.md    ← 组件裁剪 / 依赖精简 / 架构优化 / 代码预估
```

- **`frontend-view-model.md`** — 实现时的精确参考：每个页面用什么组件、传什么 Props、数据怎么来
- **`frontend-optimization.md`** — 裁剪决策依据：35→13 组件的详细映射、29→13 依赖、18→3 utils
