import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfigModule as NestConfigModule,
  ConfigService as NestConfigService,
} from '@nestjs/config';
import { ConfigService } from './config.service';

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
              MONGODB_URI: 'mongodb://localhost:27017/vanblog-test',
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
          ],
        }),
      ],
      providers: [ConfigService],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('app config', () => {
    it('should return app configuration', () => {
      const appConfig = service.app;
      expect(appConfig).toBeDefined();
      expect(appConfig.port).toBe(3000);
      expect(appConfig.nodeEnv).toBe('test');
      expect(appConfig.apiPrefix).toBe('api');
      expect(appConfig.apiVersion).toBe('v2');
      expect(appConfig.isDevelopment).toBe(false);
      expect(appConfig.isProduction).toBe(false);
    });
  });

  describe('database config', () => {
    it('should return database configuration with URI', () => {
      const dbConfig = service.database;
      expect(dbConfig).toBeDefined();
      expect(dbConfig.uri).toBe('mongodb://localhost:27017/vanblog-test');
    });
  });

  describe('jwt config', () => {
    it('should return JWT configuration', () => {
      const jwtConfig = service.jwt;
      expect(jwtConfig).toBeDefined();
      expect(jwtConfig.secret).toBe('test-secret');
      expect(jwtConfig.expiresIn).toBe('7d');
      expect(jwtConfig.refreshSecret).toBe('test-refresh-secret');
      expect(jwtConfig.refreshExpiresIn).toBe('30d');
    });
  });

  describe('cors config', () => {
    it('should return CORS configuration', () => {
      const corsConfig = service.cors;
      expect(corsConfig).toBeDefined();
      expect(corsConfig.origin).toBe('http://localhost:3000');
      expect(corsConfig.credentials).toBe(true);
    });

    it('should parse multiple origins', () => {
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
    it('should return all configurations', () => {
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
