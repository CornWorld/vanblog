# server-ng 模块文档

[根目录](../../CLAUDE.md) > [packages](../) > **server-ng**

---

## 变更记录 (Changelog)

### 2025-12-28 - ESLint 错误全面清零

- **代码质量提升**：
  - 修复所有 178 个 ESLint 和 TypeScript 错误，达到 0 错误状态
  - 42 个并发 Haiku 任务批量修复（3 批次，每批 14 任务）
  - 手动修复测试 fixture 文件（test-data.ts, mock-utils.spec.ts）
  - 应用 String() 类型转换规范（模板字面量）
  - 统一 import type 导入规范
  - 移除未使用变量与导入

- **修复类别**：
  - Template literal 类型安全：6+ 处（@typescript-eslint/restrict-template-expressions）
  - Prettier 格式化：12+ 处（prettier/prettier）
  - 未使用变量/导入：3 处（no-unused-vars, @typescript-eslint/no-unused-vars）
  - Import type 一致性：1 处（@typescript-eslint/consistent-type-imports）

### 2025-12-25 - 测试重构 Phase 2 完成与文档清理

- **测试重构 Phase 2 完成**：
  - 重构 5 个大型测试文件（loader.service、category.service、tag.service、user.service、webhook.service）
  - 拆分为 21 个专项测试文件（场景分离原则）
  - 所有 237 个测试通过（3,778/3,803 总测试）
  - 遵循测试组织规范（一对一、就近、场景拆分）

- **文档清理**：
  - 删除 11 个过时分析文档（TEST*ANALYSIS*_, BATCH\_\_TEST_\*, DUPLICATE_TEST_FILES_ANALYSIS, TEST_REFACTORING_PLAN）
  - 保留 6 个核心永久文档（配置优化、插件开发、测试组织指南等）

### 2025-12-09 - 深度补充扫描

- 补充插件系统详细文档（6 个内置插件）
- 补充测试策略与工具详细说明
- 记录测试工具与 Mock 工具类
- 更新覆盖率统计与测试示例

### 2025-12-09 - 初始化

- 初始化模块文档
- 记录 21 个功能模块
- 记录 100+ 测试文件
- 记录插件系统架构

---

## 模块职责

server-ng 是 VanBlog 的新一代 API 服务器，基于 NestJS 11 构建，使用 Drizzle ORM + SQLite 作为数据层，通过 ts-rest 提供类型安全的 API 契约。

**核心职责**：

- 提供 RESTful API v2（向下兼容 v1 API）
- 用户认证与授权（JWT + Passport）
- 文章、草稿、分类、标签管理
- 媒体文件上传与处理（本地存储 + PicGo）
- 分析统计与访客追踪
- RSS/Sitemap 生成
- 插件系统（热加载、钩子机制）
- 备份与恢复

---

## 入口与启动

### 主入口

- **文件**: `src/main.ts`
- **端口**: 3050（默认）
- **启动流程**:
  1. 创建 NestJS 应用实例
  2. 配置 dayjs 本地化与时区
  3. 设置全局 API 前缀（`/api`）
  4. 启用 API 版本控制（v2 为默认）
  5. 配置 Swagger/OpenAPI 文档（`/api/docs`）
  6. 启用 CORS、Helmet、CSRF、Compression
  7. 注册全局过滤器、拦截器、中间件
  8. 监听端口

### 应用模块

- **文件**: `src/app.module.ts`
- **动态模块**: `AppModule.forRoot()`
- **导入的模块**:
  - ConfigModule（配置管理）
  - DatabaseModule（Drizzle + SQLite）
  - LoggerModule（自定义日志）
  - ScheduleModule（定时任务）
  - ThrottlerModule（速率限制）
  - PermissionModule（权限系统）
  - PluginModule（插件加载器）
  - 21 个功能模块（见下方）

---

## 对外接口

### API 版本

- **v2 API**: 默认版本，使用 ts-rest contracts
- **v1 API**: 遗留版本，通过 `V1DeprecationMiddleware` 警告弃用

### 主要契约（Contracts）

所有契约定义在 `@vanblog/shared/contracts`：

