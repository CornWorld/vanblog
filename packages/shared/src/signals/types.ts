/**
 * @file signals/types.ts
 *
 * Signal 类型定义 - VanBlog 插件系统核心
 *
 * ## 设计理念
 *
 * 结合 Django Signals 的代码对象引用和 Medusa.js 的类型安全，
 * 提供比 WordPress Hooks 更优雅的插件扩展机制。
 *
 * ## Signal vs Hook
 *
 * | 维度 | Hook (WordPress) | Signal (VanBlog) |
 * |------|-----------------|------------------|
 * | 标识符 | 字符串 `'article|beforeCreate'` | 对象 `signals.article.beforeCreate` |
 * | IDE 支持 | ❌ 无法跳转 | ✅ Cmd+Click 跳转 |
 * | 类型安全 | ❌ unknown + as | ✅ 自动推导 |
 * | 运行时校验 | ❌ 无 | ✅ Zod safeParse |
 *
 * ## 命名约定
 *
 * - `beforeXxx`: 同步 Signal，可修改数据（sync）
 * - `afterXxx`: 异步 Signal，用于副作用（async）
 */

import type { z } from 'zod';

// ============================================================
// Signal 定义类型
// ============================================================

/**
 * Signal 定义基础接口
 *
 * @template T - Zod Schema 类型
 * @template Type - Signal 类型：'sync' 可修改数据，'async' 用于副作用
 */
export interface SignalDef<
  T extends z.ZodType = z.ZodType,
  Type extends 'sync' | 'async' = 'sync',
> {
  /** Signal 唯一标识符（用于日志/调试/序列化） */
  readonly id: string;
  /** Zod Schema（用于类型推导和运行时校验） */
  readonly schema: T;
  /** Signal 类型 */
  readonly type: Type;
  /** 描述（用于文档生成） */
  readonly description?: string;
}

/**
 * 同步 Signal 定义
 *
 * - 用于数据转换/修改
 * - receiver 必须返回与输入相同类型的数据
 * - 多个 receiver 按优先级链式调用
 *
 * @example
 * ```typescript
 * // 定义
 * const beforeCreate = defineSync('article.beforeCreate', $ArticleIns);
 *
 * // 使用
 * signalBus.connect(beforeCreate, (article) => ({
 *   ...article,
 *   title: article.title + '喵',
 * }));
 * ```
 */
export type SyncSignal<T extends z.ZodType = z.ZodType> = SignalDef<T, 'sync'>;

/**
 * 异步 Signal 定义
 *
 * - 用于副作用（日志、通知、缓存刷新等）
 * - receiver 不返回值
 * - 并行执行，不阻塞主流程
 *
 * @example
 * ```typescript
 * // 定义
 * const afterCreate = defineAsync('article.afterCreate', $Article);
 *
 * // 使用
 * signalBus.subscribe(afterCreate, (article) => {
 *   console.log(`Created: ${article.title}`);
 * });
 * ```
 */
export type AsyncSignal<T extends z.ZodType = z.ZodType> = SignalDef<T, 'async'>;

// ============================================================
// 类型工具
// ============================================================

/**
 * 从 Signal 定义提取数据类型
 *
 * @example
 * ```typescript
 * type ArticleData = SignalData<typeof signals.article.beforeCreate>;
 * // ArticleData = $ArticleIns
 * ```
 */
export type SignalData<S extends SignalDef> = z.infer<S['schema']>;

/**
 * 判断是否为同步 Signal
 */
export type IsSyncSignal<S extends SignalDef> = S extends SyncSignal ? true : false;

/**
 * 判断是否为异步 Signal
 */
export type IsAsyncSignal<S extends SignalDef> = S extends AsyncSignal ? true : false;

// ============================================================
// Receiver 类型
// ============================================================

/**
 * Signal 上下文
 *
 * 传递给 receiver 的上下文信息
 */
