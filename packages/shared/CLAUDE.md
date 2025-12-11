# shared 模块文档

[根目录](../../CLAUDE.md) > [packages](../) > **shared**

---

## 模块职责

shared 是 VanBlog 的**单一数据源（Single Source of Truth）**包，定义了所有类型契约、数据 Schema、Drizzle 表结构和 API 契约。

**核心职责**：

- Drizzle ORM 表定义（数据库 Schema）
- Zod Schema 定义（运行时校验）
- ts-rest 契约定义（API 类型契约）
- 纯类型导出（前端零运行时开销）
- 通用工具函数（日期、JSON 处理）

**设计原则**：

- 从 Drizzle 表生成 Zod Schema（drizzle-zod）
- 从 Zod Schema 构建 ts-rest 契约
- 前端通过类型推导获得类型安全
- 后端通过 Zod 运行时校验

---

## 入口与启动

### 构建方式

- **构建工具**: Vite 6.x + vite-plugin-dts
- **输出格式**: ESM
- **类型声明**: 自动生成 `.d.ts` 文件

### 构建命令

```bash
# 构建
pnpm --filter @vanblog/shared build

# 监听模式（开发）
pnpm --filter @vanblog/shared dev
```

---

## 对外接口

### 导出路径

| 路径                        | 内容                     | 使用场景     | 示例                                                              |
| --------------------------- | ------------------------ | ------------ | ----------------------------------------------------------------- |
| `@vanblog/shared`           | contracts + schemas      | 主入口       | `import { contract } from '@vanblog/shared'`                      |
| `@vanblog/shared/type`      | 纯类型（0 字节 JS）      | 前端类型导入 | `import type { Article } from '@vanblog/shared/type'`             |
| `@vanblog/shared/runtime`   | Zod schemas + Drizzle 表 | 后端校验     | `import { $Article } from '@vanblog/shared/runtime'`              |
| `@vanblog/shared/contracts` | ts-rest 契约             | API 定义     | `import { articleContract } from '@vanblog/shared/contracts'`     |
| `@vanblog/shared/drizzle`   | Drizzle 工具 + Schema    | DB 操作      | `import { $Article, dataSchemas } from '@vanblog/shared/drizzle'` |

### 核心导出

#### 1. Drizzle 表定义（`@vanblog/shared/drizzle`）

```typescript
// 数据库表
export { $User, $Article, $Draft, $Category, $Tag, $Media, ... }

// INSERT Schema
export { $UserIns, $ArticleIns, ... }

// UPDATE Schema
export { $UserUpd, $ArticleUpd, ... }

// 工具函数
export { dataSchemas }
```

#### 2. ts-rest 契约（`@vanblog/shared/contracts`）

```typescript
export { contract }; // 根契约
export { authContract }; // 认证契约
export { createArticleContract }; // 文章契约工厂
export { createDraftContract }; // 草稿契约工厂
export { createCategoryContract }; // 分类契约工厂
// ... 更多契约
```

#### 3. 纯类型（`@vanblog/shared/type`）

```typescript
// 仅类型导出，编译后零运行时开销
export type { User, Article, Draft, Category, Tag, ... }
export type { UserReq, ArticleReq, DraftReq, ... }
export type { UserPatch, ArticlePatch, ... }
```

#### 4. 运行时工具（`@vanblog/shared/runtime`）

```typescript
export { dayjs, configureDayjs }  // 日期处理
export { $Article, $User, ... }   // Drizzle 表（同 drizzle 导出）
export { ArticleSchema, ... }     // Zod Schema
```

---

## 关键依赖与配置

### 核心依赖

| 依赖            | 版本        | 用途                        |
| --------------- | ----------- | --------------------------- |
| `@ts-rest/core` | 3.53.0-rc.1 | ts-rest 核心库              |
| `zod`           | ^4.1.13     | Schema 校验库               |
| `drizzle-orm`   | ^0.44.4     | ORM（devDependencies）      |
| `drizzle-zod`   | ^0.8.2      | Drizzle → Zod 转换          |
| `dayjs`         | ^1.11.13    | 日期处理（devDependencies） |

### 配置文件

- `vite.config.ts`: Vite 构建配置（多入口）
- `tsconfig.json`: TypeScript 配置
- `package.json`: 导出路径配置（`exports` 字段）

### 多入口配置

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: './src/index.ts', // 主入口
        'type/index': './src/type/index.ts', // 纯类型
        'runtime/index': './src/runtime/index.ts', // 运行时
        'contracts/index': './src/contracts/index.ts', // 契约
        'drizzle/index': './src/drizzle/index.ts', // Drizzle
      },
      formats: ['es'],
    },
  },
});
### 代码分包策略

构建输出按依赖关系自动分包，确保前端使用 contracts 时不引入 drizzle-orm：