| 契约                            | 路径                       | 描述                           |
| ------------------------------- | -------------------------- | ------------------------------ |
| `authContract`                  | `/api/v2/auth/*`           | 认证（登录、登出、刷新 Token） |
| `createArticleContract`         | `/api/v2/articles/*`       | 文章 CRUD、搜索、批量操作      |
| `createDraftContract`           | `/api/v2/drafts/*`         | 草稿管理、版本历史             |
| `createCategoryContract`        | `/api/v2/categories/*`     | 分类管理                       |
| `createTagContract`             | `/api/v2/tags/*`           | 标签管理                       |
| `createMediaContract`           | `/api/v2/media/*`          | 媒体上传、删除、列表           |
| `createSettingContract`         | `/api/v2/settings/*`       | 系统设置                       |
| `createMetricsContract`         | `/api/v2/metrics`          | 性能指标                       |
| `backupContract`                | `/api/v2/backup/*`         | 备份与恢复                     |
| `pluginsContract`               | `/api/v2/plugins/*`        | 插件管理                       |
| `createPublicMetaContract`      | `/api/v2/public/meta`      | 公开元数据                     |
| `createPublicBootstrapContract` | `/api/v2/public/bootstrap` | 引导数据                       |
| `rssContract`                   | `/api/v2/rss`              | RSS 订阅                       |
| `sitemapContract`               | `/api/v2/sitemap.xml`      | 网站地图                       |

### Swagger 文档

- **访问地址**: `http://localhost:3050/api/docs`
- **认证方式**: Bearer JWT Token
- **标签分类**: Auth, Articles, Users, Categories, Tags, Analytics, System

---

## 关键依赖与配置

### 内部依赖

- `@vanblog/shared`: 类型契约、Schema、Drizzle 表定义

### 核心外部依赖

| 依赖             | 版本        | 用途                |
| ---------------- | ----------- | ------------------- |
| `@nestjs/core`   | ^11.0.16    | NestJS 核心         |
| `@ts-rest/nest`  | 3.53.0-rc.1 | ts-rest NestJS 集成 |
| `drizzle-orm`    | ^0.44.4     | 数据库 ORM          |
| `@libsql/client` | ^0.15.10    | SQLite 客户端       |
| `passport-jwt`   | ^4.0.1      | JWT 认证策略        |
| `sharp`          | ^0.33.5     | 图片处理            |
| `picgo`          | ^1.5.8      | 图床上传            |
| `markdown-it`    | ^14.1.0     | Markdown 渲染       |
| `feed`           | ^4.2.2      | RSS 生成            |
| `sitemap`        | ^8.0.0      | Sitemap 生成        |

### 配置文件

| 文件                     | 用途                            |
| ------------------------ | ------------------------------- |
| `drizzle.config.ts`      | Drizzle ORM 配置（SQLite 连接） |
| `vitest.config.ts`       | 单元测试配置                    |
| `vitest.config.e2e.ts`   | E2E 测试配置                    |
| `vite.config.ts`         | Vite 构建配置（开发环境）       |
| `vite.plugin.config.mts` | 插件构建配置                    |
| `tsconfig.json`          | TypeScript 配置                 |

### 环境变量

主要环境变量（通过 `ConfigModule` 加载）：

```bash
NODE_ENV=development          # 环境：development/production/test
PORT=3050                     # 服务端口
TZ=UTC                        # 时区
DATABASE_URL=file:./data.db   # SQLite 数据库路径
JWT_SECRET=your-secret        # JWT 密钥
CORS_ORIGIN=*                 # CORS 允许的源
```

---

## 数据模型

### Drizzle Schema 位置

- **定义**: `packages/shared/src/runtime/db.ts`
- **导出**: `@vanblog/shared/drizzle`

### 主要数据表

| 表名             | Drizzle 导出    | 描述         |
| ---------------- | --------------- | ------------ |
| `users`          | `$User`         | 用户表       |
| `articles`       | `$Article`      | 文章表       |
| `drafts`         | `$Draft`        | 草稿表       |
| `draft_versions` | `$DraftVersion` | 草稿版本历史 |
| `categories`     | `$Category`     | 分类表       |
| `tags`           | `$Tag`          | 标签表       |
| `media`          | `$Media`        | 媒体文件表   |
| `analytics`      | `$Analytics`    | 访客分析表   |
| `settings`       | `$Setting`      | 系统设置表   |
| `login_logs`     | `$LoginLog`     | 登录日志表   |

### 数据库操作示例

