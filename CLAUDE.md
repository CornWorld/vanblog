# VanBlog 架构文档

## Shared 包类型系统架构

### 设计目标

实现 **单一类型来源 (Single Source of Truth)** 的类型系统，避免重复定义，确保前后端类型一致。

### 技术栈

- **Drizzle ORM** - 数据库 schema 定义（唯一类型来源）
- **drizzle-zod** - 从 Drizzle tables 生成 Zod schemas
- **Zod** - 运行时类型验证
- **ts-rest** - 类型安全的 REST API contracts

### 数据流

```
Drizzle Tables (唯一来源)
      ↓ drizzle-zod
Zod Schemas ($User, $Article, User, ArticleReq...)
      ↓
ts-rest Contracts (使用 Zod schemas 定义 API)
      ↓
┌─────────────────────────────────────┐
│  前端: initClient(contract)         │  ← 自动类型推导
│  后端: initServer(contract)         │  ← 运行时验证
└─────────────────────────────────────┘
```

### 包结构

```
packages/shared/
├── src/
│   ├── runtime/
│   │   ├── db.ts           # Drizzle table 定义（唯一类型来源）
│   │   ├── schema.ts       # drizzle-zod 生成的 Zod schemas
│   │   ├── date.ts         # dayjs 工具
│   │   ├── json.ts         # JSON 工具
│   │   └── index.ts
│   ├── type/
│   │   └── schema.ts       # 纯类型导出（export type）
│   └── contracts/
│       └── *.contract.ts   # ts-rest contracts（使用 Zod schemas）
```

### 命名规范

| 层级   | 前缀/命名 | 用途          | 示例                            |
| ------ | --------- | ------------- | ------------------------------- |
| DB 层  | `$` 前缀  | 数据库操作    | `$User`, `$UserIns`, `$UserUpd` |
| API 层 | 无前缀    | API 响应/请求 | `User`, `UserReq`, `UserPatch`  |

- `$Entity` - SELECT schema（从 DB 读取）
- `$EntityIns` - INSERT schema（写入 DB）
- `$EntityUpd` - UPDATE schema（更新 DB）
- `Entity` - API 响应（通常是 $Entity 去除敏感字段）
- `EntityReq` - API 请求体（创建）
- `EntityPatch` - API 请求体（更新）

### 构建产物

使用 Vite 构建，关键配置：

- **内联依赖**: zod, drizzle-orm, drizzle-zod, dayjs
- **外部依赖**: @ts-rest/core

| 导出路径                    | 内容                         | 用途         |
| --------------------------- | ---------------------------- | ------------ |
| `@vanblog/shared`           | contract + schemas           | 主入口       |
| `@vanblog/shared/type`      | 纯类型（0 bytes JS）         | 前端类型导入 |
| `@vanblog/shared/runtime`   | Zod schemas + Drizzle tables | 后端验证     |
| `@vanblog/shared/contracts` | ts-rest contracts            | API 定义     |

### 前端使用

```typescript
import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

const client = initClient(contract, {
  baseUrl: '/api',
});

// 完整类型推导，无需手动导入类型
const { body: articles } = await client.article.findAll();
// articles 自动推导为 ArticleList 类型
```