export interface SignalContext {
  /** 触发 Signal 的插件 ID（如果是插件触发） */
  pluginId?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 同步 Signal Receiver
 *
 * - 接收数据和上下文
 * - 必须返回相同类型的数据（可修改）
 * - 支持同步或异步返回
 */
export type SyncReceiver<T> = (data: T, ctx: SignalContext) => T | Promise<T>;

/**
 * 异步 Signal Receiver
 *
 * - 接收数据和上下文
 * - 不返回值（副作用）
 * - 支持同步或异步执行
 */
export type AsyncReceiver<T> = (data: T, ctx: SignalContext) => void | Promise<void>;

// ============================================================
// 工厂函数
// ============================================================

/**
 * 创建同步 Signal 定义
 *
 * @param id - Signal 唯一标识符
 * @param schema - Zod Schema
 * @param description - 描述（可选）
 *
 * @example
 * ```typescript
 * const beforeCreate = defineSync('article.beforeCreate', $ArticleIns, '文章创建前');
 * ```
 */
export function defineSync<T extends z.ZodType>(
  id: string,
  schema: T,
  description?: string,
): SyncSignal<T> {
  return { id, schema, type: 'sync', description };
}

/**
 * 创建异步 Signal 定义
 *
 * @param id - Signal 唯一标识符
 * @param schema - Zod Schema
 * @param description - 描述（可选）
 *
 * @example
 * ```typescript
 * const afterCreate = defineAsync('article.afterCreate', $Article, '文章创建后');
 * ```
 */
export function defineAsync<T extends z.ZodType>(
  id: string,
  schema: T,
  description?: string,
): AsyncSignal<T> {
  return { id, schema, type: 'async', description };
}

// ============================================================
// SignalBus 接口
// ============================================================

/**
 * SignalBus 接口
 *
 * 用于注册和触发 Signal
 */
export interface ISignalBus {
  /**
   * 连接同步 Signal
   *
   * @param signal - Signal 定义
   * @param receiver - 处理函数
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 断开连接的函数
   */
  connect<T extends z.ZodType>(
    signal: SyncSignal<T>,
    receiver: SyncReceiver<z.infer<T>>,
    priority?: number,
  ): () => void;

  /**
   * 订阅异步 Signal
   *
   * @param signal - Signal 定义
   * @param receiver - 处理函数
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 取消订阅的函数
   */
  subscribe<T extends z.ZodType>(
    signal: AsyncSignal<T>,
    receiver: AsyncReceiver<z.infer<T>>,
    priority?: number,
  ): () => void;

  /**
   * 发送同步 Signal
   *
   * @param signal - Signal 定义
   * @param data - 数据
   * @param context - 上下文（可选）
   * @returns 修改后的数据
   */
  send<T extends z.ZodType>(
    signal: SyncSignal<T>,
    data: z.infer<T>,
    context?: SignalContext,
  ): Promise<z.infer<T>>;

  /**
   * 发送异步 Signal
   *
   * @param signal - Signal 定义
   * @param data - 数据
   * @param context - 上下文（可选）
   */
  emit<T extends z.ZodType>(
    signal: AsyncSignal<T>,
    data: z.infer<T>,
    context?: SignalContext,
  ): Promise<void>;
}

// ============================================================
// 插件 Signal 访问器接口
// ============================================================

/**
 * 插件 Signal 访问器
 *
 * 提供给插件的 Signal API，包装了 SignalBus 并自动注入插件上下文
 */
export interface PluginSignalAccessor {
  /**
   * 连接同步 Signal
   *
   * @returns 断开连接的函数
   */
  connect<T extends z.ZodType>(
    signal: SyncSignal<T>,
    receiver: SyncReceiver<z.infer<T>>,
    priority?: number,
  ): () => void;

  /**
   * 订阅异步 Signal
   *
   * @returns 取消订阅的函数
   */
  subscribe<T extends z.ZodType>(
    signal: AsyncSignal<T>,
    receiver: AsyncReceiver<z.infer<T>>,
    priority?: number,
  ): () => void;
}
