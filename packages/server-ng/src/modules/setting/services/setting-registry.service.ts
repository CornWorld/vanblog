import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { siteMeta } from '@vanblog/shared/drizzle';
import { eq, sql } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../../database';

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

  // simple in-memory per-key throttle counter (warn-only, never blocks)
  private readonly keyUpdateWindowMs = 1000; // 1s window
  private readonly keyUpdateWarnThreshold = 10; // warn if more than 10 updates per window
  private readonly keyUpdateStats = new Map<string, { count: number; windowStart: number }>();

  // payload size guard (hard limit, throws)
  private static readonly MAX_JSON_LENGTH = 256 * 1024; // 256KB

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
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

    if (results.length > 0 && results[0].value != null) {
      // No manual JSON.parse() - let Schema handle it
      return results[0].value as T;
    }

    // Check if this key has a default value
    const registration = this.registrations.get(key);
    if (registration?.defaultValue !== undefined) {
      // Save the default value to database (concurrently safe upsert)
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
      throw new BadRequestException(`Invalid value for configuration key "${key}"`);
    }

    // Edge validation & logging (never break userspace)
    const json = JSON.stringify(value);

    // Oversized payload guard (hard error)
    if (json.length > SettingRegistryService.MAX_JSON_LENGTH) {
      throw new BadRequestException(
        `Config value too large for key "${key}" (${String(json.length)} > ${String(SettingRegistryService.MAX_JSON_LENGTH)})`,
      );
    }

    // Warn on empty object payloads (but still proceed to keep behavior compatible)
    if (SettingRegistryService.isPlainObject(value) && Object.keys(value).length === 0) {
      this.logger.warn(`Empty object provided for key "${key}". Proceeding with upsert.`);
    }

    // Per-key throttle (warn only)
    const now = Date.now();
    const stat = this.keyUpdateStats.get(key) ?? { count: 0, windowStart: now };
    if (now - stat.windowStart > this.keyUpdateWindowMs) {
      stat.count = 0;
      stat.windowStart = now;
    }
    stat.count += 1;
    this.keyUpdateStats.set(key, stat);
    if (stat.count > this.keyUpdateWarnThreshold) {
      this.logger.warn(
        `High-frequency updates for key "${key}" within ${String(this.keyUpdateWindowMs)}ms: ${String(stat.count)} times`,
      );
    }

    // Single-statement upsert based on unique key to ensure idempotency under concurrency
    await this.db
      .insert(siteMeta)
      .values({
        key,
        value: json,
      })
      .onConflictDoUpdate({
        target: siteMeta.key,
        set: {
          value: json,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

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

  private static isPlainObject(input: unknown): input is Record<string, unknown> {
    return input !== null && typeof input === 'object' && !Array.isArray(input);
  }
}