```typescript
import { db } from './database';
import { $Article, $ArticleIns } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

// 插入文章
const newArticle = await db
  .insert($Article)
  .values({
    title: 'Hello World',
    content: 'This is my first post',
    authorId: userId,
  })
  .returning();

// 查询文章
const articles = await db.select().from($Article).where(eq($Article.published, true));

// 更新文章
await db.update($Article).set({ title: 'Updated Title' }).where(eq($Article.id, articleId));
```

---

## 功能模块

### 核心模块（src/modules/）

| 模块                 | 文件                              | 职责                               |
| -------------------- | --------------------------------- | ---------------------------------- |
| **AuthModule**       | `auth/auth.module.ts`             | JWT 认证、本地策略、Token 黑名单   |
| **UserModule**       | `user/user.module.ts`             | 用户 CRUD、协作者管理              |
| **ArticleModule**    | `article/article.module.ts`       | 文章 CRUD、搜索、批量操作          |
| **DraftModule**      | `draft/draft.module.ts`           | 草稿管理、版本历史、发布           |
| **CategoryModule**   | `category/category.module.ts`     | 分类 CRUD、文章关联                |
| **TagModule**        | `tag/tag.module.ts`               | 标签 CRUD、文章关联                |
| **MediaModule**      | `media/media.module.ts`           | 文件上传、图片处理、存储管理       |
| **AnalyticsModule**  | `analytics/analytics.module.ts`   | 访客统计、ECharts 数据格式化       |
| **SettingModule**    | `setting/setting.module.ts`       | 系统设置、设置注册表               |
| **PublicModule**     | `public/public.module.ts`         | 公开 API（元数据、引导、自定义页） |
| **RssModule**        | `rss/rss.module.ts`               | RSS Feed 生成                      |
| **SitemapModule**    | `sitemap/sitemap.module.ts`       | Sitemap XML 生成                   |
| **BackupModule**     | `backup/backup.module.ts`         | 数据库备份与恢复                   |
| **PermissionModule** | `permission/permission.module.ts` | 权限定义、权限守卫                 |
| **PluginModule**     | `plugin/plugin.module.ts`         | 插件加载、钩子系统                 |
| **HealthModule**     | `health/health.module.ts`         | 健康检查端点                       |
| **MetricsModule**    | `metrics/metrics.module.ts`       | 性能指标暴露                       |
| **AdminModule**      | `admin/admin.module.ts`           | 管理员专用 API                     |
| **CommentModule**    | `comment/comment.module.ts`       | 评论管理（代理到 Waline）          |
| **DemoModule**       | `demo/demo.module.ts`             | 演示模式（只读）                   |

### 核心基础设施（src/core/）

| 目录                 | 职责                                   |
| -------------------- | -------------------------------------- |
| `core/filters/`      | 全局异常过滤器（HTTP、All Exceptions） |
| `core/interceptors/` | 性能监控、ETag 缓存、派生视图          |
| `core/guards/`       | CSRF 守卫                              |
| `core/middlewares/`  | V1 API 弃用警告、性能监控              |
| `core/logger/`       | Winston 日志服务                       |

### 共享服务（src/shared/）

| 服务                         | 职责                             |
| ---------------------------- | -------------------------------- |
| `MarkdownService`            | Markdown 渲染与解析              |
| `CdnService`                 | CDN URL 转换                     |
| `DerivedViewCacheService`    | 派生视图缓存（文章列表、统计等） |
| `QueryOptimizerService`      | 查询优化器                       |
| `ErrorRateMonitoringService` | 错误率监控                       |

---

## 测试与质量

### 测试覆盖率

- **目标**: 80% 覆盖率（CI 阈值）
- **工具**: Vitest + v8 provider
- **报告格式**: text, html, lcov, json-summary
- **当前统计**:
  - 单元测试：93 个文件
  - E2E 测试：27 个文件
  - 总测试文件：120+

### 测试分类

| 类型         | 位置                    | 数量 | 命令            |
| ------------ | ----------------------- | ---- | --------------- |
| **单元测试** | `src/**/*.spec.ts`      | 93   | `pnpm test`     |
| **E2E 测试** | `test/**/*.e2e-spec.ts` | 27   | `pnpm test:e2e` |
| **Fixtures** | `**/*.fixtures.spec.ts` | 多个 | 测试数据工厂    |

