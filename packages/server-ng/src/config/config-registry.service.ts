import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export interface ConfigFieldDefinition {
  key: string;
  module: string;
  envKey?: string;
  schema?: z.ZodType;
  defaultValue?: unknown;
  required?: boolean;
  customValidator?: (value: unknown) => string | null;
  onError?: 'throw' | 'warn' | 'disable' | 'default';
}

export interface ConfigValidationError {
  key: string;
  module: string;
  error: string;
  action: 'throw' | 'warn' | 'disable' | 'default';
}

@Injectable()
export class ConfigRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ConfigRegistryService.name);
  private readonly fields = new Map<string, ConfigFieldDefinition>();
  private readonly cache = new Map<string, unknown>();
  private readonly disabledModules = new Set<string>();
  private initialized = false;

  constructor(private readonly nestConfigService: ConfigService) {}

  onModuleInit(): void {
    if (this.initialized) {
      return;
    }

    this.logger.log('Initializing configuration registry...');
    this.validateAndCache();
    this.initialized = true;
    this.logger.log('Configuration registry initialized successfully');
  }

  /**
   * Register a configuration field
   */
  register(field: ConfigFieldDefinition): void {
    if (this.initialized) {
      throw new Error('Cannot register fields after initialization');
    }
    this.fields.set(field.key, field);
  }

  /**
   * Register multiple fields at once
   */
  registerBatch(fields: ConfigFieldDefinition[]): void {
    for (const field of fields) {
      this.register(field);
    }
  }

  /**
   * Check if a module is disabled due to configuration errors
   */
  isModuleDisabled(moduleName: string): boolean {
    return this.disabledModules.has(moduleName);
  }

  /**
   * Get configuration value by key
   */
  get(key: string): unknown {
    if (!this.initialized) {
      throw new Error('ConfigRegistryService not initialized. Call onModuleInit() first.');
    }

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const field = this.fields.get(key);
    if (!field) {
      this.logger.warn(`Configuration field '${key}' not registered`);
      return undefined;
    }

    // Get value from environment or config
    const value = this.getValue(field);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Get configuration value or return default
   */
  getOrDefault<T>(key: string, fallback: T): T {
    if (!this.initialized) {
      throw new Error('ConfigRegistryService not initialized. Call onModuleInit() first.');
    }

    const field = this.fields.get(key);
    if (!field) {
      return fallback;
    }

    // Check if we have an actual config value (not default)
    let actualValue: unknown;

    // Try environment variable first
    if (field.envKey) {
      actualValue = this.getConfigValue(field.envKey);
      if (actualValue !== undefined) {
        return this.parseValue(actualValue, field.schema) as T;
      }
    }

    // Try nested config key
    actualValue = this.getConfigValue(field.key);
    if (actualValue !== undefined) {
      return this.parseValue(actualValue, field.schema) as T;
    }

    // No actual config value found, return fallback
    return fallback;
  }

  /**
   * Get all registered field keys
   */
  getRegisteredKeys(): string[] {
    return Array.from(this.fields.keys());
  }

  /**
   * Get all disabled modules
   */
  getDisabledModules(): string[] {
    return Array.from(this.disabledModules);
  }

  private validateAndCache(): void {
    const errors: ConfigValidationError[] = [];

    for (const [key, field] of this.fields) {
      try {
        const value = this.getValue(field);

        // Validate with Zod schema if provided
        if (field.schema && value !== undefined) {
          const result = field.schema.safeParse(value);
          if (!result.success) {
            errors.push({
              key,
              module: field.module,
              error: result.error.message,
              action: field.onError ?? 'warn',
            });
            continue;
          }
        }

        // Custom validation
        if (field.customValidator && value !== undefined) {
          const validationError = field.customValidator(value);
          if (validationError) {
            errors.push({
              key,
              module: field.module,
              error: validationError,
              action: field.onError ?? 'warn',
            });
            continue;
          }
        }

        // Cache valid value
        this.cache.set(key, value);
      } catch (error) {
        errors.push({
          key,
          module: field.module,
          error: error instanceof Error ? error.message : String(error),
          action: field.onError ?? 'warn',
        });
      }
    }

    // Process validation errors
    if (errors.length > 0) {
      this.processValidationErrors(errors);
    }

    if (this.disabledModules.size > 0) {
      this.logger.warn(
        `Disabled modules due to config errors: ${Array.from(this.disabledModules).join(', ')}`,
      );
    }
  }

  private getValue(field: ConfigFieldDefinition): unknown {
    // Try environment variable first
    if (field.envKey) {
      const envValue = this.getConfigValue(field.envKey);
      if (envValue !== undefined) {
        return this.parseValue(envValue, field.schema);
      }
    }

    // Try nested config key
    const configValue = this.getConfigValue(field.key);
    if (configValue !== undefined) {
      return this.parseValue(configValue, field.schema);
    }

    // Use default value
    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    // Required field without value
    if (field.required) {
      throw new Error(`Required configuration field '${field.key}' is missing`);
    }

    return undefined;
  }

  private parseValue(value: unknown, schema?: z.ZodType): unknown {
    // Handle string to number conversion
    if (schema instanceof z.ZodNumber && typeof value === 'string') {
      const num = Number(value);
      return Number.isNaN(num) ? value : num;
    }

    // Handle string to boolean conversion
    if (schema instanceof z.ZodBoolean && typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    return value;
  }

  private getConfigValue(key: string): unknown {
    return this.nestConfigService.get(key);
  }

  private processValidationErrors(errors: ConfigValidationError[]): void {
    const moduleErrors = new Map<string, ConfigValidationError[]>();

    // Group errors by module
    for (const error of errors) {
      if (!moduleErrors.has(error.module)) {
        moduleErrors.set(error.module, []);
      }
      const moduleErrorList = moduleErrors.get(error.module);
      if (moduleErrorList) {
        moduleErrorList.push(error);
      }
    }

    // Process each module's errors
    for (const [moduleName, moduleErrorList] of moduleErrors) {
      const throwErrors = moduleErrorList.filter((e) => e.action === 'throw');
      const warnErrors = moduleErrorList.filter((e) => e.action === 'warn');
      const disableErrors = moduleErrorList.filter((e) => e.action === 'disable');
      const defaultErrors = moduleErrorList.filter((e) => e.action === 'default');

      // Handle throw errors - these stop the application
      if (throwErrors.length > 0) {
        const errorMessages = throwErrors.map((e) => `${e.key}: ${e.error}`).join('; ');
        throw new Error(
          `Critical configuration errors in module '${moduleName}': ${errorMessages}`,
        );
      }

      // Handle disable errors - disable the entire module
      if (disableErrors.length > 0) {
        this.disabledModules.add(moduleName);
        const errorMessages = disableErrors.map((e) => `${e.key}: ${e.error}`).join('; ');
        this.logger.error(
          `Module '${moduleName}' disabled due to configuration errors: ${errorMessages}`,
        );
      }

      // Handle warn errors - log warnings but continue
      if (warnErrors.length > 0) {
        for (const e of warnErrors) {
          this.logger.warn(
            `Configuration warning in module '${moduleName}' for ${e.key}: ${e.error}`,
          );
        }
      }

      // Handle default errors - use default values and log
      if (defaultErrors.length > 0) {
        for (const e of defaultErrors) {
          const field = this.fields.get(e.key);
          if (field?.defaultValue !== undefined) {
            this.cache.set(e.key, field.defaultValue);
            this.logger.warn(`Using default value for ${e.key} due to error: ${e.error}`);
          }
        }
      }
    }
  }
}