| Chunk | 大小 | 内容 | 使用者 |
|-------|------|------|--------|
| `zod-dayjs-*.js` | ~197 KB | Zod 运行时 + dayjs 时区 | contracts, runtime, drizzle |
| `drizzle-*.js` | ~299 KB | drizzle-orm + drizzle-zod | runtime, drizzle |
| `contract-schemas-*.js` | ~40 KB | 契约定义 + 通用 schemas | contracts |
| `dayjs-*.js` | ~0.7 KB | dayjs 工具函数 | drizzle |

**关键优化**：
- `contracts` 入口仅依赖 `zod-dayjs` 和 `contract-schemas`，不引入 drizzle（节省 ~299 KB）
- 通过 `resolve.alias` 将 contracts 中的 schema 导入重定向到预生成的纯 Zod 文件
- 预构建脚本 `scripts/generate-schemas.ts` 使用 zod-codepen 序列化 Zod schemas

```

---

## 数据模型

### 目录结构

```
src/
├── contract.ts                # 根契约定义
├── schemas.ts                 # 通用 Schema
├── dayjs.ts                   # dayjs 配置
├── date-codecs.ts             # 日期编解码器
├── timeline-schemas.ts        # 时间线 Schema
├── contracts/                 # ts-rest 契约
│   ├── index.ts
│   ├── article.contract.ts
│   ├── auth.contract.ts
│   ├── draft.contract.ts
│   └── ...
├── drizzle/                   # Drizzle 相关
│   ├── index.ts
│   ├── schema.ts              # Drizzle 表定义
│   ├── zod-schemas.ts         # Zod Schema（自动生成）
│   └── utils.ts               # 工具函数
├── runtime/                   # 运行时工具
│   ├── index.ts
│   ├── db.ts                  # Drizzle 表导出
│   ├── schema.ts              # Zod Schema 导出
│   └── date.ts                # 日期工具
└── type/                      # 纯类型
    ├── index.ts
    └── schema.ts              # 类型推导
```

### 命名约定

#### 数据库层（`$` 前缀）

```typescript
// Drizzle 表定义
export const $User = pgTable('users', { ... });
export const $Article = pgTable('articles', { ... });

// INSERT Schema (自动生成)
export const $UserIns = createInsertSchema($User);
export const $ArticleIns = createInsertSchema($Article);

// UPDATE Schema (自动生成)
export const $UserUpd = createUpdateSchema($User);
export const $ArticleUpd = createUpdateSchema($Article);
```

#### API 层（无前缀）

```typescript
// API 响应类型（通常去除敏感字段）
export const User = $User.omit({ password: true });
export const Article = $Article;

// API 请求体（创建）
export const UserReq = $UserIns.pick({ username: true, email: true, password: true });
export const ArticleReq = $ArticleIns.omit({ id: true, createdAt: true });

// API 请求体（更新/部分更新）
export const UserPatch = UserReq.partial();
export const ArticlePatch = ArticleReq.partial();
```

### 主要数据表

| 表名             | Drizzle 导出    | API 类型       | 描述       |
| ---------------- | --------------- | -------------- | ---------- |
| `users`          | `$User`         | `User`         | 用户表     |
| `articles`       | `$Article`      | `Article`      | 文章表     |
| `drafts`         | `$Draft`        | `Draft`        | 草稿表     |
| `draft_versions` | `$DraftVersion` | `DraftVersion` | 草稿版本   |
| `categories`     | `$Category`     | `Category`     | 分类表     |
| `tags`           | `$Tag`          | `Tag`          | 标签表     |
| `media`          | `$Media`        | `Media`        | 媒体文件表 |
| `analytics`      | `$Analytics`    | `Analytics`    | 分析数据表 |
| `settings`       | `$Setting`      | `Setting`      | 系统设置表 |
| `login_logs`     | `$LoginLog`     | `LoginLog`     | 登录日志表 |

---

## 契约定义

### 根契约（Root Contract）

```typescript
// src/contract.ts
import { initContract } from '@ts-rest/core';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  article: articleContract,
  draft: draftContract,
  category: categoryContract,
  tag: tagContract,
  media: mediaContract,
  // ... 更多子契约
});
```

### 契约示例：文章契约

```typescript
// src/contracts/article.contract.ts
export const createArticleContract = (c: AppRouterContract) =>
  c.router({
    findAll: {
      method: 'GET',
      path: '/articles',
      responses: {
        200: ArticleListSchema,
      },
      summary: 'Get all articles',
    },
    findOne: {
      method: 'GET',
      path: '/articles/:id',
      pathParams: z.object({ id: z.number() }),
      responses: {
        200: ArticleSchema,
        404: NotFoundSchema,
      },
    },
    create: {
      method: 'POST',
      path: '/articles',
      body: ArticleReqSchema,
      responses: {
        201: ArticleSchema,
      },
    },
    // ... 更多端点
  });
