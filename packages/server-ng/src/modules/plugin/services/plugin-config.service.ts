/**
 * @file plugin-config.service.ts
 *
 * 插件配置服务
 *
 * 管理插件配置的读取、存储和变更通知
 *
 * ## 配置优先级
 *
 * 1. 数据库存储（最高优先级）
 * 2. 环境变量（PLUGIN_{PLUGIN_ID}_{KEY}）
 * 3. package.json 默认值（最低优先级）
 *
 * ## 使用示例
 *
 * ```typescript
 * // 获取配置
 * const config = await configService.getConfig('my-plugin');
 *
 * // 更新配置
 * await configService.setConfig('my-plugin', 'enableFeature', true);
 *
 * // 监听配置变更
 * configService.onConfigChange('my-plugin', 'enableFeature', (newValue) => {
 *   console.log('Config changed:', newValue);
 * });
 * ```
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { pluginData } from '@vanblog/shared/drizzle';
import { and, eq, like } from 'drizzle-orm';
import { z } from 'zod';

import { ConfigService } from '../../../config/config.service';
import { type Database } from '../../../database/connection';
import { DATABASE_CONNECTION } from '../../../database/constants';

import type { PluginConfig, PluginConfigField } from '@vanblog/shared/plugin';

/**
 * 配置存储的 key 前缀
 */
const CONFIG_KEY_PREFIX = 'config:';

/**
 * 配置变更监听器
 */
type ConfigChangeListener = (value: unknown, oldValue: unknown) => void;

/**
 * 插件配置服务
 */
@Injectable()
export class PluginConfigService {
  private readonly logger = new Logger(PluginConfigService.name);

  /**
   * 配置变更监听器
   * Map<pluginId, Map<key, Set<listener>>>
   */
  private readonly listeners = new Map<string, Map<string, Set<ConfigChangeListener>>>();

  /**
   * 配置缓存
   * Map<pluginId, Record<string, unknown>>
   */
  private readonly cache = new Map<string, Record<string, unknown>>();

  /**
   * 插件配置 Schema 缓存
   * Map<pluginId, PluginConfig>
   */
  private readonly schemas = new Map<string, PluginConfig>();

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 注册插件配置 Schema
   *
   * 在插件加载时调用，用于后续配置验证和默认值获取
   */
  registerSchema(pluginId: string, schema: PluginConfig | undefined): void {
    if (schema) {
      this.schemas.set(pluginId, schema);
      this.logger.debug(`Registered config schema for plugin "${pluginId}"`);
    }
  }

  /**
   * 获取插件配置 Schema
   */
  getSchema(pluginId: string): PluginConfig | undefined {
    return this.schemas.get(pluginId);
  }

  /**
   * 获取插件的完整配置（合并后的）
   *
   * 优先级：DB > 环境变量 > 默认值
   */
  async getConfig(pluginId: string): Promise<Record<string, unknown>> {
    // 检查缓存
    if (this.cache.has(pluginId)) {
      return { ...this.cache.get(pluginId)! };
    }

    const result: Record<string, unknown> = {};
    const schema = this.schemas.get(pluginId);

    // 1. 从 schema 获取默认值
    if (schema) {
      for (const [key, field] of Object.entries(schema)) {
        if ('default' in field && field.default !== undefined) {
          result[key] = field.default;
        }
      }
    }

    // 2. 从环境变量覆盖
    if (schema) {
      for (const key of Object.keys(schema)) {
        const envKey = this.getEnvKey(pluginId, key);
        const envValue = this.configService.get(envKey);
        if (envValue !== undefined) {
          result[key] = this.parseEnvValue(envValue as string, schema[key]);
        }
      }
    }

    // 3. 从数据库覆盖
    const dbConfig = await this.loadFromDatabase(pluginId);
    Object.assign(result, dbConfig);

    // 缓存结果
    this.cache.set(pluginId, result);

    return { ...result };
  }

  /**
   * 获取单个配置值
   */
  async getValue<T = unknown>(pluginId: string, key: string, defaultValue?: T): Promise<T> {
    const config = await this.getConfig(pluginId);
    return (config[key] as T) ?? (defaultValue as T);
  }

  /**
   * 设置配置值
   *
   * @param pluginId - 插件 ID
   * @param key - 配置键
   * @param value - 配置值
   * @returns 是否成功
   */
  async setConfig(pluginId: string, key: string, value: unknown): Promise<boolean> {
    const schema = this.schemas.get(pluginId);
    const field = schema?.[key];

    // 验证配置值
    if (field && !this.validateValue(value, field)) {
      this.logger.warn(`Invalid config value for ${pluginId}.${key}: ${JSON.stringify(value)}`);
      return false;
    }

    // 获取旧值
    const oldConfig = await this.getConfig(pluginId);
    const oldValue = oldConfig[key];

    // 保存到数据库
    await this.saveToDatabase(pluginId, key, value);

    // 更新缓存
    if (this.cache.has(pluginId)) {
      this.cache.get(pluginId)![key] = value;
    }

    // 触发变更通知
    if (oldValue !== value) {
      this.notifyChange(pluginId, key, value, oldValue);
    }

    return true;
  }

  /**
   * 批量设置配置
   */
  async setConfigs(pluginId: string, configs: Record<string, unknown>): Promise<boolean> {
    const results = await Promise.all(
      Object.entries(configs).map(([key, value]) => this.setConfig(pluginId, key, value)),
    );
    return results.every(Boolean);
  }

