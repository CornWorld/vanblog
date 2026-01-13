/**
 * @file plugin/api.ts
 *
 * PluginAPI v2.0 接口定义 - 增强型插件开发 API
 *
 * ## 设计理念
 *
 * 1. **功能完整** - 提供数据库访问、依赖注入、HTTP 路由等核心功能
 * 2. **类型安全** - 完整的 TypeScript + Zod + ts-rest 集成
 * 3. **学习 WordPress** - 声明式资源注册，零代码生成 CRUD API
 * 4. **深度融合** - 充分利用 NestJS DI、Drizzle ORM、ts-rest
 * 5. **简洁优先** - 简单场景简单，复杂场景强大
 *
 * ## v2.0 新特性
 *
 * - ✅ 数据库访问（`api.db`, `api.table()`, `api.coreTable()`）
 * - ✅ 依赖注入（`api.inject()`, `api.provideService()`）
 * - ✅ HTTP 路由注册（`api.http.contract()`, `api.http.get/post`）
 * - ✅ 声明式资源注册（`api.registerResource()` - WordPress 风格）
 * - ✅ 插件间通信（`api.exposeAPI()`, `api.useAPI()`）
 * - ✅ 元数据系统（`api.meta.register/get/set/delete`）
 *
 * ## 使用示例
 *
 * ```typescript
 * import type { PluginAPI } from '@vanblog/shared/plugin';
 * import { z } from 'zod';
 *
 * const BookSchema = z.object({
 *   id: z.number(),
 *   title: z.string(),
 *   author: z.string(),
 * });
 *
 * export default (api: PluginAPI) => {
 *   // 声明式资源注册（自动生成 CRUD API + 数据库表）
 *   api.registerResource('book', {
 *     schema: BookSchema,
 *     endpoints: {
 *       list: true,
 *       get: true,
 *       create: true,
 *       update: true,
 *       delete: true,
 *     },
 *     hooks: {
 *       beforeCreate: (data) => ({ ...data, createdAt: new Date() }),
 *       afterCreate: (book) => api.log.info(`Book created: ${book.title}`),
 *     },
 *   });
 *
 *   // 数据库访问
 *   const books = await api.db.select().from(api.table('book'));
 *
 *   // 依赖注入
 *   const configService = api.inject(ConfigService);
 *
 *   // HTTP 路由注册（ts-rest）
 *   api.http.contract({
 *     getStats: {
 *       method: 'GET',
 *       path: '/stats',
 *       responses: {
 *         200: z.object({ total: z.number() }),
 *       },
 *     },
 *   }, {
 *     getStats: async () => {
 *       const total = await api.db.select().from(api.table('book')).length;
 *       return { status: 200, body: { total } };
 *     },
 *   });
 *
 *   // 插件间通信
 *   api.exposeAPI('book', {
 *     search: async (query: string) => {
 *       return await api.db.select().from(api.table('book'));
 *     },
 *   });
 *
 *   // Filter Hook
 *   api.filter('article.beforeCreate', (article) => ({
 *     ...article,
 *     processedBy: api.id,
 *   }));
 * };
 * ```
 */

import type { z } from 'zod';
import type { AppRoute, AppRouter, ServerInferRequest, ServerInferResponses } from '@ts-rest/core';
import type { Type } from '@nestjs/common';
import type { SyncSignal, AsyncSignal } from '../signals/types.js';
import type { PluginMetadata } from './manifest.js';

// ============================================================
// 基础类型定义
// ============================================================

/**
 * 响应式引用（类似 Vue ref）
 *
 * 修改 value 自动持久化到数据库
 */
export interface Ref<T> {
  /** 当前值 */
  value: T;
}

/**
 * 日志接口
 */
