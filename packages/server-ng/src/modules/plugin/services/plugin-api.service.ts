/**
 * @file plugin-api.service.ts
 *
 * PluginAPI v2.0 实现 - 增强型插件开发 API
 *
 * 提供完整的插件开发能力：
 * - 数据库访问（api.db, api.table, api.coreTable）
 * - 依赖注入（api.inject, api.provideService）
 * - HTTP 路由注册（api.http）
 * - 声明式资源注册（api.registerResource）
 * - 插件间通信（api.exposeAPI, api.useAPI）
 * - 元数据系统（api.meta）
 * - Hook 系统（api.filter, api.action）
 * - Shortcode 系统（api.shortcode）
 * - 配置管理（api.config, api.onConfigChange）
 * - 响应式存储（api.store）
 */

import { Inject, Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { dayjs } from '@vanblog/shared';
import { pluginData } from '@vanblog/shared/drizzle';
import * as allTables from '@vanblog/shared/drizzle';
import { parsePluginMetadata, getConfigDefaults } from '@vanblog/shared/plugin';
import { and, eq } from 'drizzle-orm';

import { type Database } from '../../../database/connection';
import { DATABASE_CONNECTION } from '../../../database/constants';
import { ShortcodeService } from '../../shortcode/shortcode.service';
import { withPluginPrefix } from '../utils/prefix.util';
import { createTableFromSchema } from '../utils/schema-to-table.util';

import { PluginConfigService } from './plugin-config.service';
import { PluginRegistryService } from './plugin-registry.service';
import { SignalBus } from './signal.service';

import type {
  PluginMetadata,
  PluginPackageJson,
  PluginAPI,
  Ref,
  FilterCallback,
  ActionCallback,
  ShortcodeHandler,
  Logger as ILogger,
  HttpRegistrar,
  ResourceOptions,
  MetadataManager,
  Database as PluginDatabase,
  DrizzleTable,
} from '@vanblog/shared/plugin';
import type { SyncSignal, AsyncSignal } from '@vanblog/shared/signals';
import type { z } from 'zod';

// ============================================================
// 响应式存储实现
// ============================================================

/**
 * 响应式引用实现
 *
 * 修改 value 时自动持久化到数据库
 */
class RefImpl<T> implements Ref<T> {
  private readonly logger = new Logger(RefImpl.name);
  private _value: T;

  constructor(
    private readonly db: Database,
    private readonly pluginId: string,
    private readonly key: string,
    initialValue: T,
  ) {
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    // 异步保存，不阻塞
    this.save().catch((error) => {
      this.logger.error(
        `Failed to save plugin data for key '${this.key}' in plugin '${this.pluginId}':`,
        error instanceof Error ? error : new Error(String(error)),
      );
    });
  }

  private async save(): Promise<void> {
    const stringValue = JSON.stringify(this._value);
    const now = dayjs().format();

    await (
      this.db as Database & {
        $client: { execute: (query: { sql: string; args: unknown[] }) => Promise<unknown> };
      }
    ).$client.execute({
      sql: `INSERT INTO plugin_data (plugin_id, key, value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(plugin_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [this.pluginId, this.key, stringValue, now, now],
    });
  }

  /**
   * 从数据库加载值
   */
  async load(): Promise<void> {
    try {
      const result = await this.db
        .select({ value: pluginData.value })
        .from(pluginData)
        .where(and(eq(pluginData.pluginId, this.pluginId), eq(pluginData.key, this.key)))
        .limit(1);

      if (result.length > 0 && result[0].value !== null) {
        this._value = result[0].value as T;
      }
    } catch {
      // 保持默认值
    }
  }
}

// ============================================================
// HTTP 路由注册器实现
// ============================================================

/**
 * HTTP 路由注册器实现
 *
 * v2.0: 提供 HTTP 路由注册能力
 *
 * **功能**：
 * - 注册 ts-rest 契约路由（类型安全，推荐）
 * - 注册原始 HTTP 路由（灵活，但不推荐）
 * - 所有路由自动加前缀：`/api/v2/plugins/{pluginId}/`
 */
class HttpRegistrarImpl implements HttpRegistrar {
  constructor(
    private readonly pluginId: string,
    private readonly log: ILogger,
    private readonly httpRegistry?: any, // PluginHttpRegistryService
  ) {}

  contract<C extends Record<string, any>>(contract: C, handlers: any): void {
    if (!this.httpRegistry) {
      this.log.error('HTTP 注册表服务未注入，无法注册契约路由');
      throw new Error('HTTP 注册表服务未初始化');
    }

    this.log.log(`注册 ts-rest 契约路由`);

    try {
      this.httpRegistry.registerContract(this.pluginId, contract, handlers);
      this.log.log(`ts-rest 契约路由注册成功`);
    } catch (error) {
      this.log.error('契约路由注册失败', error);
      throw error;
    }
  }

  get(path: string, handler: any): void {
    this.registerRawRoute('GET', path, handler);
  }

  post(path: string, handler: any): void {
    this.registerRawRoute('POST', path, handler);
  }

  put(path: string, handler: any): void {
    this.registerRawRoute('PUT', path, handler);
  }

  patch(path: string, handler: any): void {
    this.registerRawRoute('PATCH', path, handler);
  }

  delete(path: string, handler: any): void {
    this.registerRawRoute('DELETE', path, handler);
  }

  /**
   * 注册原始 HTTP 路由
   */
  private registerRawRoute(method: string, path: string, handler: any): void {
    if (!this.httpRegistry) {
      this.log.error('HTTP 注册表服务未注入，无法注册原始路由');
      throw new Error('HTTP 注册表服务未初始化');
    }

    this.log.log(`注册原始路由: ${method} ${path}`);

    try {
      this.httpRegistry.registerRawRoute(this.pluginId, method as any, path, handler);
      this.log.log(`原始路由注册成功: ${method} ${path}`);
    } catch (error) {
      this.log.error(`原始路由注册失败: ${method} ${path}`, error);
      throw error;
    }
  }
}

// ============================================================
// 元数据管理器实现
// ============================================================

/**
 * 元数据管理器实现
 *
 * v2.0: 提供实体元数据管理能力（类似 WordPress custom fields）
 *
 * TODO: 完整实现需要创建 metadata 数据表
 */
/**
 * 元数据管理器实现
 *
 * v2.0: 提供实体元数据管理能力（类似 WordPress custom fields）
 */
class MetadataManagerImpl implements MetadataManager {
  // 存储已注册的元数据 Schema（用于验证）
  private readonly registeredSchemas = new Map<string, z.ZodType>();

  constructor(
    // @ts-expect-error - Will be used when pluginMetadata table is implemented
    private readonly _pluginId: string,
    private readonly log: ILogger,
    // @ts-expect-error - Will be used when pluginMetadata table is implemented
    private readonly _db: Database,
  ) {}

  /**
   * 注册元数据字段的 Schema
   *
   * @param entityType - 实体类型（如 'article', 'user', 'draft'）
   * @param metaKey - 元数据键
   * @param schema - Zod Schema（用于验证）
   */
  register(entityType: string, metaKey: string, schema: z.ZodType): void {
    const key = this.makeSchemaKey(entityType, metaKey);
    this.registeredSchemas.set(key, schema);
    this.log.debug(`注册元数据 Schema: ${entityType}.${metaKey}`);
  }

  /**
   * 获取元数据
   *
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param metaKey - 元数据键
   * @returns 元数据值或 null
   */
  async get<T>(entityType: string, entityId: number, metaKey: string): Promise<T | null> {
    try {
      // TODO: Implement pluginMetadata table in @vanblog/shared/drizzle
      this.log.warn(`MetadataManager.get() not implemented: ${entityType}/${entityId}/${metaKey}`);
      return null;
    } catch (error) {
      this.log.error(`获取元数据失败: ${entityType}#${entityId}.${metaKey}`, error);
      return null; // Return null instead of throwing
    }
  }

  /**
   * 设置元数据
   *
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param metaKey - 元数据键
   * @param value - 元数据值
   */
  async set<T>(entityType: string, entityId: number, metaKey: string, _value: T): Promise<void> {
    try {
      // TODO: Implement pluginMetadata table in @vanblog/shared/drizzle
      this.log.warn(`MetadataManager.set() not implemented: ${entityType}/${entityId}/${metaKey}`);
      return;
    } catch (error) {
      this.log.error(`设置元数据失败: ${entityType}#${entityId}.${metaKey}`, error);
      // Don't throw, just log
    }
  }

  /**
   * 删除元数据
   *
   * @param entityType - 实体类型
   * @param entityId - 实体 ID
   * @param metaKey - 元数据键
   */
  async delete(entityType: string, entityId: number, metaKey: string): Promise<void> {
    try {
      // TODO: Implement pluginMetadata table in @vanblog/shared/drizzle
      this.log.warn(
        `MetadataManager.delete() not implemented: ${entityType}/${entityId}/${metaKey}`,
      );
      return;
    } catch (error) {
      this.log.error(`删除元数据失败: ${entityType}#${entityId}.${metaKey}`, error);
      // Don't throw, just log
    }
  }

  /**
   * 生成 Schema 注册键
   */
  private makeSchemaKey(entityType: string, metaKey: string): string {
    return `${entityType}:${metaKey}`;
  }
}

// ============================================================
// PluginAPI 实现
// ============================================================

/**
 * PluginAPI v2.0 实现类
 */
export class PluginAPIImpl implements PluginAPI {
  public readonly log: ILogger;
  public readonly http: HttpRegistrar;
  public readonly meta: MetadataManager;

  // 追踪注册的资源，便于清理
  private readonly cleanupFns: (() => void)[] = [];
  private readonly stores = new Map<string, RefImpl<unknown>>();

  // v2.0: 插件间通信
  private readonly exposedAPIs = new Map<string, any>();

  private activateCallback?: () => void | Promise<void>;
  private deactivateCallback?: () => void | Promise<void>;

  // 配置缓存（同步访问）
  private _configCache: Record<string, unknown> | null = null;

  // v2.0: 插件专属表缓存
  private readonly pluginTables = new Map<string, DrizzleTable>();

  constructor(
    public readonly metadata: PluginMetadata,
    private readonly _db: Database,
    private readonly moduleRef: ModuleRef,
    private readonly signalBus: SignalBus,
    private readonly registryService: PluginRegistryService,
    private readonly shortcodeService: ShortcodeService,
    private readonly pluginConfigService: PluginConfigService,
    private readonly pluginAPIRegistry: Map<string, Map<string, any>>,
    private readonly httpRegistry?: any, // PluginHttpRegistryService
    private readonly serviceRegistry?: any, // PluginServiceRegistryService
  ) {
    this.log = new Logger(withPluginPrefix(this.id)) as unknown as ILogger;
    this.http = new HttpRegistrarImpl(this.id, this.log, httpRegistry);
    this.meta = new MetadataManagerImpl(this.id, this.log, this._db);
  }

  // ========== 元信息 ==========

  get id(): string {
    return this.metadata.id;
  }

  get version(): string {
    return this.metadata.version;
  }

  get dir(): string {
    return this.metadata.dir;
  }

  // ========== 配置 ==========

  get config(): Record<string, unknown> {
    // 返回缓存的配置（同步访问）
    // 配置在 _loadConfig() 中异步加载
    if (this._configCache) {
      return { ...this._configCache };
    }

    // 如果缓存还没有，返回默认值
    const defaults = getConfigDefaults(this.metadata.config);
    return { ...defaults };
  }

  /**
   * 异步加载配置（在插件初始化时调用）
   * @internal
   */
  async _loadConfig(): Promise<void> {
    this._configCache = await this.pluginConfigService.getConfig(this.id);
  }

  onConfigChange(key: string, callback: (value: unknown) => void): () => void {
    // 代理到 PluginConfigService
    const unsubscribe = this.pluginConfigService.onConfigChange(this.id, key, (newValue) => {
      // 更新本地缓存
      if (this._configCache) {
        this._configCache[key] = newValue;
      }
      callback(newValue);
    });
    this.cleanupFns.push(unsubscribe);
    return unsubscribe;
  }

  // ========== 数据存储 ==========

  store<T>(key: string, defaultValue: T): Ref<T> {
    const storeKey = `store:${key}`;
    if (this.stores.has(storeKey)) {
      return this.stores.get(storeKey) as unknown as Ref<T>;
    }

    const ref = new RefImpl<T>(this.db, this.id, storeKey, defaultValue);
    this.stores.set(storeKey, ref as RefImpl<unknown>);

    // 异步加载现有值
    ref.load().catch(() => {
      // 忽略加载错误
    });

    return ref;
  }

  // ========== 数据库访问（v2.0 新增） ==========

  /**
   * 获取 Drizzle 数据库实例
   *
   * 插件可以直接使用 Drizzle API 进行数据库操作
   */
  get db(): PluginDatabase {
    return this._db as unknown as PluginDatabase;
  }

  /**
   * 获取插件专属表
   *
   * 表名自动添加前缀：`plugin_{pluginId}_{tableName}`
   *
   * 如果提供 schema，将自动创建表（如果不存在）
   *
   * @param name - 表名
   * @param schema - 可选的 Zod Schema（用于动态创建表）
   * @returns Drizzle 表实例
   *
   * @example
   * ```typescript
   * // 方式1: 使用预定义的 schema 创建表
   * const BookSchema = z.object({
   *   id: z.number(),
   *   title: z.string(),
   *   author: z.string(),
   * });
   * const bookTable = api.table('book', BookSchema);
   *
   * // 方式2: 获取已创建的表
   * const bookTable = api.table('book');
   * ```
   */
  table(name: string, schema?: z.ZodObject<any>): DrizzleTable {
    const tableKey = `plugin_${this.id}_${name}`;

    // 如果表已缓存，直接返回
    if (this.pluginTables.has(tableKey)) {
      return this.pluginTables.get(tableKey)!;
    }

    // 如果没有提供 schema，抛出错误
    if (!schema) {
      this.log.error(`表 '${tableKey}' 不存在，且未提供 Schema`);
      throw new Error(
        `插件表 '${name}' 不存在。请在首次调用 api.table('${name}') 时提供 Zod Schema：\n` +
          `const ${name}Table = api.table('${name}', ${name}Schema);`,
      );
    }

    // 从 Zod Schema 创建 Drizzle 表
    try {
      const table = createTableFromSchema(tableKey, schema);

      // 缓存表引用
      this.pluginTables.set(tableKey, table);

      this.log.log(`创建插件表: ${tableKey}`);

      // 自动执行数据库迁移
      this.autoMigrateTableAsync(table, tableKey).catch((error) => {
        this.log.error(`自动迁移表 '${tableKey}' 失败`, error);
      });

      return table;
    } catch (error) {
      this.log.error(`创建表 '${tableKey}' 失败`, error);
      throw new Error(
        `无法创建插件表 '${name}'：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 异步执行表迁移（不阻塞表创建）
   * @internal
   */
  private async autoMigrateTableAsync(table: DrizzleTable, tableName: string): Promise<void> {
    try {
      // 动态导入迁移工具
      const { autoMigrateTable } = await import('../utils/drizzle-to-sql.util');

      // 执行迁移
      const success = await autoMigrateTable(this.db, table, tableName);

      if (success) {
        this.log.log(`表 '${tableName}' 自动迁移成功`);
      } else {
        this.log.warn(
          `表 '${tableName}' 自动迁移失败。` +
            `如果表已存在，请忽略此警告。否则请手动运行 'pnpm db:push'。`,
        );
      }
    } catch (error) {
      this.log.error(`表 '${tableName}' 自动迁移时出错`, error);
      throw error;
    }
  }

  /**
   * 获取核心表（只读访问）
   *
   * @param name - 核心表名（如 'articles', 'users', 'categories' 等）
   * @returns Drizzle 表实例
   */
  coreTable(name: string): DrizzleTable {
    // 从 @vanblog/shared/drizzle 导入的所有表
    const coreTables: Record<string, any> = allTables;

    // 尝试查找表
    const table = coreTables[name];
    if (!table) {
      this.log.error(`核心表 '${name}' 不存在`);
      throw new Error(
        `核心表 '${name}' 不存在。可用的核心表：${Object.keys(coreTables).join(', ')}`,
      );
    }

    return table;
  }

  // ========== 依赖注入（v2.0 新增） ==========

  /**
   * 注入服务
   *
   * @param token - 服务 Token（类、字符串或 Symbol）
   * @param pluginId - 可选的插件 ID，用于注入其他插件提供的服务
   * @returns 服务实例
   */
  inject<T>(token: Type<T> | string | symbol, pluginId?: string): T {
    try {
      if (pluginId) {
        // 跨插件服务注入
        if (!this.serviceRegistry) {
          this.log.error('服务注册表未注入，无法进行跨插件服务注入');
          throw new Error('跨插件服务注入功能未初始化');
        }

        // 只支持类 Token 的跨插件注入
        if (typeof token !== 'function') {
          throw new Error('跨插件服务注入只支持类 Token');
        }

        const service = this.serviceRegistry.getService(pluginId, token);

        if (!service) {
          throw new Error(`插件 '${pluginId}' 未提供服务 '${token.name}'`);
        }

        this.log.debug(`跨插件注入: ${pluginId} → ${token.name}`);
        return service;
      }

      // 从 NestJS 容器中获取核心服务
      return this.moduleRef.get(token as Type<T>, { strict: false });
    } catch (error) {
      this.log.error(`注入服务失败: ${String(token)}`, error);
      throw new Error(`无法注入服务 '${String(token)}'。请确保服务已正确注册。`);
    }
  }

  /**
   * 提供服务（供其他插件注入）
   *
   * @param serviceClass - 服务类
   * @param options - 服务选项
   */
  provideService<T>(serviceClass: Type<T>, options?: { scope?: 'singleton' | 'transient' }): void {
    if (!this.serviceRegistry) {
      this.log.error('服务注册表未注入，无法注册服务');
      throw new Error('服务注册功能未初始化');
    }

    const scope = options?.scope || 'singleton';

    try {
      // 创建服务实例
      let instance: T;

      if (scope === 'singleton') {
        // 尝试从 NestJS 容器获取，如果失败则手动创建
        try {
          instance = this.moduleRef.get(serviceClass, { strict: false });
        } catch {
          instance = new serviceClass();
        }
      } else {
        // transient 模式不需要立即创建实例
        instance = null as any;
      }

      // 注册到服务注册表
      this.serviceRegistry.registerService(this.id, serviceClass, instance, scope);
      this.cleanupFns.push(() => this.serviceRegistry.unregisterService(this.id, serviceClass));

      this.log.log(`提供服务: ${serviceClass.name} (${scope})`);
    } catch (error) {
      this.log.error(`提供服务失败: ${serviceClass.name}`, error);
      throw new Error(`无法提供服务 '${serviceClass.name}'`);
    }
  }

  // ========== 声明式资源注册（v2.0 新增） ==========

  /**
   * 注册资源（WordPress 风格）
   *
   * 自动生成：
   * - Drizzle 表（基于 Zod Schema）
   * - ts-rest 契约（类型安全）
   * - CRUD Controller（自动实现）
   *
   * @param name - 资源名称
   * @param options - 资源选项
   */
  registerResource<T extends z.ZodType>(name: string, options: ResourceOptions<T>): void {
    if (!this.httpRegistry) {
      this.log.error('HTTP 注册表未注入，无法注册资源');
      throw new Error('HTTP 注册表服务未初始化，无法使用 registerResource');
    }

    this.log.log(`注册声明式资源: ${name}`);

    try {
      // 1. 创建插件表（会自动迁移）
      const table = this.table(name, options.schema as any);

      // 2. 异步注册 CRUD 端点
      this.registerResourceAsync(name, table, options).catch((error) => {
        this.log.error(`注册资源 '${name}' 失败`, error);
      });

      this.log.log(`资源 '${name}' 注册成功`);
    } catch (error) {
      this.log.error(`注册资源 '${name}' 失败`, error);
      throw new Error(
        `无法注册资源 '${name}'：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 异步注册资源端点
   * @internal
   */
  private async registerResourceAsync<T extends z.ZodType>(
    name: string,
    table: DrizzleTable,
    options: ResourceOptions<T>,
  ): Promise<void> {
    try {
      // 动态导入资源注册工具
      const { registerResource } = await import('../utils/resource-registration.util');

      // 注册资源
      await registerResource(
        {
          pluginId: this.id,
          resourceName: name,
          table,
          schema: options.schema,
          db: this.db,
          hooks: options.hooks,
          httpRegistry: this.httpRegistry,
        },
        options,
      );

      this.log.log(`资源 '${name}' 的 HTTP 端点已注册`);
    } catch (error) {
      this.log.error(`注册资源 '${name}' 的端点失败`, error);
      throw error;
    }
  }

  // ========== 插件间通信（v2.0 新增） ==========

  /**
   * 暴露 API 给其他插件
   *
   * @param apiName - API 名称
   * @param api - API 对象
   */
  exposeAPI<T extends Record<string, any>>(apiName: string, api: T): void {
    this.exposedAPIs.set(apiName, api);

    // 注册到全局插件 API 注册表
    if (!this.pluginAPIRegistry.has(this.id)) {
      this.pluginAPIRegistry.set(this.id, new Map());
    }
    this.pluginAPIRegistry.get(this.id)!.set(apiName, api);

    // Register cleanup
    this.cleanupFns.push(() => {
      const apis = this.pluginAPIRegistry.get(this.id);
      if (apis) {
        apis.delete(apiName);
        if (apis.size === 0) {
          this.pluginAPIRegistry.delete(this.id);
        }
      }
    });

    this.log.log(`暴露 API: ${apiName}`);
  }

  /**
   * 使用其他插件的 API
   *
   * @param pluginId - 插件 ID
   * @param apiName - API 名称
   * @returns API 对象（未找到返回 null）
   */
  useAPI<T>(pluginId: string, apiName: string): T | null {
    const pluginAPIs = this.pluginAPIRegistry.get(pluginId);
    if (!pluginAPIs) {
      this.log.warn(`插件 '${pluginId}' 未暴露任何 API`);
      return null;
    }

    const api = pluginAPIs.get(apiName);
    if (!api) {
      this.log.warn(`插件 '${pluginId}' 未暴露 API '${apiName}'`);
      return null;
    }

    return api as T;
  }

  // ========== Hooks ==========

  filter<T = unknown>(
    nameOrSignal: string | SyncSignal,
    callback: FilterCallback<T>,
    priority: number = 10,
  ): () => void {
    if (typeof nameOrSignal === 'string') {
      // 字符串形式的 hook 名称，转换为 Signal
      // 这需要一个查找机制，暂时通过 signalBus 直接处理
      // 对于向后兼容，我们创建一个临时的 signal 定义
      const signal = {
        id: nameOrSignal,
        schema: { parse: (v: unknown) => v } as unknown as z.ZodType,
        type: 'sync' as const,
      };
      const disconnect = this.signalBus.connect(
        signal,
        (data) => callback(data as T) as T,
        priority,
      );
      this.cleanupFns.push(disconnect);
      return disconnect;
    } else {
      // Signal 对象
      const disconnect = this.signalBus.connect(
        nameOrSignal,
        (data) => callback(data as T) as T,
        priority,
      );
      this.cleanupFns.push(disconnect);
      return disconnect;
    }
  }

  action<T = unknown>(
    nameOrSignal: string | AsyncSignal,
    callback: ActionCallback<T>,
    priority: number = 10,
  ): () => void {
    if (typeof nameOrSignal === 'string') {
      // 字符串形式的 hook 名称
      const signal = {
        id: nameOrSignal,
        schema: { parse: (v: unknown) => v } as unknown as z.ZodType,
        type: 'async' as const,
      };
      const unsubscribe = this.signalBus.subscribe(signal, (data) => callback(data as T), priority);
      this.cleanupFns.push(unsubscribe);
      return unsubscribe;
    } else {
      // Signal 对象
      const unsubscribe = this.signalBus.subscribe(
        nameOrSignal,
        (data) => callback(data as T),
        priority,
      );
      this.cleanupFns.push(unsubscribe);
      return unsubscribe;
    }
  }

  // ========== 公共数据 ==========

  provide(key: string, data: unknown | (() => unknown | Promise<unknown>)): void {
    const provider = async () => {
      const resolvedData =
        typeof data === 'function' ? await (data as () => unknown | Promise<unknown>)() : data;
      return {
        version: this.version,
        data: resolvedData,
      };
    };

    this.registryService.register(key, provider, 10);
    this.cleanupFns.push(() => this.registryService.unregister(key));
  }

  // ========== Shortcode ==========

  shortcode(tag: string, handler: ShortcodeHandler): void {
    const unregister = this.shortcodeService.register(tag, handler, this.id);
    // Store unregister function for cleanup
    this.cleanupFns.push(unregister);
  }

  // ========== 生命周期 ==========

  onActivate(callback: () => void | Promise<void>): void {
    this.activateCallback = callback;
  }

  onDeactivate(callback: () => void | Promise<void>): void {
    this.deactivateCallback = callback;
  }

  // ========== 内部方法 ==========

  /**
   * 执行激活回调
   * @internal
   */
  async _activate(): Promise<void> {
    if (this.activateCallback) {
      await this.activateCallback();
    }
  }

  /**
   * 执行停用回调
   * @internal
   */
  async _deactivate(): Promise<void> {
    if (this.deactivateCallback) {
      await this.deactivateCallback();
    }
  }

  /**
   * 清理所有注册的资源
   * @internal
   */
  cleanup(): void {
    // 清理 signals、shortcodes 和 config listeners (通过 unregister 函数)
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch {
        // 忽略清理错误
      }
    }
    this.cleanupFns.length = 0;

    // 清理 stores
    this.stores.clear();

    // 清理配置缓存
    this._configCache = null;

    // 清理 HTTP 路由
    if (this.httpRegistry && typeof this.httpRegistry.clearPluginRoutes === 'function') {
      try {
        this.httpRegistry.clearPluginRoutes(this.id);
      } catch {
        // ignore
      }
    }
  }
}

// ============================================================
// PluginAPI 工厂服务
// ============================================================

@Injectable()
export class PluginAPIFactory {
  // 全局插件 API 注册表（用于插件间通信）
  private readonly pluginAPIRegistry = new Map<string, Map<string, any>>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly moduleRef: ModuleRef,
    private readonly signalBus: SignalBus,
    private readonly registryService: PluginRegistryService,
    private readonly shortcodeService: ShortcodeService,
    private readonly pluginConfigService: PluginConfigService,
    @Inject('PLUGIN_HTTP_REGISTRY') private readonly httpRegistry?: any, // PluginHttpRegistryService
    @Inject('PLUGIN_SERVICE_REGISTRY') private readonly serviceRegistry?: any, // PluginServiceRegistryService
  ) {}

  /**
   * 创建 PluginAPI 实例
   */
  async createAPI(packageJson: PluginPackageJson, dir: string): Promise<PluginAPIImpl> {
    const metadata = parsePluginMetadata(packageJson, dir);

    // 注册配置 Schema
    this.pluginConfigService.registerSchema(metadata.id, metadata.config);

    const api = new PluginAPIImpl(
      metadata,
      this.db,
      this.moduleRef,
      this.signalBus,
      this.registryService,
      this.shortcodeService,
      this.pluginConfigService,
      this.pluginAPIRegistry,
      this.httpRegistry, // 注入 HTTP 注册表
      this.serviceRegistry, // 注入服务注册表
    );

    // 异步加载配置
    await api._loadConfig();

    return api;
  }

  /**
   * 获取 shortcode 服务
   */
  getShortcodeService(): ShortcodeService {
    return this.shortcodeService;
  }

  /**
   * 获取配置服务
   */
  getConfigService(): PluginConfigService {
    return this.pluginConfigService;
  }
}