### 测试工具与模式

#### 1. Mock 工具类（test/mock-utils.ts）

提供统一的 Mock 创建工具：

```typescript
import { MockUtils } from '../test/mock-utils';

// 创建数据库 Mock
const databaseMock = new MockUtils.database();
databaseMock.setQueryResult([mockArticles]);
const db = databaseMock.build();

// 创建服务 Mock
const hookService = MockUtils.services.createHookServiceMock();
const configService = MockUtils.services.createConfigServiceMock({ 'app.name': 'Test' });

// 创建测试数据
const article = MockUtils.testData.createArticle({ title: 'Test' });
const user = MockUtils.testData.createUser({ name: 'John' });
```

#### 2. 测试工具函数（test/test-utils.ts）

提供 E2E 测试辅助函数：

```typescript
import { createUser, createAuthToken, cleanupDatabase } from './test-utils';

// 创建测试用户
await createUser(app, {
  username: 'testuser',
  password: 'password',
  type: 'admin',
});

// 获取认证 Token
const token = await createAuthToken(app, {
  username: 'testuser',
  password: 'password',
});

// 清理数据库
await cleanupDatabase(app);
```

#### 3. 测试组织规范

**重要**：为了避免测试文件重复和混淆，项目采用了严格的测试组织规范。

**核心原则**：

- 一对一：每个源文件只有一个对应测试文件
- 就近：测试文件与源文件在同一目录
- 场景拆分：>800 行时使用描述性后缀（如 `.concurrency.spec.ts`）

**详细文档**：

- [测试组织完整指南](./docs/TEST_ORGANIZATION_GUIDE.md) - 详细规范和最佳实践
- [快速参考](./docs/TEST_QUICK_REFERENCE.md) - 一页速查表

**示例**：

```
✅ 正确：
src/modules/media/services/
├── media.service.ts
├── media.service.spec.ts               # 核心 CRUD
├── media.service.concurrency.spec.ts   # 并发场景
└── media.service.batch-limits.spec.ts  # 批量限制

❌ 错误（重复且误导）：
src/modules/media/
├── services/
│   ├── media.service.ts
│   └── media.service.spec.ts           # 详细测试
└── media.service.spec.ts               # 重复！
```

### 测试覆盖的模块

#### 核心模块测试

- **AuthModule**: 6 个测试文件（策略、守卫、服务）
- **ArticleModule**: 1 个服务测试（含 CRUD、搜索、导入导出）
- **MediaModule**: 5 个测试文件（存储、处理、并发）
- **PluginModule**: 4 个测试文件（加载器、钩子、注册表）
- **AnalyticsModule**: 4 个测试文件（服务、格式化、第三方集成）

#### 基础设施测试

- **Filters**: 4 个过滤器测试
- **Interceptors**: 3 个拦截器测试
- **Guards**: 1 个 CSRF 守卫测试
- **Logger**: 2 个日志服务测试

#### E2E 测试场景

- 认证流程（登录、登出、Token 刷新）
- 文章管理（创建、更新、删除、搜索）
- 权限验证（角色、权限守卫）
- 插件系统（钩子触发、数据注入）
- 系统初始化（Bootstrap、设置持久化）
- 健康检查与监控
- CSRF 保护
- 速率限制

### 运行测试

```bash
# 所有单元测试
pnpm test

# 单个文件
pnpm test src/modules/article/article.service.spec.ts

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:cov

# E2E 测试
pnpm test:e2e

# E2E 单个文件
pnpm test:e2e test/app.e2e-spec.ts
```

---

## 插件系统

### 插件目录结构

