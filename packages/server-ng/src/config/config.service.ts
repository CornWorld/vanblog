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

/**
 * 配置服务
 *
 * 封装 NestJS ConfigService，提供类型安全的配置访问接口。
 * 所有配置项都有合理的默认值，确保应用能够正常启动。
 */
@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService) {}

  /**
   * 应用配置
   * 包括端口、环境、API 路由前缀等基础配置
   */
  get app(): AppConfig {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return {
      port: this.configService.get<number>('PORT', 3000),
      nodeEnv,
      apiPrefix: this.configService.get<string>('API_PREFIX', 'api'),
      apiVersion: this.configService.get<string>('API_VERSION', 'v2'),
      locale: this.configService.get<string>('LOCALE', 'zh-cn'),
      isProduction: nodeEnv === 'production',
      isDevelopment: nodeEnv === 'development',
    };
  }

  /**
   * 数据库配置
   * 从 database.config.ts 加载，支持 local/turso/d1 三种驱动
   */
  get database(): DatabaseConfig {
    const config = this.configService.get<DatabaseConfig>('database');
    if (!config) {
      throw new Error('Database configuration is missing');
    }
    return config;
  }

  /**
   * JWT 配置
   * 包括访问令牌和刷新令牌的密钥及过期时间
   */
  get jwt(): JwtConfig {
    return {
      secret: this.configService.get<string>('JWT_SECRET', 'your-secret-key'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
      refreshSecret: this.configService.get<string>('JWT_REFRESH_SECRET', 'your-refresh-secret'),
      refreshExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    };
  }

  /**
   * CORS 配置
   * 支持单个或多个源（逗号分隔），自动解析为数组
   */
  get cors(): CorsConfig {
    const origin = this.configService.get<string>('CORS_ORIGIN', '*');
    return {
      origin: origin.includes(',') ? origin.split(',').map((o) => o.trim()) : origin,
      credentials: this.configService.get<boolean>('CORS_CREDENTIALS', true),
    };
  }

  /**
   * 文件上传配置
   * 包括文件大小限制和上传目录
   */
  get upload(): UploadConfig {
    return {
      maxFileSize: this.configService.get<number>('UPLOAD_MAX_FILE_SIZE', 52428800),
      destination: this.configService.get<string>('UPLOAD_DESTINATION', './uploads'),
    };
  }

  /** 静态文件配置 */
  get static(): StaticConfig {
    return {
      path: this.configService.get<string>('STATIC_PATH', '/app/static'),
    };
  }

  /** 日志配置 */
  get log(): LogConfig {
    return {
      level: this.configService.get<string>('LOG_LEVEL', 'info'),
      dir: this.configService.get<string>('LOG_DIR', '/var/log/vanblog'),
    };
  }

  /** Waline 评论系统配置 */
  get waline(): WalineConfig {
    return {
      db: this.configService.get<string>('WALINE_DB', 'waline'),
    };
  }

  /** 运行时配置（演示模式、代码运行器路径等） */
  get runtime(): RuntimeConfig {
    return {
      demoMode: this.configService.get<boolean>('DEMO_MODE', false),
      codeRunnerPath: this.configService.get<string>('CODE_RUNNER_PATH', '/app/codeRunner'),
      pluginRunnerPath: this.configService.get<string>('PLUGIN_RUNNER_PATH', '/app/pluginRunner'),
    };
  }

  /** 获取所有配置（聚合视图） */
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
   * 获取任意配置值
   *
   * @param key - 配置键名
   * @param defaultValue - 默认值（可选）
   * @returns 配置值
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
