import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { ConfigService } from './config.service';

import type { AllConfig } from './config.interface';

// Configuration validation schemas
const AppConfigSchema = z.object({
  port: z.number().min(1).max(65535),
  nodeEnv: z.enum(['development', 'production', 'test']),
  apiPrefix: z.string().min(1),
  apiVersion: z.string().min(1),
  locale: z.string().min(2),
  isProduction: z.boolean(),
  isDevelopment: z.boolean(),
});

const DatabaseConfigSchema = z.object({
  driver: z.enum(['local', 'turso', 'd1']),
  url: z.string().min(1),
  authToken: z.string().optional(),
  filePath: z.string().optional(),
  accountId: z.string().optional(),
  databaseId: z.string().optional(),
  d1Token: z.string().optional(),
});

const JwtConfigSchema = z.object({
  secret: z.string().min(32, 'JWT secret must be at least 32 characters'),
  expiresIn: z.string().min(1),
  refreshSecret: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  refreshExpiresIn: z.string().min(1),
});

const CorsConfigSchema = z.object({
  origin: z.union([z.string(), z.array(z.string())]),
  credentials: z.boolean(),
});

const UploadConfigSchema = z.object({
  maxFileSize: z.number().min(1024), // At least 1KB
  destination: z.string().min(1),
});

const StaticConfigSchema = z.object({
  path: z.string().min(1),
});

const LogConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'verbose']),
  dir: z.string().min(1),
});

const WalineConfigSchema = z.object({
  db: z.string().min(1),
});

const RuntimeConfigSchema = z.object({
  demoMode: z.boolean(),
  codeRunnerPath: z.string().min(1),
  pluginRunnerPath: z.string().min(1),
});