export interface Logger {
  log(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

// ============================================================
// Hook 系统类型
// ============================================================

/**
 * Filter 回调函数
 *
 * - 接收数据，返回修改后的数据
 * - 支持同步或异步返回
 */
export type FilterCallback<T = unknown> = (value: T) => T | Promise<T>;

/**
 * Action 回调函数
 *
 * - 接收数据，不返回值（用于副作用）
 * - 支持同步或异步执行
 */
export type ActionCallback<T = unknown> = (value: T) => void | Promise<void>;

// ============================================================
// Shortcode 系统类型
// ============================================================

/**
 * Shortcode 上下文
 */
export interface ShortcodeContext {
  /** 文章/页面 ID */
  postId: number;
  /** 内容类型 */
  postType: 'article' | 'page' | 'draft';
  /** 插件 ID */
  pluginId: string;
}

/**
 * Shortcode 处理器
 *
 * @param attrs - 属性对象 `[tag attr="value"]` -> `{ attr: "value" }`
 * @param content - 内容 `[tag]content[/tag]` -> `"content"`
 * @param ctx - 上下文信息
 * @returns 渲染后的 HTML
 */
export type ShortcodeHandler = (
  attrs: Record<string, string>,
  content: string | null,
  ctx: ShortcodeContext,
) => string | Promise<string>;

// ============================================================
// 数据库访问类型
// ============================================================

/**
 * Drizzle 数据库实例类型
 *
 * 这是一个泛型类型，实际类型由 Drizzle 提供
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any; // TODO: 使用实际的 Drizzle 类型

/**
 * Drizzle 表类型
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleTable = any; // TODO: 使用实际的 Drizzle 类型

// ============================================================
// HTTP 路由类型
// ============================================================

/**
 * HTTP 请求处理器
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequestHandler = (req: any, res: any) => void | Promise<void>;

/**
 * 请求上下文（用于权限检查）
 */
export interface RequestContext {
  /** 当前用户 */
  user?: {
    id: number;
    type: 'admin' | 'collaborator';
    username: string;
  };
  /** 路径参数 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>;
  /** 查询参数 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: Record<string, any>;
  /** 请求体 */
  body: unknown;
}

/**
 * 权限检查函数
 */
export type PermissionCheck = (ctx: RequestContext) => boolean | Promise<boolean>;

/**
 * ts-rest 契约处理器
 */
export type ContractHandler<T extends AppRoute> = (
  request: ServerInferRequest<T>,
) => Promise<ServerInferResponses<T>>;

/**
 * ts-rest 契约处理器映射
 */
export type ContractHandlers<C> = C extends AppRouter
  ? {
      [K in keyof C]: C[K] extends AppRoute
        ? ContractHandler<C[K]>
        : C[K] extends AppRouter
          ? ContractHandlers<C[K]>
          : never;
    }
  : never;

/**
 * HTTP 路由注册器
 */
export interface HttpRegistrar {
  /**
   * 注册 ts-rest 契约（推荐）
   *
   * @param contract - ts-rest 契约定义
   * @param handlers - 契约处理器
   *
   * @example
   * ```typescript
   * api.http.contract({
   *   getBooks: {
   *     method: 'GET',
   *     path: '/books',
   *     responses: { 200: z.array(BookSchema) },
   *   },
   * }, {
   *   getBooks: async () => {
   *     const books = await api.db.select().from(api.table('book'));
   *     return { status: 200, body: books };
   *   },
   * });
   * ```
   */
  contract<C extends AppRouter>(contract: C, handlers: ContractHandlers<C>): void;

  /**
   * 注册 GET 路由（原始 HTTP，不推荐）
   *
   * @param path - 路由路径（相对于插件命名空间）
   * @param handler - 请求处理器
   */
  get(path: string, handler: RequestHandler): void;

  /**
   * 注册 POST 路由（原始 HTTP，不推荐）
   */
  post(path: string, handler: RequestHandler): void;

  /**
   * 注册 PUT 路由（原始 HTTP，不推荐）
   */
  put(path: string, handler: RequestHandler): void;

  /**
   * 注册 PATCH 路由（原始 HTTP，不推荐）
   */
  patch(path: string, handler: RequestHandler): void;

  /**
   * 注册 DELETE 路由（原始 HTTP，不推荐）
   */
  delete(path: string, handler: RequestHandler): void;
}

// ============================================================
// 声明式资源注册类型
// ============================================================

/**
 * 端点配置
 */
export interface EndpointConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 自定义路径（可选） */
  path?: string;
  /** 权限检查 */
  permission?: PermissionCheck;
}

/**
 * 资源钩子
 */
export interface ResourceHooks<T> {
  /** 创建前（可修改数据） */
  beforeCreate?: (data: T) => T | Promise<T>;
  /** 创建后（副作用） */
  afterCreate?: (data: T) => void | Promise<void>;
  /** 更新前（可修改数据） */
  beforeUpdate?: (id: number, data: Partial<T>) => Partial<T> | Promise<Partial<T>>;
  /** 更新后（副作用） */
  afterUpdate?: (data: T) => void | Promise<void>;
  /** 删除前（副作用） */
  beforeDelete?: (id: number) => void | Promise<void>;
  /** 删除后（副作用） */
  afterDelete?: (id: number) => void | Promise<void>;
}

/**
 * 资源注册选项
 */
export interface ResourceOptions<T extends z.ZodType> {
  /** Zod Schema（作为单一数据源） */
  schema: T;

