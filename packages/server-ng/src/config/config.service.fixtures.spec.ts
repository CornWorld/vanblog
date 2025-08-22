import {
  ConfigModule as NestConfigModule,
  type ConfigService as NestConfigService,
} from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect } from 'vitest';

import { configTest } from '../../test/vitest-fixtures.test';

import { ConfigService } from './config.service';
import databaseConfig from './database.config';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({
          isGlobal: false,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              PORT: 3000,
              NODE_ENV: 'test',
              API_PREFIX: 'api',
              API_VERSION: 'v2',
              LOCALE: 'zh-cn',
              DATABASE_DRIVER: 'local',
              DATABASE_URL: 'file:./test/vanblog.db',
              JWT_SECRET: 'test-secret',
              JWT_REFRESH_SECRET: 'test-refresh-secret',
              CORS_ORIGIN: 'http://localhost:3000',
              CORS_CREDENTIALS: true,
              UPLOAD_MAX_FILE_SIZE: 10485760,
              UPLOAD_DESTINATION: './test-uploads',
              STATIC_PATH: '/test/static',
              LOG_LEVEL: 'debug',
              LOG_DIR: '/test/logs',
              WALINE_DB: 'waline-test',
              DEMO_MODE: false,
              CODE_RUNNER_PATH: '/test/codeRunner',
              PLUGIN_RUNNER_PATH: '/test/pluginRunner',
            }),
            databaseConfig,
          ],
        }),
      ],
      providers: [ConfigService],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  configTest('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('app config', () => {
    configTest('should return app configuration', () => {
      const appConfig = service.app;
      expect(appConfig).toBeDefined();
      expect(appConfig.port).toBe(3000);
      expect(appConfig.nodeEnv).toBe('test');
      expect(appConfig.apiPrefix).toBe('api');
      expect(appConfig.apiVersion).toBe('v2');
      expect(appConfig.locale).toBe('zh-cn');
      expect(appConfig.isDevelopment).toBe(false);
      expect(appConfig.isProduction).toBe(false);
    });
  });

  describe('database config', () => {
    configTest('should return database configuration', () => {
      const dbConfig = service.database;
      expect(dbConfig).toBeDefined();
      expect(dbConfig.driver).toBe('local');
      expect(dbConfig.url).toMatch(/^file:.*\.db$/);
    });
  });

  describe('jwt config', () => {
    configTest('should return JWT configuration', () => {
      const jwtConfig = service.jwt;
      expect(jwtConfig).toBeDefined();
      expect(jwtConfig.secret).toBe('test-secret');
      expect(jwtConfig.expiresIn).toBe('7d');
      expect(jwtConfig.refreshSecret).toBe('test-refresh-secret');
      expect(jwtConfig.refreshExpiresIn).toBe('30d');
    });
  });

  describe('cors config', () => {
    configTest('should return CORS configuration', () => {
      const corsConfig = service.cors;
      expect(corsConfig).toBeDefined();
      expect(corsConfig.origin).toBe('http://localhost:3000');
      expect(corsConfig.credentials).toBe(true);
    });

    configTest('should parse multiple origins', () => {
      const mockConfigService = {
        get: <T = unknown>(key: string, defaultValue?: T): T => {
          if (key === 'CORS_ORIGIN') {
            return 'http://localhost:3000,http://localhost:3001' as T;
          }
          return defaultValue as T;
        },
      };
      const configService = new ConfigService(mockConfigService as NestConfigService);
      const corsConfig = configService.cors;
      expect(corsConfig.origin).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    });
  });

  describe('all config', () => {
    configTest('should return all configurations', () => {
      const allConfig = service.all;
      expect(allConfig).toBeDefined();
      expect(allConfig.app).toBeDefined();
      expect(allConfig.database).toBeDefined();
      expect(allConfig.jwt).toBeDefined();
      expect(allConfig.cors).toBeDefined();
      expect(allConfig.upload).toBeDefined();
      expect(allConfig.static).toBeDefined();
      expect(allConfig.log).toBeDefined();
      expect(allConfig.waline).toBeDefined();
      expect(allConfig.runtime).toBeDefined();
    });
  });
});
