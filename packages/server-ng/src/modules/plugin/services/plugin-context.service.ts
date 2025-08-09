import { Injectable, Logger, Inject } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, and } from 'drizzle-orm';

import { ConfigService } from '../../../config/config.service';
import { DATABASE_CONNECTION } from '../../../database';
import { pluginData } from '../../../database/schema';
import {
  PluginContext,
  PluginContextFactory as IPluginContextFactory,
  PluginDataStorage,
  PluginConfigReader,
  PluginLogger,
} from '../interfaces/plugin-context.interface';

import type { Database } from '../../../database/connection';

@Injectable()
export class PluginDataStorageService implements PluginDataStorage {
  private readonly logger = new Logger(PluginDataStorageService.name);

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
    } catch (error) {
      this.logger.error(
        `Failed to get plugin data for key '${key}':`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      const now = dayjs().toISOString();

      try {
        // First try to insert new record using LibSQL client directly
        await (
          this.db as Database & {
            $client: { execute: (query: { sql: string; args: unknown[] }) => Promise<unknown> };
          }
        ).$client.execute({
          sql: 'INSERT INTO plugin_data (plugin_id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          args: [this.pluginId, key, stringValue, now, now],
        });
      } catch {
        // If insert fails due to unique constraint, update existing record
        await (
          this.db as Database & {
            $client: { execute: (query: { sql: string; args: unknown[] }) => Promise<unknown> };
          }
        ).$client.execute({
          sql: 'UPDATE plugin_data SET value = ?, updated_at = ? WHERE plugin_id = ? AND key = ?',
          args: [stringValue, now, this.pluginId, key],
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to set plugin data for key '${key}':`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // First check if the key exists
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
    } catch (error) {
      this.logger.error(
        `Failed to delete plugin data for key '${key}':`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ key: pluginData.key })
        .from(pluginData)
        .where(and(eq(pluginData.pluginId, this.pluginId), eq(pluginData.key, key)))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      this.logger.error(
        `Failed to check plugin data existence for key '${key}':`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.db.delete(pluginData).where(eq(pluginData.pluginId, this.pluginId));
    } catch (error) {
      this.logger.error(
        `Failed to clear plugin data:`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const result = await this.db
        .select({ key: pluginData.key })
        .from(pluginData)
        .where(eq(pluginData.pluginId, this.pluginId));

      return result.map((row) => row.key);
    } catch (error) {
      this.logger.error(
        `Failed to get plugin data keys:`,
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
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
    const configKey = this.getPluginConfigKey(key);
    const value = this.configService.get(configKey, defaultValue);
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
    return value !== undefined;
  }

  private getPluginConfigKey(key: string): string {
    return `PLUGIN_${this.pluginId.toUpperCase()}_${key.toUpperCase()}`;
  }
}

export class PluginLoggerService implements PluginLogger {
  private readonly logger: Logger;

  constructor(pluginId: string) {
    this.logger = new Logger(`Plugin:${pluginId}`);
  }

  log(message: string, context?: string): void {
    this.logger.log(message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, trace, context);
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, context);
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, context);
  }
}

export class PluginContextService implements PluginContext {
  constructor(
    public readonly pluginId: string,
    public readonly logger: PluginLogger,
    public readonly config: PluginConfigReader,
    public readonly data: PluginDataStorage,
  ) {}
}

@Injectable()
export class PluginContextFactory implements IPluginContextFactory {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {}

  createContext(pluginId: string): PluginContext {
    const logger = new PluginLoggerService(pluginId);
    const config = new PluginConfigReaderService(this.configService, pluginId);
    const data = new PluginDataStorageService(this.db, pluginId);

    return new PluginContextService(pluginId, logger, config, data);
  }
}
