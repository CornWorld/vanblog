import type { ActionCallback, FilterCallback } from './hook.interface';
import type { Logger } from '@nestjs/common';

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

// 供插件通过上下文访问的“公共数据注册表”最小接口，避免直接暴露内部服务实现
export type PluginPublicDataProvider<T = unknown> = () => Promise<T> | T;
export interface PluginRegistryAccessor {
  register<T = unknown>(
    pluginName: string,
    provider: PluginPublicDataProvider<T>,
    priority?: number,
  ): void;
  unregister(pluginName: string): boolean;
}

export interface PluginHooksAccessor {
  addAction(hookName: string, callback: ActionCallback, priority?: number): string;
  addFilter<T>(hookName: string, callback: FilterCallback<T>, priority?: number): string;
  removeAction(hookName: string, id: string): boolean;
  removeFilter(hookName: string, id: string): boolean;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly config: PluginConfigReader;
  readonly data: PluginDataStorage;
  readonly registry: PluginRegistryAccessor;
  readonly hooks: PluginHooksAccessor;
  readonly logger: Logger;
}

export interface PluginContextFactory {
  createContext(pluginId: string): PluginContext;
}
