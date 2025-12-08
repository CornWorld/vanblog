/**
 * @vanblog/shared - VanBlog 共享类型包
 *
 * VanBlog Shared Type Package
 *
 * ## 包结构 (Package Structure)
 *
 * ```
 * @vanblog/shared                 - 主入口（contracts + API schemas）
 * @vanblog/shared/type            - 纯类型导出（0 bytes JS）
 * @vanblog/shared/runtime         - 运行时工具 + DB schemas
 * @vanblog/shared/contracts       - ts-rest API contracts
 * ```
 *
 * ## 使用指南 (Usage Guide)
 *
 * ### 前端 (Frontend)
 *
 * ```typescript
 * // 导入类型（不会增加 bundle 大小）
 * import type { Article, User } from '@vanblog/shared/type';
 *
 * // 导入 contract 用于 API 调用
 * import { initClient } from '@ts-rest/core';
 * import { contract } from '@vanblog/shared';
 *
 * const client = initClient(contract, { baseUrl: '/api' });
 * const { body: articles } = await client.article.findAll();
 * ```
 *
 * ### 后端 (Backend)
 *
 * ```typescript
 * // 导入 DB schemas（用于数据库操作）
 * import { $Article, $ArticleIns } from '@vanblog/shared/runtime';
 *
 * // 导入工具函数
 * import { dayjs, jsonToArr } from '@vanblog/shared/runtime';
 *
 * // 导入 contract 用于实现 API
 * import { initServer } from '@ts-rest/nestjs';
 * import { contract } from '@vanblog/shared';
 *
 * const s = initServer();
 * const router = s.router(contract, {
 *   article: {
 *     findAll: async () => { ... },
 *   },
 * });
 * ```
 *
 * ## 类型系统架构 (Type System Architecture)
 *
 * ### 单一类型来源 (Single Source of Truth)
 *
 * 1. **Drizzle Tables** (`runtime/db.ts`) - 数据库表定义
 * 2. **Drizzle-Zod Schemas** (`runtime/schema.ts`) - 自动生成 + 手动覆盖
 * 3. **ts-rest Contracts** (`contracts/*.contract.ts`) - API 定义
 *
 * ### 命名规范 (Naming Convention)
 *
 * #### DB 层（前缀 `$`）
 * - `$User` - SELECT schema（从数据库读取）
 * - `$UserIns` - INSERT schema（写入数据库）
 * - `$UserUpd` - UPDATE schema（更新数据库）
 *
 * #### API 层（无前缀）
 * - `User` - API 响应（通常是 $User 去除敏感字段）
 * - `UserReq` - API 创建请求（通常是 $UserIns 去除自动生成字段）
 * - `UserPatch` - API 更新请求（通常是 $UserUpd 去除自动生成字段）
 *
 * @see https://orm.drizzle.team - Drizzle ORM
 * @see https://ts-rest.com - ts-rest
 */

// Core contract
export * from './contract.js';

// API-level schemas (settings, etc.)
export * from './schemas.js';

// Date utilities
export * from './dayjs.js';
export * from './date-codecs.js';

// Timeline schemas
export * from './timeline-schemas.js';

// NOTE: DB-derived schemas are available via subpath exports:
// - @vanblog/shared/type - Pure types (User, Article, Category, etc.)
// - @vanblog/shared/runtime - DB schemas ($User, $Article, etc.) + utilities (dayjs, json helpers)