  /**
   * 删除配置值（恢复为默认值）
   */
  async deleteConfig(pluginId: string, key: string): Promise<void> {
    const storeKey = `${CONFIG_KEY_PREFIX}${key}`;

    await this.db
      .delete(pluginData)
      .where(and(eq(pluginData.pluginId, pluginId), eq(pluginData.key, storeKey)));

    // 清除缓存
    this.cache.delete(pluginId);

    // 获取新值（默认值）并通知
    const config = await this.getConfig(pluginId);
    this.notifyChange(pluginId, key, config[key], undefined);
  }

  /**
   * 清除插件的所有配置
   */
  async clearConfig(pluginId: string): Promise<void> {
    await this.db
      .delete(pluginData)
      .where(and(eq(pluginData.pluginId, pluginId), like(pluginData.key, `${CONFIG_KEY_PREFIX}%`)));

    // 清除缓存
    this.cache.delete(pluginId);
  }

  /**
   * 监听配置变更
   *
   * @param pluginId - 插件 ID
   * @param key - 配置键
   * @param listener - 监听器
   * @returns 取消监听函数
   */
  onConfigChange(pluginId: string, key: string, listener: ConfigChangeListener): () => void {
    if (!this.listeners.has(pluginId)) {
      this.listeners.set(pluginId, new Map());
    }
    const pluginListeners = this.listeners.get(pluginId)!;

    if (!pluginListeners.has(key)) {
      pluginListeners.set(key, new Set());
    }
    pluginListeners.get(key)!.add(listener);

    return () => {
      pluginListeners.get(key)?.delete(listener);
    };
  }

  /**
   * 清除缓存
   */
  clearCache(pluginId?: string): void {
    if (pluginId) {
      this.cache.delete(pluginId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 注销插件（清理监听器和缓存）
   */
  unregisterPlugin(pluginId: string): void {
    this.listeners.delete(pluginId);
    this.cache.delete(pluginId);
    this.schemas.delete(pluginId);
  }

  // ========== 私有方法 ==========

  /**
   * 从数据库加载配置
   *
   * jsonb() 列类型已自动处理 JSON 反序列化
   */
  private async loadFromDatabase(pluginId: string): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    const rows = await this.db
      .select()
      .from(pluginData)
      .where(and(eq(pluginData.pluginId, pluginId), like(pluginData.key, `${CONFIG_KEY_PREFIX}%`)));

    // Direct parsing - jsonb() column already deserialized
    const UnknownValueSchema = z.unknown();

    for (const row of rows) {
      const key = row.key.slice(CONFIG_KEY_PREFIX.length);
      if (row.value !== null) {
        // Direct validation - no manual JSON parsing needed
        const parsed = UnknownValueSchema.safeParse(row.value);
        result[key] = parsed.success ? parsed.data : row.value;
      }
    }

    return result;
  }

  /**
   * 保存配置到数据库 - jsonb() column handles JSON serialization
   */
  private async saveToDatabase(pluginId: string, key: string, value: unknown): Promise<void> {
    const storeKey = `${CONFIG_KEY_PREFIX}${key}`;
    const now = dayjs().format();

    await (
      this.db as Database & {
        $client: {
          execute: (query: { sql: string; args: unknown[] }) => Promise<unknown>;
        };
      }
    ).$client.execute({
      sql: `INSERT INTO plugin_data (plugin_id, key, value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(plugin_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [pluginId, storeKey, JSON.stringify(value), now, now],
    });
  }

  /**
   * 生成环境变量 key
   */
  private getEnvKey(pluginId: string, key: string): string {
    const normalizedPluginId = pluginId.toUpperCase().replace(/-/g, '_');
    // 先转换 camelCase 为 snake_case，再转大写
    const normalizedKey = key.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    return `PLUGIN_${normalizedPluginId}_${normalizedKey}`;
  }

  /**
   * 解析环境变量值
   *
   * 使用 Zod Schema 类型安全地解析环境变量
   */
  private parseEnvValue(value: string, field: PluginConfigField): unknown {
    switch (field.type) {
      case 'boolean':
        return value === 'true' || value === '1';
      case 'number':
        return Number(value);
      case 'array': {
        // Use Zod array schema for safe parsing
        const ArraySchema = z.array(z.unknown());
        const parsed = ArraySchema.safeParse(
          typeof value === 'string'
            ? (() => {
                try {
                  return JSON.parse(value);
                } catch {
                  return value;
                }
              })()
            : value,
        );
        return parsed.success ? parsed.data : value;
      }
      case 'object': {
        // Use Zod object schema for safe parsing
        const ObjectSchema = z.record(z.string(), z.unknown());
        const parsed = ObjectSchema.safeParse(
          typeof value === 'string'
            ? (() => {
                try {
                  return JSON.parse(value);
                } catch {
                  return value;
                }
              })()
            : value,
        );
        return parsed.success ? parsed.data : value;
      }
      default:
        return value;
    }
  }

  /**
   * 验证配置值
   */
  private validateValue(value: unknown, field: PluginConfigField): boolean {
    switch (field.type) {
      case 'boolean':
        return typeof value === 'boolean';
      case 'number': {
        if (typeof value !== 'number') return false;
        if (field.minimum !== undefined && value < field.minimum) return false;
        if (field.maximum !== undefined && value > field.maximum) return false;
        return true;
      }
      case 'string': {
        if (typeof value !== 'string') return false;
        if (field.enum && !field.enum.includes(value)) return false;
        return true;
      }
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 通知配置变更
   */
  private notifyChange(pluginId: string, key: string, newValue: unknown, oldValue: unknown): void {
    const pluginListeners = this.listeners.get(pluginId);
    if (!pluginListeners) return;

    const keyListeners = pluginListeners.get(key);
    if (!keyListeners) return;

    for (const listener of keyListeners) {
      try {
        listener(newValue, oldValue);
      } catch (error) {
        this.logger.error(
          `Error in config change listener for ${pluginId}.${key}: ${String(error)}`,
        );
      }
    }
  }
}