```
plugins/
├── package.json                      # 插件目录配置
├── rss-plugin/                       # RSS 订阅扩展
│   ├── index.ts                      # 插件入口（NestJS Injectable）
│   ├── rss.service.ts                # RSS 生成服务
│   ├── rss.controller.ts             # RSS 控制器
│   ├── index.spec.ts                 # 单元测试
│   ├── package.json
│   └── README.md                     # 详细文档
├── rewards-plugin/                   # 打赏功能
│   ├── index.ts                      # 插件入口
│   ├── reward.service.ts             # 奖励服务
│   ├── reward.controller.ts          # API 控制器
│   ├── reward.contract.ts            # ts-rest 契约
│   ├── reward.schema.ts              # Zod Schema
│   ├── reward.dto.ts                 # DTO 定义
│   ├── index.spec.ts
│   ├── module.ts
│   └── package.json
├── email-notification-plugin/        # 邮件通知
│   ├── index.ts                      # 插件入口
│   ├── module.ts                     # NestJS 模块
│   ├── index.spec.ts
│   └── package.json
├── cat-plugin/                       # 示例：猫咪插件
│   ├── index.ts                      # 插件入口
│   ├── module.ts
│   ├── index.spec.ts
│   └── package.json
├── beian-plugin/                     # 备案信息管理
│   ├── index.ts
│   ├── beian.service.ts
│   ├── module.ts
│   ├── index.test.ts
│   └── package.json
└── social-links-plugin/              # 社交链接管理
    ├── index.ts
    ├── social-links.service.ts
    ├── module.ts
    ├── index.test.ts
    └── package.json
```

### 内置插件详细说明

#### 1. RSS Plugin（RSS 订阅）

**职责**: 为博客生成 RSS 2.0、Atom 1.0、JSON Feed 三种格式的订阅源。

**特性**：

- 自动监听文章变化，智能重建订阅源
- 防抖机制（3 分钟）避免频繁重建
- 支持自定义配置（文章数量、样式等）
- 支持加密文章的安全处理
- 完整的 Markdown 渲染支持

**API 端点**：

- `GET /rss/feed.xml` - RSS 2.0 格式
- `GET /rss/feed.json` - JSON Feed 格式
- `GET /rss/atom.xml` - Atom 1.0 格式
- `POST /api/v2/admin/rss/regenerate` - 手动触发重新生成

**钩子触发**：

- `article|afterCreate`
- `article|afterUpdate`
- `article|afterDelete`
- `setting|afterUpdate`（站点信息变化）

**配置选项**：

```typescript
interface RssPluginConfig {
  debounceTime: number; // 防抖时间（毫秒），默认 180000
  includeFullContent: boolean; // 是否包含完整内容，默认 true
  maxItems: number; // 最大文章数量，默认 50
  customStyles: boolean; // 是否包含自定义样式，默认 true
}
```

**详细文档**: `plugins/rss-plugin/README.md`

#### 2. Rewards Plugin（打赏功能）

**职责**: 管理博客的打赏信息，通过插件配置向 `/public/bootstrap` 注入奖励数据。

**特性**：

- 通过配置追加并去重奖励信息
- 提供完整的 CRUD API
- 支持图片、名称、描述等字段
- 与 Bootstrap API 深度集成

**数据模型**：

```typescript
interface RewardInfo {
  name: string; // 打赏方式名称（如 "微信"、"支付宝"）
  url: string; // 二维码图片 URL
  description?: string; // 描述文本
}
```

**API 方法**（通过插件暴露）：

- `getRewards()` - 获取所有奖励信息
- `addOrUpdateReward(reward)` - 添加或更新奖励
- `deleteReward(id)` - 删除奖励

**插件注册**：

- 注册到插件注册表，提供 `rewards` 数据
- 优先级：10
- 支持配置与存储数据合并去重

#### 3. Email Notification Plugin（邮件通知）

**职责**: 在文章发布、评论、草稿发布等事件时发送邮件通知。

**特性**：

- 支持 SMTP 配置
- 监听多个钩子事件
- HTML 格式邮件模板
- 发送统计与错误处理

**支持的事件**：

- `article|afterCreate` - 文章创建
- `article|afterUpdate` - 文章更新
- `comment|afterUpdate` - 评论更新
- `draft|afterPublish` - 草稿发布