```

---

## 使用示例

### 前端使用（ts-rest 客户端）

```typescript
import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

// 初始化客户端
const client = initClient(contract, {
  baseUrl: 'http://localhost:3050',
  baseHeaders: {
    Authorization: `Bearer ${token}`,
  },
});

// 调用 API（类型安全）
const { status, body } = await client.article.findAll({
  query: { page: 1, limit: 10 },
});

if (status === 200) {
  // body 类型自动推导为 ArticleList
  console.log(body.items);
}
```

### 后端使用（NestJS + ts-rest）

```typescript
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { createArticleContract } from '@vanblog/shared/contracts';
import { $Article } from '@vanblog/shared/drizzle';

@Controller()
export class ArticleController {
  @TsRestHandler(createArticleContract(c).findAll)
  async findAll() {
    return tsRestHandler(createArticleContract(c).findAll, async () => {
      const articles = await this.db.select().from($Article);
      return { status: 200, body: articles };
    });
  }
}
```

### 数据库操作（Drizzle）

```typescript
import { db } from './database';
import { $Article, $ArticleIns } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

// 插入（使用 INSERT Schema）
const newArticle: typeof $ArticleIns = {
  title: 'Hello World',
  content: 'This is my first post',
  authorId: 1,
};
await db.insert($Article).values(newArticle);

// 查询（使用 SELECT Schema）
const articles = await db.select().from($Article).where(eq($Article.published, true));

// 类型推导
// articles 类型为 Array<typeof $Article>
```

### 类型导入（前端零运行时）

```typescript
// 仅导入类型，编译后不产生 JS 代码
import type { Article, ArticleReq } from '@vanblog/shared/type';

const article: Article = {
  id: 1,
  title: 'Hello',
  content: 'World',
  // ... 类型安全
};
```

---

## 测试与质量

### 测试覆盖

shared 包主要提供类型定义，测试较少，但确保：

- 契约定义正确性
- Schema 校验逻辑
- 工具函数正确性

### 类型检查

```bash
# TypeScript 类型检查
pnpm --filter @vanblog/shared tsc --noEmit
```

---

## 常见问题 (FAQ)

### Q1: 如何添加新的数据表？

1. 编辑 `src/drizzle/schema.ts`，添加表定义
2. 运行 `pnpm build` 自动生成 Zod Schema
3. 在 `src/contracts/` 添加对应契约
4. 在 `src/contract.ts` 根契约中注册

### Q2: 如何修改现有 Schema？

1. 修改 `src/drizzle/schema.ts` 表定义
2. 重新构建：`pnpm build`
3. 更新契约（如有必要）
4. 通知后端运行 `db:generate` 和 `db:push`

### Q3: 前端如何获得类型提示？

使用 `@vanblog/shared/type` 导出的纯类型：

```typescript
import type { Article } from '@vanblog/shared/type';
```

或通过契约推导：

```typescript
import { contract } from '@vanblog/shared';

// 自动推导响应类型
type ArticleListResponse = Awaited<ReturnType<typeof contract.article.findAll>>['body'];
```

### Q4: JSON 字段如何自动处理？

使用 Drizzle 的 `mode: 'json'`，JSON 字段自动序列化/反序列化为原生 JS 类型：

```typescript
// Drizzle schema 定义（mode: 'json' 自动处理）
const articles = sqliteTable('articles', {
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
});

// 直接使用原生数组，无需手动 JSON.parse/stringify
const article = await db.select().from(articles).limit(1);
console.log(article.tags); // string[] 类型
```

### Q5: dayjs 如何配置？

```typescript
import { configureDayjs } from '@vanblog/shared';

await configureDayjs({ locale: 'zh-cn', timezone: 'Asia/Shanghai' });
```

---

## 相关文件清单

### 核心文件

```
src/
├── contract.ts                # 根契约
├── schemas.ts                 # 通用 Schema
├── contracts/                 # 契约目录（20+ 个）
│   ├── article.contract.ts
│   ├── auth.contract.ts
│   ├── draft.contract.ts
│   └── ...
├── drizzle/                   # Drizzle 相关
│   ├── schema.ts              # 表定义（核心）
│   ├── zod-schemas.ts         # 自动生成
│   └── utils.ts
├── runtime/                   # 运行时工具
│   ├── db.ts
│   ├── schema.ts
│   └── date.ts
└── type/                      # 纯类型
    └── schema.ts
```

### 配置文件

- `package.json`: 导出路径配置
- `vite.config.ts`: 构建配置
- `tsconfig.json`: TypeScript 配置

---

## 变更记录

### 2025-12-09

- 初始化模块文档
- 记录多入口导出结构
- 记录命名约定与使用示例
- 记录 20+ 个契约定义
