# website 模块文档

[根目录](../../CLAUDE.md) > [packages](../) > **website**

---

## 模块职责

website 是 VanBlog 的公开博客前端，基于 Next.js 15 构建，采用 App Router + Tailwind CSS，提供静态站点生成（SSG）和增量静态再生成（ISR）能力。

**核心职责**：

- 博客首页（文章列表、分页）
- 文章详情页（Markdown 渲染、目录导航）
- 分类与标签页
- 时间线页
- 关于页
- RSS 订阅
- 评论系统（Waline 集成）
- SEO 优化（元标签、Sitemap）
- 访客统计与分析

**技术特性**：

- Next.js 15 App Router
- React 19 服务端组件（RSC）
- Tailwind CSS 3 样式
- ISR 增量静态再生成
- i18next 国际化
- 响应式设计（移动端适配）

---

## 入口与启动

### 主入口

- **文件**: `pages/_app.tsx`
- **端口**: 3001（开发环境）
- **渲染模式**: SSG/ISR/SSR 混合

### 启动流程

1. Next.js 初始化应用
2. 加载全局样式
3. 注入 `GlobalContext`（访客统计）
4. 配置 `next-i18next`（国际化）
5. 渲染页面组件

### 开发命令

```bash
# 启动开发服务器
pnpm --filter @vanblog/website dev   # http://localhost:3001

# 构建生产版本
pnpm --filter @vanblog/website build

# 启动生产服务器
pnpm --filter @vanblog/website start
```

---

## 对外接口

### API 调用方式

使用 ts-rest 客户端调用 server-ng 公开 API：

```typescript
import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

const client = initClient(contract, {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3050',
});

// 服务端组件中调用
const { body: articles } = await client.article.findAll();
```

### 数据获取策略

| 页面      | 渲染模式 | 数据更新策略      |
| --------- | -------- | ----------------- |
| 首页      | ISR      | 每 60 秒重新生成  |
| 文章详情  | ISR      | 每 60 秒重新生成  |
| 分类/标签 | ISR      | 每 300 秒重新生成 |
| 时间线    | SSG      | 构建时生成        |
| 关于      | SSG      | 构建时生成        |

---

## 关键依赖与配置

### 核心依赖

| 依赖              | 版本         | 用途           |
| ----------------- | ------------ | -------------- |
| `next`            | ^15.2.1      | Next.js 框架   |
| `react`           | ^19.0.0      | UI 库          |
| `react-dom`       | ^19.0.0      | DOM 渲染       |
| `@ts-rest/core`   | 3.53.0-rc.1  | ts-rest 客户端 |
| `@vanblog/shared` | workspace:\* | 类型契约       |
| `tailwindcss`     | ^3.3.0       | 样式框架       |
| `bytemd`          | ^1.22.0      | Markdown 渲染  |
| `@waline/client`  | ^3.5.5       | 评论系统       |
| `next-i18next`    | ^15.4.2      | 国际化         |
| `dayjs`           | ^1.11.13     | 日期处理       |
| `medium-zoom`     | ^1.1.0       | 图片缩放       |
| `mermaid`         | ^11.4.1      | 图表渲染       |

### 配置文件

| 文件                     | 用途                                  |
| ------------------------ | ------------------------------------- |
| `next.config.js`         | Next.js 配置（i18n, bundle analyzer） |
| `next-i18next.config.js` | i18next 配置                          |
| `tailwind.config.js`     | Tailwind CSS 配置                     |
| `postcss.config.js`      | PostCSS 配置                          |
| `tsconfig.json`          | TypeScript 配置                       |

### Next.js 配置亮点

```javascript
// next.config.js
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  i18n: {
    locales: ['zh-CN', 'en-US'],
    defaultLocale: 'zh-CN',
  },
  images: {
    domains: ['localhost', 'vanblog.corn.im'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  webpack: (config) => {
    // 优化配置
    return config;
  },
};
```

---

## 数据模型

### 全局状态（GlobalContext）

```typescript
interface GlobalState {
  viewer: number; // 访客数
  visited: number; // 访问次数
}
```

### 主要数据结构

通过 `@vanblog/shared/type` 导入类型：

```typescript
import type { Article, Category, Tag } from '@vanblog/shared/type';
```

---

## 功能模块

### 页面组件（pages/）

| 页面            | 路由        | 描述             | 渲染模式 |
| --------------- | ----------- | ---------------- | -------- |
| `index.tsx`     | `/`         | 首页（文章列表） | ISR      |
| `post/[id].tsx` | `/post/:id` | 文章详情         | ISR      |
| `tag.tsx`       | `/tag`      | 标签列表         | ISR      |
| `tag/[tag].tsx` | `/tag/:tag` | 标签详情         | ISR      |
| `timeline.tsx`  | `/timeline` | 时间线           | SSG      |
| `about.tsx`     | `/about`    | 关于页           | SSG      |
| `_app.tsx`      | -           | 全局应用         | -        |
| `_document.tsx` | -           | HTML 文档        | -        |
| `404.tsx`       | `/404`      | 404 页面         | SSG      |

### 通用组件（components/）