  /** 启用的端点 */
  endpoints?: {
    /** GET /resources - 列表 */
    list?: boolean | EndpointConfig;
    /** GET /resources/:id - 详情 */
    get?: boolean | EndpointConfig;
    /** POST /resources - 创建 */
    create?: boolean | EndpointConfig;
    /** PATCH /resources/:id - 更新 */
    update?: boolean | EndpointConfig;
    /** DELETE /resources/:id - 删除 */
    delete?: boolean | EndpointConfig;
  };

  /** 资源钩子 */
  hooks?: ResourceHooks<z.infer<T>>;

  /** 权限配置 */
  permissions?: {
    list?: PermissionCheck;
    get?: PermissionCheck;
    create?: PermissionCheck;
    update?: PermissionCheck;
    delete?: PermissionCheck;
  };
}

// ============================================================
// 元数据系统类型
// ============================================================

/**
 * 元数据管理器
 */
export interface MetadataManager {
  /**
   * 注册元数据字段
   *
   * @param entityType - 实体类型（article, user, category, tag）
   * @param metaKey - 元数据键
   * @param schema - Zod Schema（用于验证）
   *
   * @example
   * ```typescript
   * api.meta.register('article', 'readTime', z.number().int().positive());
   * ```
   */
  register(
    entityType: 'article' | 'user' | 'category' | 'tag',
    metaKey: string,
    schema: z.ZodType,
  ): void;

  /**
   * 获取元数据
   *
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param metaKey - 元数据键
   * @returns 元数据值（未找到返回 null）
   */
  get<T>(entityType: string, entityId: number, metaKey: string): Promise<T | null>;

  /**
   * 设置元数据
   *
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param metaKey - 元数据键
   * @param value - 元数据值
   */
  set<T>(entityType: string, entityId: number, metaKey: string, value: T): Promise<void>;

  /**
   * 删除元数据
   *
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param metaKey - 元数据键
   */
  delete(entityType: string, entityId: number, metaKey: string): Promise<void>;
}

// ============================================================
// PluginAPI 主接口
// ============================================================

/**
 * 插件 API 接口（v2.0）
 *
 * 这是插件的主要入口点，提供所有插件功能
 */
export interface PluginAPI {
  // ========== 元信息 ==========

  /** 插件 ID（从目录名推断） */
  readonly id: string;

  /** 插件版本（从 package.json 读取） */
  readonly version: string;

  /** 插件目录绝对路径 */
  readonly dir: string;

  /** 完整的插件元数据 */
  readonly metadata: PluginMetadata;

  // ========== 配置系统 ==========

  /**
   * 已合并的配置
   *
   * 优先级：数据库 > 环境变量 > package.json 默认值
   */
  readonly config: Record<string, unknown>;

  /**
   * 监听配置变化
   *
   * @param key - 配置键
   * @param callback - 变化回调
   * @returns 取消监听函数
   */
  onConfigChange(key: string, callback: (value: unknown) => void): () => void;

  // ========== 数据存储（响应式） ==========

  /**
   * 获取响应式存储
   *
   * @param key - 存储键
   * @param defaultValue - 默认值
   * @returns 响应式引用
   *
   * @example
   * ```typescript
   * const count = api.store('count', 0);
   * count.value++; // 自动保存到数据库
   * ```
   */
  store<T>(key: string, defaultValue: T): Ref<T>;

  // ========== 数据库访问（v2.0 新增） ==========

  /**
   * Drizzle 数据库实例
   *
   * 直接访问数据库，可执行任意 SQL 查询
   *
   * @example
   * ```typescript
   * const books = await api.db.select().from(api.table('book'));
   * ```
   */
  readonly db: Database;

