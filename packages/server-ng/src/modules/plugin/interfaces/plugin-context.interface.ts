import type { Logger } from '@nestjs/common';
import type { SyncSignal, AsyncSignal, SyncReceiver, AsyncReceiver } from '@vanblog/shared/signals';
import type { z } from 'zod';

export interface PluginDataStorage {
  get(key: string): Promise<unknown>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface PluginConfigReader {
  get(key: string): unknown;
  get<T>(key: string, defaultValue: T): T;
  getOrThrow(key: string): unknown;
  has(key: string): boolean;
}

// 供插件通过上下文访问的"公共数据注册表"最小接口，避免直接暴露内部服务实现
export type PluginPublicDataProvider<T = unknown> = () => Promise<T> | T;
export interface PluginRegistryAccessor {
  register<T = unknown>(
    pluginName: string,
    provider: PluginPublicDataProvider<T>,
    priority?: number,
  ): void;
  unregister(pluginName: string): boolean;
}

/**
 * 插件 Signal 访问器
 *
 * 提供类型安全的 Signal 注册 API
 *
 * @example
 * ```typescript
 * import { signals } from '@vanblog/shared/signals';
 *
 * // 连接同步 Signal（可修改数据）
 * const disconnect = context.signals.connect(
 *   signals.article.beforeCreate,
 *   (article) => ({ ...article, title: article.title + '喵' }),
 * );
 *
 * // 订阅异步 Signal（副作用）
 * const unsubscribe = context.signals.subscribe(
 *   signals.article.afterCreate,
 *   (article) => console.log(`Created: ${article.title}`),
 * );
 * ```
 */
export interface PluginSignalAccessor {
  /**
   * 连接同步 Signal（可修改数据）
   *
   * @param signal - Signal 定义
   * @param receiver - 处理函数，必须返回与输入相同类型的数据
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 断开连接的函数
   */
  connect<T extends z.ZodType>(
    signal: SyncSignal<T>,
    receiver: SyncReceiver<z.infer<T>>,
    priority?: number,
  ): () => void;

  /**
   * 订阅异步 Signal（副作用）
   *
   * @param signal - Signal 定义
   * @param receiver - 处理函数，不返回值
   * @param priority - 优先级（数字越小越先执行，默认 10）
   * @returns 取消订阅的函数
   */
  subscribe<T extends z.ZodType>(
    signal: AsyncSignal<T>,
    receiver: AsyncReceiver<z.infer<T>>,
    priority?: number,
  ): () => void;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly config: PluginConfigReader;
  readonly data: PluginDataStorage;
  readonly registry: PluginRegistryAccessor;
  /** Signal API */
  readonly signals: PluginSignalAccessor;
  readonly logger: Logger;
}

export interface PluginContextFactory {
  createContext(pluginId: string): PluginContext;
}