**配置要求**（通过环境变量/配置）：

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@email.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@yourblog.com
EMAIL_TO=admin@yourblog.com,editor@yourblog.com
```

#### 4. Cat Plugin（示例插件）

**职责**: 演示插件开发的示例，在文章保存时在内容/标题/标签的结尾添加 "喵"。

**特性**：

- 简单的 Filter 钩子示例
- 配置控制（可开关标题/内容/标签处理）
- 处理统计记录

**配置选项**：

```typescript
interface CatPluginConfig {
  enable_title: boolean; // 是否处理标题，默认 true
  enable_content: boolean; // 是否处理内容，默认 true
  enable_tags: boolean; // 是否处理标签，默认 true
}
```

**钩子**：

- `article|beforeCreate` - 文章创建前
- `article|beforeUpdate` - 文章更新前

#### 5. Beian Plugin（备案信息管理）

**职责**: 管理 ICP 备案与公安备案信息，注入到 Bootstrap 响应。

**特性**：

- 存储备案号信息
- 注入到公开 API 响应
- 支持 ICP 与公安备案双字段

**数据模型**：

```typescript
interface BeianInfo {
  icp: string; // ICP 备案号
  policeIcp: string; // 公安备案号
}
```

**钩子**：

- `bootstrap|beforeGenerate` - Bootstrap 生成前
- `bootstrap|transformResponse` - 响应转换
- `bootstrap|afterGenerate` - Bootstrap 生成后

#### 6. Social Links Plugin（社交链接管理）

**职责**: 管理社交媒体链接（微博、Twitter、GitHub 等）。

**特性**：

- CRUD 操作
- Zod Schema 验证
- 注册到插件注册表

**数据模型**：

```typescript
interface SocialLink {
  type: string; // 社交平台类型（如 "github", "twitter"）
  url: string; // 链接地址
}
```

### 插件开发指南

#### 插件结构（对象插件）

```typescript
import { Logger } from '@nestjs/common';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

const logger = new Logger('my-plugin');

const plugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'My awesome plugin',

  async init(context: PluginContext): Promise<void> {
    // 初始化逻辑
    await context.data.set('initialized_at', new Date().toISOString());
    logger.log('Plugin initialized');
  },

  async destroy(context: PluginContext): Promise<void> {
    // 清理逻辑
    await context.data.clear();
    logger.log('Plugin destroyed');
  },

  hooks: {
    'article|afterCreate': {
      type: 'action',
      priority: 10,
      handler: async (article, context) => {
        logger.log(`New article created: ${article.title}`);
      },
    },
    'article|beforeUpdate': {
      type: 'filter',
      priority: 10,
      handler: (article, context) => {
        // 修改文章数据
        return { ...article, processedBy: 'my-plugin' };
      },
    },
  },
};