  /**
   * 获取插件专属表
   *
   * 表名自动加前缀：`plugin_{pluginId}_{tableName}`
   *
   * 如果提供 schema，将自动创建表（如果不存在）
   *
   * @param name - 表名
   * @param schema - 可选的 Zod Object Schema（用于动态创建表）
   * @returns Drizzle 表实例
   *
   * @example
   * ```typescript
   * // 方式1: 首次使用，提供 schema 创建表
   * const BookSchema = z.object({
   *   id: z.number(),
   *   title: z.string(),
   *   author: z.string(),
   * });
   * const bookTable = api.table('book', BookSchema);
   *
   * // 方式2: 后续使用，不需要再提供 schema
   * const bookTable = api.table('book');
   *
   * // 使用表进行数据库操作
   * const books = await api.db.select().from(bookTable);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table(name: string, schema?: z.ZodObject<any>): DrizzleTable;

  /**
   * 获取核心表（只读访问）
   *
   * @param name - 核心表名（article, user, category, tag 等）
   * @returns Drizzle 表实例
   *
   * @example
   * ```typescript
   * const articles = await api.db.select()
   *   .from(api.coreTable('article'))
   *   .where(eq(api.coreTable('article').published, true));
   * ```
   */
  coreTable(name: string): DrizzleTable;

  // ========== 依赖注入（v2.0 新增） ==========

  /**
   * 注入服务
   *
   * @param token - 服务 Token（类、字符串或 Symbol）
   * @param pluginId - 插件 ID（可选，用于注入其他插件的服务）
   * @returns 服务实例
   *
   * @example
   * ```typescript
   * // 注入核心服务
   * const configService = api.inject(ConfigService);
   *
   * // 注入其他插件的服务
   * const bookService = api.inject(BookService, 'book-plugin');
   * ```
   */
  inject<T>(token: Type<T> | string | symbol, pluginId?: string): T;

  /**
   * 提供服务（供其他插件注入）
   *
   * @param serviceClass - 服务类
   * @param options - 选项
   *
   * @example
   * ```typescript
   * @Injectable()
   * class BookService {
   *   async getRecommendations(userId: number) { ... }
   * }
   *
   * api.provideService(BookService);
   * ```
   */
  provideService<T>(
    serviceClass: Type<T>,
    options?: {
      /** 作用域（单例或瞬态） */
      scope?: 'singleton' | 'transient';
    },
  ): void;

  // ========== HTTP 路由（v2.0 新增） ==========

  /**
   * HTTP 路由注册器
   *
   * 所有路由自动加前缀：`/api/v2/plugins/{pluginId}/`
   */
  readonly http: HttpRegistrar;

  // ========== 声明式资源注册（v2.0 新增） ==========

  /**
   * 注册资源（WordPress 风格）
   *
   * 自动生成：
   * - Drizzle 表（基于 Zod Schema）
   * - ts-rest 契约（类型安全）
   * - CRUD Controller（自动实现）
   * - Swagger 文档
   *
   * @param name - 资源名称
   * @param options - 资源选项
   *
   * @example
   * ```typescript
   * const BookSchema = z.object({
   *   id: z.number(),
   *   title: z.string().min(1).max(200),
   *   author: z.string(),
   * });
   *
   * api.registerResource('book', {
   *   schema: BookSchema,
   *   endpoints: {
   *     list: true,    // GET /api/v2/plugins/my-plugin/books
   *     get: true,     // GET /api/v2/plugins/my-plugin/books/:id
   *     create: true,  // POST /api/v2/plugins/my-plugin/books
   *     update: true,  // PATCH /api/v2/plugins/my-plugin/books/:id
   *     delete: true,  // DELETE /api/v2/plugins/my-plugin/books/:id
   *   },
   *   hooks: {
   *     beforeCreate: (data) => ({ ...data, createdAt: new Date() }),
   *     afterCreate: (book) => api.log.info(`Created: ${book.title}`),
   *   },
   * });
   * ```
   */
  registerResource<T extends z.ZodType>(name: string, options: ResourceOptions<T>): void;

  // ========== 插件间通信（v2.0 新增） ==========

  /**
   * 暴露 API 给其他插件
   *
   * @param apiName - API 名称
   * @param api - API 对象
   *
   * @example
   * ```typescript
   * const BookAPI = {
   *   search: async (query: string) => {
   *     return await api.db.select().from(api.table('book'));
   *   },
   *   getRecommendations: async (userId: number) => { ... },
   * };
   *
   * api.exposeAPI('book', BookAPI);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exposeAPI<T extends Record<string, any>>(apiName: string, api: T): void;

  /**
   * 使用其他插件的 API
   *
   * @param pluginId - 插件 ID
   * @param apiName - API 名称
   * @returns API 对象（未找到返回 null）
   *
   * @example
   * ```typescript
   * const bookAPI = api.useAPI<typeof BookAPI>('book-plugin', 'book');
   * if (bookAPI) {
   *   const books = await bookAPI.search('typescript');
   * }
   * ```
   */
  useAPI<T>(pluginId: string, apiName: string): T | null;

  // ========== 元数据系统（v2.0 新增） ==========

