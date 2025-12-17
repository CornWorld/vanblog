import { Inject, Injectable, Logger } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { pluginData } from '@vanblog/shared/drizzle';
import { and, eq } from 'drizzle-orm';

import { ConfigService } from '../../../config/config.service';
import { type Database } from '../../../database/connection';
import { DATABASE_CONNECTION } from '../../../database/constants';
import { withPluginPrefix } from '../utils/prefix.util';

import { PluginRegistryService } from './plugin-registry.service';
import { SignalBus } from './signal.service';

import type {
  PluginConfigReader,
  PluginContext,
  PluginContextFactory as IPluginContextFactory,
  PluginDataStorage,
  PluginSignalAccessor,
  PluginRegistryAccessor,
} from '../interfaces/plugin-context.interface';

@Injectable()
export class PluginDataStorageService implements PluginDataStorage {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly pluginId: string,
  ) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const result = await this.db
        .select({ value: pluginData.value })
        .from(pluginData)
        .where(and(eq(pluginData.pluginId, this.pluginId), eq(pluginData.key, key)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0].value as T;
    } catch (_error) {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const stringValue = JSON.stringify(value);
    const now = dayjs().format();

    // Single-statement UPSERT to avoid insert-then-update race and extra roundtrip
    await (
      this.db as Database & {
        $client: { execute: (query: { sql: string; args: unknown[] }) => Promise<unknown> };
      }
    ).$client.execute({
      sql: `INSERT INTO plugin_data (plugin_id, key, value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(plugin_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [this.pluginId, key, stringValue, now, now],
    });
  }

  async delete(key: string): Promise<boolean> {
    const existing = await this.db
      .select()
      .from(pluginData)
      .where(and(eq(pluginData.pluginId, this.pluginId), eq(pluginData.key, key)))
      .limit(1);

    if (existing.length === 0) {
      return false;
    }

    await this.db
      .delete(pluginData)
      .where(and(eq(pluginData.pluginId, this.pluginId), eq(pluginData.key, key)));

    return true;
  }

  async has(key: string): Promise<boolean> {
    const result = await this.db
      .select({ key: pluginData.key })
      .from(pluginData)
      .where(and(eq(pluginData.pluginId, this.pluginId), eq(pluginData.key, key)))
      .limit(1);
    return result.length > 0;
  }

  async clear(): Promise<void> {
    await this.db.delete(pluginData).where(eq(pluginData.pluginId, this.pluginId));
  }

  async keys(): Promise<string[]> {
    const result = await this.db
      .select({ key: pluginData.key })
      .from(pluginData)
      .where(eq(pluginData.pluginId, this.pluginId));

    return result.map((row) => row.key);
  }
}

export class PluginConfigReaderService implements PluginConfigReader {
  constructor(
    private readonly configService: ConfigService,
    private readonly pluginId: string,
  ) {}

  get(key: string): unknown;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    const primaryKey = this.getPluginConfigKey(key);
    let value = this.configService.get(primaryKey);

    // Fallback: allow env-style underscore variant for plugin id or key
    if (value === undefined) {
      const underscoreKey = primaryKey.replace(/-/g, '_');
      if (underscoreKey !== primaryKey) {
        value = this.configService.get(underscoreKey);
      }
    }

    if (value === undefined) return defaultValue;

    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }
    return value as T;
  }

  getOrThrow(key: string): unknown {
    const value = this.get(key);
    if (value === undefined) {
      throw new Error(`Plugin configuration key '${key}' is required but not found`);
    }
    return value;
  }

  has(key: string): boolean {
    const configKey = this.getPluginConfigKey(key);
    const value = this.configService.get(configKey);
    if (value !== undefined) return true;
    // Also respect underscore fallback
    const underscoreKey = configKey.replace(/-/g, '_');
    return this.configService.get(underscoreKey) !== undefined;
  }

  private getPluginConfigKey(key: string): string {
    return `PLUGIN_${this.pluginId.toUpperCase()}_${key.toUpperCase()}`;
  }
}

export class PluginContextService implements PluginContext {
  private readonly cleanupFns: (() => void)[] = [];

  public readonly logger: Logger;

  constructor(
    public readonly pluginId: string,
    public readonly config: PluginConfigReader,
    public readonly data: PluginDataStorage,
    private readonly pluginRegistryService: PluginRegistryService,
    private readonly signalBus: SignalBus,
  ) {
    this.logger = new Logger(withPluginPrefix(pluginId));
  }

  get registry(): PluginRegistryAccessor {
    return {
      register: (name, provider, priority) => {
        this.pluginRegistryService.register(name, provider, priority);
        this.cleanupFns.push(() => this.pluginRegistryService.unregister(name));
      },
      unregister: (name) => {
        return this.pluginRegistryService.unregister(name);
      },
    };
  }

  /**
   * Signal API
   *
   * 提供类型安全的 Signal 注册接口
   */
  get signals(): PluginSignalAccessor {
    return {
      connect: (signal, receiver, priority) => {
        const disconnect = this.signalBus.connect(signal, receiver, priority);
        this.cleanupFns.push(disconnect);
        return disconnect;
      },
      subscribe: (signal, receiver, priority) => {
        const unsubscribe = this.signalBus.subscribe(signal, receiver, priority);
        this.cleanupFns.push(unsubscribe);
        return unsubscribe;
      },
    };
  }

  /**
   * Internal: Cleanup all registrations made by this context
   */
  cleanupRegistrations(): void {
    // Execute all cleanup functions
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch {
        // ignore errors during cleanup
      }
    }
    this.cleanupFns.length = 0;
  }
}

@Injectable()
export class PluginContextFactory implements IPluginContextFactory {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly pluginRegistryService: PluginRegistryService,
    private readonly signalBus: SignalBus,
  ) {}

  createContext(pluginId: string): PluginContext {
    const config = new PluginConfigReaderService(this.configService, pluginId);
    const data = new PluginDataStorageService(this.db, pluginId);

    return new PluginContextService(
      pluginId,
      config,
      data,
      this.pluginRegistryService,
      this.signalBus,
    );
  }
}