export default plugin;
```

#### 插件结构（模块插件）

```typescript
import { Module, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';

@Injectable()
class MyService implements OnModuleInit {
  private readonly logger = new Logger('MyService');

  onModuleInit() {
    this.logger.log('Service initialized');
  }

  doSomething() {
    this.logger.log('Doing something');
  }
}

@Module({
  providers: [MyService],
  exports: [MyService],
})
class MyPluginModule {}

const plugin: Plugin = {
  id: 'my-module-plugin',
  name: 'My Module Plugin',
  version: '1.0.0',
  description: 'A module-based plugin',
  module: MyPluginModule,
};

export default plugin;
```

### 插件钩子系统

#### 可用钩子列表

| 钩子名称                       | 类型   | 触发时机           | 参数                   |
| ------------------------------ | ------ | ------------------ | ---------------------- |
| `article\|beforeCreate`        | filter | 文章创建前         | `article`, `context`   |
| `article\|afterCreate`         | action | 文章创建后         | `article`, `context`   |
| `article\|beforeUpdate`        | filter | 文章更新前         | `article`, `context`   |
| `article\|afterUpdate`         | action | 文章更新后         | `article`, `context`   |
| `article\|afterDelete`         | action | 文章删除后         | `articleId`, `context` |
| `draft\|afterPublish`          | action | 草稿发布后         | `draft`, `context`     |
| `setting\|afterUpdate`         | action | 设置更新后         | `setting`, `context`   |
| `bootstrap\|beforeGenerate`    | action | Bootstrap 生成前   | `data`, `context`      |
| `bootstrap\|transformResponse` | filter | Bootstrap 响应转换 | `response`, `context`  |
| `bootstrap\|afterGenerate`     | action | Bootstrap 生成后   | `response`, `context`  |
| `rss\|beforeGenerate`          | action | RSS 生成前         | `feedData`, `context`  |
| `rss\|afterGenerate`           | action | RSS 生成后         | `files`, `context`     |

#### 钩子类型说明

- **Action 钩子**: 不返回值，用于副作用（如发送通知、记录日志）
- **Filter 钩子**: 必须返回值，用于修改数据（如转换文章内容、添加字段）

### 插件配置与数据存储

#### 插件上下文（PluginContext）

```typescript
interface PluginContext {
  pluginId: string;
  data: PluginDataStorage; // 插件私有数据存储
  config: PluginConfigReader; // 读取配置
  registry: PluginRegistry; // 注册公共数据提供者
}

// 数据存储 API
await context.data.set('key', value);
const value = await context.data.get('key');
await context.data.clear();

// 配置读取 API
const value = context.config.get('app.name', 'default');

// 注册表 API
context.registry.register(
  'dataKey',
  async () => {
    return { schema: MySchema, data: myData };
  },
  10,
);
```

---

## 常见问题 (FAQ)

### Q1: 如何添加新的 API 端点？

1. 在 `packages/shared/src/contracts/` 定义契约
2. 在对应模块创建控制器（如 `src/modules/article/article.controller.ts`）
3. 使用 `@TsRestHandler()` 装饰器绑定契约
4. 添加单元测试
5. 更新 Swagger 注解

### Q2: 如何修改数据库 Schema？

1. 编辑 `packages/shared/src/runtime/db.ts`
2. 运行 `pnpm db:generate` 生成迁移
3. 运行 `pnpm db:push` 应用到数据库
4. 更新相关 Zod Schema 和契约

### Q3: 如何调试性能问题？

- 检查 `PerformanceInterceptor` 日志
- 访问 `/api/v2/metrics` 端点查看指标
- 使用 Drizzle Studio 查看数据库查询：`pnpm db:studio`

### Q4: 如何禁用 CSRF 保护（开发环境）？

CSRF 在 `development` 和 `test` 环境下已自动禁用（见 `src/main.ts:120`）。

### Q5: 插件如何热加载？

插件在应用启动时通过 `PluginModule.forRoot()` 动态加载，支持对象插件和模块插件。

### Q6: 如何开发新插件？

1. 在 `plugins/` 目录创建新文件夹
2. 创建 `index.ts` 实现插件接口
3. 添加 `package.json`（可选）
4. 编写单元测试 `index.spec.ts`
5. 添加 README.md 文档
6. 插件会在下次启动时自动加载

### Q7: 如何调试测试失败？

```bash
# 运行单个测试文件并显示详细输出
pnpm test src/modules/article/article.service.spec.ts --reporter=verbose

# 使用 UI 模式调试
pnpm test --ui

# 查看覆盖率详细报告
pnpm test:cov
open coverage/index.html
```

---

## 相关文件清单

### 核心文件

```
src/
├── main.ts                    # 应用入口
├── app.module.ts              # 根模块
├── app.controller.ts          # 根控制器
├── app.service.ts             # 根服务
├── modules/                   # 功能模块（21 个）
│   ├── article/
│   ├── auth/
│   ├── user/
│   └── ...
├── core/                      # 核心基础设施
│   ├── filters/
│   ├── interceptors/
│   ├── guards/
│   └── middlewares/
├── shared/                    # 共享工具
│   ├── services/
│   ├── utils/
│   └── cache/
├── config/                    # 配置管理
│   └── config.service.ts
└── database/                  # 数据库连接
    └── database.module.ts

test/                          # 测试目录（27 个 E2E 测试）
├── test-utils.ts              # 测试工具函数
├── mock-utils.ts              # Mock 工具类
├── vitest-fixtures.test.ts    # Vitest Fixtures
└── *.e2e-spec.ts              # E2E 测试文件

plugins/                       # 插件目录（6 个内置插件）
├── rss-plugin/                # RSS 订阅
├── rewards-plugin/            # 打赏功能
├── email-notification-plugin/ # 邮件通知
├── cat-plugin/                # 示例插件
├── beian-plugin/              # 备案信息
└── social-links-plugin/       # 社交链接
```

### 配置文件

- `package.json`: 依赖与脚本
- `drizzle.config.ts`: Drizzle 配置
- `vitest.config.ts`: 测试配置
- `vite.config.ts`: 构建配置
- `tsconfig.json`: TypeScript 配置

---

## 扩展阅读

- [RSS Plugin 详细文档](./plugins/rss-plugin/README.md)
- [插件开发指南](./docs/plugin-development.md)（待创建）
- [测试最佳实践](./docs/testing-guide.md)（待创建）
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [ts-rest 文档](https://ts-rest.com/)
- [NestJS 插件开发](https://docs.nestjs.com/fundamentals/dynamic-modules)
