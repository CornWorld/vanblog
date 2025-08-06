import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import { siteMeta } from '../../../database/schema';
import { safeParseJson, dataSchemas } from '../../../shared/zod';

export interface ConfigRegistration<T = unknown> {
  key: string;
  defaultValue?: T;
  validator?: (value: unknown) => boolean;
  description?: string;
}

@Injectable()
export class SettingRegistryService {
  private readonly logger = new Logger(SettingRegistryService.name);
  private readonly registrations = new Map<string, ConfigRegistration>();

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: LibSQLDatabase,
  ) {}

  /**
   * Register a configuration key with optional default value and validator
   */
  registerConfig<T = unknown>(registration: ConfigRegistration<T>): void {
    if (this.registrations.has(registration.key)) {
      this.logger.warn(`Configuration key "${registration.key}" is already registered`);
    }
    this.registrations.set(registration.key, registration);
    this.logger.log(`Registered configuration key: ${registration.key}`);
  }

  /**
   * Get configuration value by key
   */
  async getConfig<T>(key: string): Promise<T | null> {
    const results = await this.db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);

    if (results.length > 0 && results[0].value) {
      try {
        const parsed = safeParseJson(results[0].value, dataSchemas.genericObject);
        return parsed as T;
      } catch (error) {
        this.logger.error(`Failed to parse config value for key "${key}":`, error);
        return null;
      }
    }

    // Check if this key has a default value
    const registration = this.registrations.get(key);
    if (registration?.defaultValue !== undefined) {
      // Save the default value to database
      await this.updateConfig(key, registration.defaultValue);
      return registration.defaultValue as T;
    }

    return null;
  }

  /**
   * Update configuration value
   */
  async updateConfig<T>(key: string, value: T): Promise<T> {
    // Validate if validator exists
    const registration = this.registrations.get(key);
    if (registration?.validator && !registration.validator(value)) {
      throw new Error(`Invalid value for configuration key "${key}"`);
    }

    const existing = await this.db.select().from(siteMeta).where(eq(siteMeta.key, key)).limit(1);

    if (existing.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(value),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(siteMeta.key, key));
    } else {
      await this.db.insert(siteMeta).values({
        key,
        value: JSON.stringify(value),
      });
    }

    this.logger.log(`Updated configuration key: ${key}`);
    return value;
  }

  /**
   * Delete configuration value
   */
  async deleteConfig(key: string): Promise<void> {
    await this.db.delete(siteMeta).where(eq(siteMeta.key, key));
    this.logger.log(`Deleted configuration key: ${key}`);
  }

  /**
   * Get all registered configuration keys
   */
  getRegisteredKeys(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get configuration registration info
   */
  getRegistration(key: string): ConfigRegistration | undefined {
    return this.registrations.get(key);
  }
}