  /**
   * 元数据管理器
   *
   * 用于为实体（文章、用户等）添加自定义字段
   */
  readonly meta: MetadataManager;

  // ========== Hook 系统（保留 v1.0） ==========

  /**
   * 注册 Filter（同步 Signal）
   *
   * Filter 用于修改数据，必须返回修改后的值
   *
   * @param name - Hook 名称（如 'article.beforeCreate'）
   * @param callback - 处理函数
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 取消注册函数
   *
   * @example
   * ```typescript
   * api.filter('article.beforeCreate', (article) => ({
   *   ...article,
   *   title: article.title + '喵',
   * }));
   * ```
   */
  filter<T = unknown>(name: string, callback: FilterCallback<T>, priority?: number): () => void;

  /**
   * 注册 Filter（使用 Signal 定义）
   *
   * 提供更好的类型推导
   */
  filter<S extends SyncSignal<z.ZodType>>(
    signal: S,
    callback: FilterCallback<z.infer<S['schema']>>,
    priority?: number,
  ): () => void;

  /**
   * 注册 Action（异步 Signal）
   *
   * Action 用于副作用，不返回值
   *
   * @param name - Hook 名称（如 'article.afterCreate'）
   * @param callback - 处理函数
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 取消注册函数
   *
   * @example
   * ```typescript
   * api.action('article.afterCreate', (article) => {
   *   console.log(`Created: ${article.title}`);
   * });
   * ```
   */
  action<T = unknown>(name: string, callback: ActionCallback<T>, priority?: number): () => void;

  /**
   * 注册 Action（使用 Signal 定义）
   *
   * 提供更好的类型推导
   */
  action<S extends AsyncSignal<z.ZodType>>(
    signal: S,
    callback: ActionCallback<z.infer<S['schema']>>,
    priority?: number,
  ): () => void;

  // ========== 公共数据（保留 v1.0） ==========

  /**
   * 提供公共数据
   *
   * 数据将通过 Bootstrap API 暴露给前端
   *
   * @param key - 数据键
   * @param data - 数据或数据提供函数
   * @param priority - 优先级（数字越小越先加载）
   *
   * @example
   * ```typescript
   * // 静态数据
   * api.provide('rewards', [{ name: 'Alipay', url: '...' }]);
   *
   * // 动态数据
   * api.provide('rewards', async () => await loadRewards());
   * ```
   */
  provide(key: string, data: unknown | (() => unknown | Promise<unknown>), priority?: number): void;

  // ========== Shortcode（保留 v1.0） ==========

  /**
   * 注册 Shortcode
   *
   * @param tag - Shortcode 标签
   * @param handler - 处理函数
   *
   * @example
   * ```typescript
   * api.shortcode('gallery', (attrs, content) => {
   *   const { ids, columns = '3' } = attrs;
   *   return `<div class="gallery cols-${columns}">...</div>`;
   * });
   * ```
   *
   * 文章中使用：
   * ```markdown
   * [gallery ids="1,2,3" columns="4"]
   * ```
   */
  shortcode(tag: string, handler: ShortcodeHandler): void;

  // ========== 日志（保留 v1.0） ==========

  /** 日志实例（自动添加插件前缀） */
  readonly log: Logger;

  // ========== 生命周期（保留 v1.0） ==========

  /**
   * 插件激活回调
   *
   * @param callback - 回调函数
   */
  onActivate(callback: () => void | Promise<void>): void;

  /**
   * 插件停用回调
   *
   * @param callback - 回调函数
   */
  onDeactivate(callback: () => void | Promise<void>): void;
}

// ============================================================
// 插件入口函数类型
// ============================================================

/**
 * 插件入口函数（v2.0）
 *
 * @example
 * ```typescript
 * // plugins/my-plugin/index.ts
 * import type { PluginEntry } from '@vanblog/shared/plugin';
 * import { z } from 'zod';
 *
 * const BookSchema = z.object({
 *   id: z.number(),
 *   title: z.string(),
 * });
 *
 * const plugin: PluginEntry = (api) => {
 *   // 声明式资源注册
 *   api.registerResource('book', {
 *     schema: BookSchema,
 *     endpoints: { list: true, create: true },
 *   });
 *
 *   // Filter Hook
 *   api.filter('article.beforeCreate', (article) => ({
 *     ...article,
 *     processedBy: api.id,
 *   }));
 * };
 *
 * export default plugin;
 * ```
 */
export type PluginEntry = (api: PluginAPI) => void | Promise<void>;
