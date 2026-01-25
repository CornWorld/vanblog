# admin 模块文档

[根目录](../../CLAUDE.md) > [packages](../) > **admin**

---

## 模块职责

admin 是 VanBlog 的管理后台前端应用，基于 React 19 + Vite 6 + Ant Design 5 构建，提供博客内容管理、系统设置、数据分析等功能。

**核心职责**：

- 文章与草稿管理（CRUD、搜索、批量操作）
- 媒体库管理（图片上传、图床配置）
- 分类与标签管理
- 系统设置（站点信息、主题、备份）
- 数据统计与分析（访客、文章、评论）
- 用户与协作者管理
- Markdown 编辑器（Bytemd + Toast UI）

**技术特性**：

- React 19 新特性支持
- Ant Design 5 Pro Components
- Vite 6 极速开发体验
- TypeScript 类型安全
- ts-rest 客户端（类型安全 API 调用）
- 国际化支持（i18next）

---

## 入口与启动

### 主入口

- **文件**: `src/main.jsx`
- **端口**: 3002（开发环境）
- **挂载路径**: `/admin`

### 启动流程

1. 渲染 React 应用到 `#root`
2. 包裹 `BrowserRouter`（base: `/admin`）
3. 配置 `ConfigProvider`（Ant Design 中文语言包）
4. 注入 `HelmetProvider`（SEO 管理）
5. 渲染 `<App />` 组件

### 开发命令

```bash
# 启动开发服务器
pnpm --filter @vanblog/admin dev   # http://localhost:3002

# 构建生产版本
pnpm --filter @vanblog/admin build

# 预览生产构建
pnpm --filter @vanblog/admin serve
```

---

## 对外接口

### API 调用方式

使用 ts-rest 客户端调用 server-ng API：

```typescript
import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

const client = initClient(contract, {
  baseUrl: '/api', // 代理到 http://localhost:3050
  credentials: 'include',
});

// 类型安全的 API 调用
const { body: articles } = await client.article.findAll();
```

### 代理配置

开发环境下，Vite 代理请求到 server-ng：

```javascript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3050',
      changeOrigin: true,
    },
    '/static': {
      target: 'http://localhost:3050',
      changeOrigin: true,
    },
  },
}
```

---

## 关键依赖与配置

### 核心依赖

| 依赖                         | 版本         | 用途                            |
| ---------------------------- | ------------ | ------------------------------- |
| `react`                      | ^19.0.0      | UI 库                           |
| `react-dom`                  | ^19.0.0      | DOM 渲染                        |
| `antd`                       | ^5.24.6      | UI 组件库                       |
| `@ant-design/pro-components` | ^2.8.7       | Pro 组件（Table, Form, Layout） |
| `@ts-rest/core`              | 3.53.0-rc.1  | ts-rest 客户端                  |
| `@vanblog/shared`            | workspace:\* | 类型契约                        |
| `react-router-dom`           | ^7.5.0       | 路由管理                        |
| `bytemd`                     | 1.22.0       | Markdown 编辑器                 |
| `@toast-ui/react-editor`     | ^3.2.3       | Toast UI 编辑器                 |
| `i18next`                    | ^25.0.0      | 国际化                          |
| `dayjs`                      | ^1.11.13     | 日期处理                        |
| `monaco-editor`              | ^0.52.2      | 代码编辑器                      |

### 配置文件

| 文件                   | 用途                              |
| ---------------------- | --------------------------------- |
| `vite.config.ts`       | Vite 构建配置（代理、别名、优化） |
| `tsconfig.json`        | TypeScript 配置                   |
| `.stylelintrc.json`    | Less/CSS 样式检查                 |
| `playwright.config.js` | E2E 测试配置                      |

### Vite 配置亮点

```typescript
// vite.config.ts
export default defineConfig({
  base: '/admin/', // 构建基础路径
  server: {
    port: 3002,
    proxy: { '/api': 'http://localhost:3050' },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'bytemd-vendor': ['bytemd', '@bytemd/react'],
          'antd-vendor': ['antd'],
        },
      },
    },
  },
});
```

---

## 数据模型

### 状态管理

- **全局状态**: `AppContext`（React Context API）
- **缓存状态**: `useCacheState`（自定义 Hook，基于 localStorage）
- **编辑器状态**: `useEditorCache`（草稿自动保存）

### 主要数据结构

通过 `@vanblog/shared/type` 导入类型：

```typescript
import type { Article, Draft, Category, Tag, Media } from '@vanblog/shared/type';
```