| 组件             | 用途                     |
| ---------------- | ------------------------ |
| `Layout`         | 全局布局（导航栏、页脚） |
| `NavBar`         | 顶部导航栏               |
| `NavBarMobile`   | 移动端导航               |
| `Footer`         | 页脚                     |
| `Markdown`       | Markdown 渲染器          |
| `MarkdownTocBar` | 目录导航                 |
| `PostCard`       | 文章卡片                 |
| `PostViewer`     | 文章查看器               |
| `ArticleList`    | 文章列表                 |
| `WaLine`         | Waline 评论组件          |
| `BackToTop`      | 回到顶部按钮             |
| `ThemeButton`    | 主题切换按钮             |
| `Loading`        | 加载动画                 |
| `ImageBox`       | 图片展示（支持缩放）     |

### Markdown 增强组件（components/Markdown/）

| 组件                  | 功能                     |
| --------------------- | ------------------------ |
| `codeBlock.tsx`       | 代码块渲染（语法高亮）   |
| `customContainer.tsx` | 自定义容器（提示框）     |
| `heading.tsx`         | 标题增强（锚点）         |
| `img.tsx`             | 图片增强（懒加载、缩放） |
| `linkTarget.tsx`      | 链接目标处理             |
| `rawHTML.tsx`         | 原始 HTML 支持           |

---

## Markdown 渲染

### 渲染器实现

基于 `bytemd` + 插件系统：

```typescript
import { Viewer } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight-ssr';
import math from '@bytemd/plugin-math-ssr';
import mermaid from '@bytemd/plugin-mermaid';

const plugins = [gfm(), highlight(), math(), mermaid()];

<Viewer value={markdown} plugins={plugins} />
```

### 支持的 Markdown 特性

- GFM（GitHub Flavored Markdown）
- 代码高亮（highlight.js）
- 数学公式（KaTeX）
- Mermaid 图表
- 任务列表
- 自定义容器（`::: tip`, `::: warning` 等）
- 图片缩放（medium-zoom）

---

## SEO 优化

### 元标签

```typescript
import Head from 'next/head';

<Head>
  <title>{article.title} - VanBlog</title>
  <meta name="description" content={article.description} />
  <meta property="og:title" content={article.title} />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary" />
</Head>
```

### Sitemap 生成

通过 server-ng API 获取 Sitemap XML：

```
GET /api/v2/sitemap.xml
```

### RSS 订阅

```
GET /api/v2/rss
```

---

## 测试与质量

### 测试工具

- **单元测试**: Vitest 3.0.8

### 测试命令

```bash
pnpm --filter @vanblog/website test
```

---

## 国际化

### 配置

- **库**: `next-i18next` + `i18next`
- **语言**: 中文（zh-CN）、英文（en-US）
- **配置文件**: `next-i18next.config.js`

### 使用示例

```typescript
import { useTranslation } from 'next-i18next';

function MyComponent() {
  const { t } = useTranslation('common');
  return <h1>{t('welcome')}</h1>;
}
```

### 服务端使用

```typescript
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}
```

---

## 性能优化

### 图片优化

- 使用 `next/image` 组件（自动优化）
- 懒加载
- 响应式图片

### 代码分割

- 动态导入（`next/dynamic`）
- 按路由分割

### 缓存策略

- ISR 缓存（stale-while-revalidate）
- CDN 缓存（静态资源）

---

## 常见问题 (FAQ)

### Q1: 如何添加新页面？

1. 在 `pages/` 目录创建文件
2. 实现 `getStaticProps` 或 `getServerSideProps`
3. 添加到导航菜单（`components/NavBar/`）

### Q2: 如何自定义主题？

修改 `tailwind.config.js` 和全局样式文件（`styles/globals.css`）。

### Q3: 如何集成第三方分析？

在 `components/gaAnalysis/` 或 `components/BaiduAnalysis/` 中添加分析脚本。

### Q4: 如何优化首次加载速度？

- 使用 ISR 缓存
- 压缩静态资源
- 启用 CDN
- 优化图片

### Q5: 如何调试 SSR 问题？

```bash
# 启用 Next.js 调试模式
NODE_OPTIONS='--inspect' pnpm dev
```

---

## 相关文件清单

### 核心文件

```
pages/
├── _app.tsx                   # 全局应用
├── _document.tsx              # HTML 文档
├── index.tsx                  # 首页
├── post/
│   └── [id].tsx               # 文章详情
├── tag.tsx                    # 标签列表
├── tag/
│   └── [tag].tsx              # 标签详情
├── timeline.tsx               # 时间线
├── about.tsx                  # 关于页
└── 404.tsx                    # 404 页面

components/
├── Layout/                    # 布局组件
├── NavBar/                    # 导航栏
├── Footer/                    # 页脚
├── Markdown/                  # Markdown 渲染
├── PostCard/                  # 文章卡片
├── PostViewer/                # 文章查看器
├── WaLine/                    # 评论系统
└── ...

styles/
├── globals.css                # 全局样式
├── github-markdown.css        # Markdown 样式
└── ...

utils/
├── globalContext.ts           # 全局状态
├── getIcon.tsx                # 图标工具
└── ...
```

### 配置文件

- `next.config.js`: Next.js 配置
- `next-i18next.config.js`: i18next 配置
- `tailwind.config.js`: Tailwind CSS 配置
- `package.json`: 依赖与脚本

---

## 变更记录

### 2025-12-09

- 初始化模块文档
- 记录 Next.js 15 + React 19 架构
- 记录 ISR 缓存策略
- 记录 Bytemd 渲染器集成