const AllConfigSchema = z.object({
  app: AppConfigSchema,
  database: DatabaseConfigSchema,
  jwt: JwtConfigSchema,
  cors: CorsConfigSchema,
  upload: UploadConfigSchema,
  static: StaticConfigSchema,
  log: LogConfigSchema,
  waline: WalineConfigSchema,
  runtime: RuntimeConfigSchema,
});

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class ConfigValidationService {
  private readonly logger = new Logger(ConfigValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate all configuration values
   */
  validateAll(): ConfigValidationResult {
    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      const config = this.configService.all;
      AllConfigSchema.parse(config);

      // Additional custom validations
      this.validateSecuritySettings(config, result);
      this.validatePathSettings(config, result);
      this.validateDatabaseSettings(config, result);

      // Set isValid to false if there are any errors
      if (result.errors.length > 0) {
        result.isValid = false;
      }

      this.logger.log('Configuration validation completed successfully');
    } catch (error) {
      result.isValid = false;
      if (error instanceof z.ZodError) {
        result.errors.push(...error.issues.map((err) => `${err.path.join('.')}: ${err.message}`));
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Unexpected validation error: ${errorMessage}`);
      }
      this.logger.error('Configuration validation failed', error);
    }

    return result;
  }

  /**
   * Validate specific configuration section
   */
  validateSection<T>(sectionName: keyof AllConfig, schema: z.ZodType<T>): ConfigValidationResult {
    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      const config = this.configService.all;
      const section = config[sectionName];
      schema.parse(section);
      this.logger.log(`Configuration section '${sectionName}' validation passed`);
    } catch (error) {
      result.isValid = false;
      if (error instanceof z.ZodError) {
        result.errors.push(
          ...error.issues.map((err) => `${sectionName}.${err.path.join('.')}: ${err.message}`),
        );
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Unexpected validation error in ${sectionName}: ${errorMessage}`);
      }
      this.logger.error(`Configuration section '${sectionName}' validation failed`, error);
    }

    return result;
  }

  /**
   * Validate security-related settings
   */
  private validateSecuritySettings(config: AllConfig, result: ConfigValidationResult): void {
    // Check JWT secrets strength - CRITICAL SECURITY ISSUE
    const defaultSecrets = [
      'your-secret-key-that-is-long-enough-for-validation',
      'your-secret-key',
      'your-refresh-secret-that-is-long-enough-too',
      'your-refresh-secret',
      'secret',
      'jwt-secret',
    ];

    if (defaultSecrets.includes(config.jwt.secret)) {
      if (config.app.isProduction) {
        result.errors.push('CRITICAL: JWT secret is using default/weak value in production');
      } else {
        result.warnings.push('JWT secret is using default value, please change it in production');
      }
    }

    if (defaultSecrets.includes(config.jwt.refreshSecret)) {
      if (config.app.isProduction) {
        result.errors.push(
          'CRITICAL: JWT refresh secret is using default/weak value in production',
        );
      } else {
        result.warnings.push(
          'JWT refresh secret is using default value, please change it in production',
        );
      }
    }

    // Validate JWT secret strength
    if (config.jwt.secret.length < 32) {
      result.errors.push('JWT secret must be at least 32 characters long');
    }

    if (config.jwt.refreshSecret.length < 32) {
      result.errors.push('JWT refresh secret must be at least 32 characters long');
    }

    // Check for weak patterns in JWT secrets
    const weakPatterns = [/^(.)\1+$/, /^(012|123|abc|password|admin)/i, /^[a-z]+$/i, /^\d+$/];

    for (const pattern of weakPatterns) {
      if (pattern.test(config.jwt.secret)) {
        result.warnings.push(
          'JWT secret appears to use a weak pattern, consider using a stronger random key',
        );
        break;
      }
    }

    // Check CORS settings in production - SECURITY CRITICAL
    if (config.app.isProduction && config.cors.origin === '*') {
      result.errors.push(
        'CRITICAL: CORS origin is set to "*" in production, this is a security vulnerability',
      );
    }

    // 使用新的 CORS 验证函数
    const corsErrors = this.validateCorsOriginSecurity(config.cors.origin, config.app.isProduction);
    result.errors.push(...corsErrors.filter((error) => error.includes('CRITICAL')));
    result.warnings.push(...corsErrors.filter((error) => !error.includes('CRITICAL')));

    // Check upload file size limits
    const maxSizeMB = config.upload.maxFileSize / (1024 * 1024);
    if (maxSizeMB > 100) {
      result.warnings.push(
        `Upload max file size is ${maxSizeMB.toFixed(1)}MB, consider if this is appropriate`,
      );
    }
  }

  /**
   * 验证 CORS 源配置的安全性
   */
  private validateCorsOriginSecurity(origin: string | string[], isProduction: boolean): string[] {
    const errors: string[] = [];

    if (isProduction && origin === '*') {
      errors.push('CRITICAL: CORS origin cannot be "*" in production environment');
      return errors; // 早期返回，避免重复错误
    }

    const origins = Array.isArray(origin) ? origin : [origin];

    for (const singleOrigin of origins) {
      if (singleOrigin === '*') {
        if (isProduction) {
          errors.push('CRITICAL: Wildcard CORS origin is not allowed in production');
        }
        continue;
      }

      try {
        new URL(singleOrigin);
      } catch {
        errors.push(`CORS origin appears to be malformed URL: ${singleOrigin}`);
      }

      // 检查是否使用 HTTP 在生产环境
      if (isProduction && singleOrigin.startsWith('http://')) {
        errors.push(`HTTP origin not recommended in production: ${singleOrigin}`);
      }
    }

    return errors;
  }

  /**
   * Validate path-related settings
   */
  private validatePathSettings(config: AllConfig, result: ConfigValidationResult): void {
    const paths = [
      { name: 'upload.destination', path: config.upload.destination },
      { name: 'static.path', path: config.static.path },
      { name: 'log.dir', path: config.log.dir },
      { name: 'runtime.codeRunnerPath', path: config.runtime.codeRunnerPath },
      { name: 'runtime.pluginRunnerPath', path: config.runtime.pluginRunnerPath },
    ];

    for (const { name, path } of paths) {
      if (path.includes('..')) {
        result.warnings.push(`Path ${name} contains ".." which might be a security risk`);
      }
      if (!path.startsWith('/') && !path.startsWith('./')) {
        result.warnings.push(`Path ${name} should be absolute or relative to current directory`);
      }
    }
  }

  /**
   * Validate database-related settings
   */
  private validateDatabaseSettings(config: AllConfig, result: ConfigValidationResult): void {
    const { database } = config;

    switch (database.driver) {
      case 'local':
        if (!database.filePath) {
          result.warnings.push('Local database driver should have filePath specified');
        }
        break;
      case 'turso':
        if (
          !database.authToken ||
          (typeof database.authToken === 'string' && database.authToken.trim() === '')
        ) {
          result.errors.push('Turso database driver requires authToken');
        }
        if (!database.url.startsWith('libsql://')) {
          result.warnings.push('Turso database URL should start with "libsql://"');
        }
        break;
      case 'd1':
        if (!database.accountId || !database.databaseId || !database.d1Token) {
          result.errors.push('D1 database driver requires accountId, databaseId, and d1Token');
        }
        break;
    }
  }

  /**
   * Get validation schemas for external use
   */
  static getSchemas(): Record<string, z.ZodType> {
    return {
      AppConfigSchema,
      DatabaseConfigSchema,
      JwtConfigSchema,
      CorsConfigSchema,
      UploadConfigSchema,
      StaticConfigSchema,
      LogConfigSchema,
      WalineConfigSchema,
      RuntimeConfigSchema,
      AllConfigSchema,
    };
  }
}