---

## 功能模块

### 页面组件（src/pages/）

| 页面            | 路由                 | 描述                         |
| --------------- | -------------------- | ---------------------------- |
| `Welcome`       | `/admin`             | 欢迎页（概览、统计）         |
| `Article`       | `/admin/article`     | 文章列表与管理               |
| `Editor`        | `/admin/editor/:id?` | 文章编辑器                   |
| `Draft`         | `/admin/draft`       | 草稿列表                     |
| `CustomPage`    | `/admin/custom-page` | 自定义页面管理               |
| `DataManage`    | `/admin/data`        | 数据管理（分类、标签、友链） |
| `ImageManage`   | `/admin/image`       | 媒体库                       |
| `SystemConfig`  | `/admin/system`      | 系统设置（含插件管理）       |
| `LogManage`     | `/admin/log`         | 日志管理                     |
| `CommentManage` | `/admin/comment`     | 评论管理                     |
| `Pipeline`      | `/admin/pipeline`    | 管道（自动化任务）           |
| `About`         | `/admin/about`       | 关于页面                     |

#### 系统设置 Tab 页

`SystemConfig` 页面包含多个 Tab，用于管理不同的系统配置：

| Tab      | 组件路径             | 功能                    |
| -------- | -------------------- | ----------------------- |
| 站点信息 | `tabs/SiteInfo.jsx`  | 站点名称、描述、Logo 等 |
| 用户管理 | `tabs/User.jsx`      | 管理员账户、协作者      |
| 图片设置 | `tabs/ImgTab.jsx`    | 图床配置、PicGo 插件    |
| Waline   | `tabs/WalineTab.jsx` | 评论系统配置            |
| **插件** | `tabs/Plugin.tsx` ⭐ | **插件管理与配置**      |
| Caddy    | `tabs/Caddy.jsx`     | Caddy 反向代理配置      |
| 高级设置 | `tabs/Advance.jsx`   | 高级功能开关            |
| 数据迁移 | `tabs/Migrate.jsx`   | 数据导入导出            |
| 备份恢复 | `tabs/Backup.jsx`    | 数据库备份与恢复        |
| Token    | `tabs/Token.jsx`     | API Token 管理          |

### 插件管理页面（Plugin Tab）

**文件**: `src/pages/SystemConfig/tabs/Plugin.tsx`

**功能**：

- 📋 显示已加载插件列表（名称、版本、描述、状态）
- 🔄 重新加载所有插件
- ⚙️ 配置插件参数（基于 package.json 的 config schema）
- 💾 实时保存配置（无需重启服务）

**核心特性**：

1. **插件列表展示**
   - 使用 Ant Design `Collapse` 组件展示插件
   - 显示插件加载状态（loaded/failed）
   - 显示插件版本和描述

2. **动态配置表单**
   - 根据插件的 `package.json` 中的 `vanblog.config` 自动生成表单
   - 支持类型：`boolean`、`string`、`number`、`array`、`object`
   - 支持枚举值（下拉选择）
   - 支持最小/最大值限制

3. **配置持久化**
   - 配置保存到数据库（`plugin_config` 表）
   - 修改后立即生效，无需重启
   - 支持环境变量覆盖

**API 端点**：

- `GET /api/v2/admin/plugins` - 获取插件列表
- `POST /api/v2/admin/plugins/reload` - 重新加载所有插件
- `GET /api/v2/admin/plugins/:name/config` - 获取插件配置
- `PUT /api/v2/admin/plugins/:name/config` - 更新插件配置

**使用示例**：

```typescript
// 加载插件列表
const response = await fetch('/api/v2/admin/plugins', {
  credentials: 'include',
});
const data = await response.json();
// data.plugins: PluginInfo[]

// 更新插件配置
await fetch('/api/v2/admin/plugins/my-plugin/config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ enabled: true, apiKey: 'xxx' }),
});
```

### 通用组件（src/components/）

| 组件          | 用途                             |
| ------------- | -------------------------------- |
| `Editor`      | Markdown 编辑器（Bytemd + 插件） |
| `CodeEditor`  | 代码编辑器（Monaco）             |
| `UploadBtn`   | 图片上传按钮                     |
| `SaveTip`     | 保存提示                         |
| `UpdateModal` | 版本更新提示                     |
| `ThemeButton` | 主题切换按钮                     |
| `AuthorField` | 作者选择字段                     |
| `Tags`        | 标签选择器                       |
| `ObjTable`    | 对象表格（键值对编辑）           |

