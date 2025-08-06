import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import type {
  AllConfig,
  AppConfig,
  DatabaseConfig,
  JwtConfig,
  CorsConfig,
  UploadConfig,
  StaticConfig,
  LogConfig,
  WalineConfig,
  RuntimeConfig,
} from './config.interface';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService) {}

  get app(): AppConfig {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return {
      port: this.configService.get<number>('PORT', 3000),
      nodeEnv,
      apiPrefix: this.configService.get<string>('API_PREFIX', 'api'),
      apiVersion: this.configService.get<string>('API_VERSION', 'v2'),
      isProduction: nodeEnv === 'production',
      isDevelopment: nodeEnv === 'development',
    };
  }

  get database(): DatabaseConfig {
    const config = this.configService.get<DatabaseConfig>('database');
    if (!config) {
      throw new Error('Database configuration is missing');
    }
    return config;
  }

  get jwt(): JwtConfig {
    return {
      secret: this.configService.get<string>('JWT_SECRET', 'your-secret-key'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
      refreshSecret: this.configService.get<string>('JWT_REFRESH_SECRET', 'your-refresh-secret'),
      refreshExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    };
  }

  get cors(): CorsConfig {
    const origin = this.configService.get<string>('CORS_ORIGIN', '*');
    return {
      origin: origin.includes(',') ? origin.split(',').map((o) => o.trim()) : origin,
      credentials: this.configService.get<boolean>('CORS_CREDENTIALS', true),
    };
  }

  get upload(): UploadConfig {
    return {
      maxFileSize: this.configService.get<number>('UPLOAD_MAX_FILE_SIZE', 52428800),
      destination: this.configService.get<string>('UPLOAD_DESTINATION', './uploads'),
    };
  }

  get static(): StaticConfig {
    return {
      path: this.configService.get<string>('STATIC_PATH', '/app/static'),
    };
  }

  get log(): LogConfig {
    return {
      level: this.configService.get<string>('LOG_LEVEL', 'info'),
      dir: this.configService.get<string>('LOG_DIR', '/var/log/vanblog'),
    };
  }

  get waline(): WalineConfig {
    return {
      db: this.configService.get<string>('WALINE_DB', 'waline'),
    };
  }

  get runtime(): RuntimeConfig {
    return {
      demoMode: this.configService.get<boolean>('DEMO_MODE', false),
      codeRunnerPath: this.configService.get<string>('CODE_RUNNER_PATH', '/app/codeRunner'),
      pluginRunnerPath: this.configService.get<string>('PLUGIN_RUNNER_PATH', '/app/pluginRunner'),
    };
  }

  get all(): AllConfig {
    return {
      app: this.app,
      database: this.database,
      jwt: this.jwt,
      cors: this.cors,
      upload: this.upload,
      static: this.static,
      log: this.log,
      waline: this.waline,
      runtime: this.runtime,
    };
  }

  /**
   * Get configuration value by key
   */
  get(key: string): unknown;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    if (defaultValue !== undefined) {
      return this.configService.get<T>(key, defaultValue);
    }
    return this.configService.get(key);
  }
}