### 布局组件（src/layouts/）

| 布局          | 用途                             |
| ------------- | -------------------------------- |
| `BasicLayout` | 主布局（侧边栏 + 顶栏 + 内容区） |
| `BlankLayout` | 空白布局（登录页）               |

---

## Markdown 编辑器

### 编辑器实现

支持两种编辑器：

1. **Bytemd**（默认）：
   - 基于 `bytemd` + `@bytemd/react`
   - 插件：GFM、数学公式、Mermaid、代码高亮、图片缩放

2. **Toast UI**（可选）：
   - 基于 `@toast-ui/react-editor`
   - 插件：颜色选择器、图表

### 编辑器插件（src/components/Editor/plugins/）

| 插件                  | 功能                   |
| --------------------- | ---------------------- |
| `codeBlock.tsx`       | 代码块增强             |
| `customContainer.tsx` | 自定义容器（提示框）   |
| `emoji.tsx`           | Emoji 选择器           |
| `heading.tsx`         | 标题增强               |
| `insertMore.tsx`      | 插入"阅读更多"分隔符   |
| `imgUpload.tsx`       | 图片上传（拖拽、粘贴） |
| `linkTarget.tsx`      | 链接目标设置           |
| `history.tsx`         | 撤销/重做              |

---

## 测试与质量

### 测试工具

- **单元测试**: Vitest
- **组件测试**: Vitest + jsdom
- **E2E 测试**: Playwright

### 测试命令

```bash
# 单元测试
pnpm --filter @vanblog/admin test

# 组件测试
pnpm --filter @vanblog/admin test:component

# E2E 测试
pnpm --filter @vanblog/admin test:e2e
```

### 代码质量

```bash
# ESLint 检查
pnpm --filter @vanblog/admin lint

# ESLint 自动修复
pnpm --filter @vanblog/admin lint:fix

# Prettier 格式化
pnpm --filter @vanblog/admin prettier

# 样式检查
pnpm --filter @vanblog/admin lint:style
```

---

## 国际化

### 配置

- **库**: `i18next` + `react-i18next`
- **语言**: 中文（zh-CN）为主
- **配置文件**: `src/i18n.js`

### 使用示例

```javascript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('welcome.title')}</h1>;
}
```

---

## 常见问题 (FAQ)

### Q1: 如何添加新页面？

1. 在 `src/pages/` 创建组件
2. 在 `src/layouts/routes.js` 添加路由
3. 在侧边栏菜单配置中添加入口

### Q2: 如何调用 API？

```typescript
import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

const client = initClient(contract, { baseUrl: '/api' });
const { body } = await client.article.findAll();
```

### Q3: 如何自定义编辑器插件？

参考 `src/components/Editor/plugins/` 中的插件实现，创建新的插件文件并在 `Editor/index.tsx` 中注册。

### Q4: 如何配置图床？

在"系统设置 > 图片"页面配置 PicGo 插件和图床参数。

### Q5: 如何调试生产构建？

```bash
pnpm build
pnpm serve
```

---

## 相关文件清单

### 核心文件

```
src/
├── main.jsx                   # 应用入口
├── App.jsx                    # 根组件
├── router.js                  # 路由配置
├── i18n.js                    # 国际化配置
├── pages/                     # 页面组件
│   ├── Welcome/
│   ├── Article/
│   ├── Editor/
│   ├── Draft/
│   └── ...
├── components/                # 通用组件
│   ├── Editor/
│   ├── CodeEditor/
│   ├── UploadBtn/
│   └── ...
├── layouts/                   # 布局组件
│   ├── BasicLayout.jsx
│   └── BlankLayout.jsx
├── services/                  # API 服务
│   └── van-blog/
├── utils/                     # 工具函数
│   ├── request.js
│   ├── auth.js
│   └── dayjs.js
└── context/                   # 全局状态
    ├── AppContext.jsx
    └── ThemeContext.tsx
```

### 配置文件

- `vite.config.ts`: Vite 配置
- `tsconfig.json`: TypeScript 配置
- `package.json`: 依赖与脚本
- `.stylelintrc.json`: 样式检查配置

### 样式文件

```
src/
├── global.less                # 全局样式
└── (各组件的样式文件)
```

---

## 变更记录

### 2025-12-09

- 初始化模块文档
- 记录 React 19 + Vite 6 架构
- 记录 Bytemd 编辑器集成
- 记录 ts-rest 客户端使用
