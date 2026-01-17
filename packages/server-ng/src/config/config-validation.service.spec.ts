import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { ConfigValidationService } from './config-validation.service';
import { ConfigService } from './config.service';

describe('ConfigValidationService', () => {
  let service: ConfigValidationService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [],
        }),
      ],
      providers: [ConfigService, ConfigValidationService],
    }).compile();

    service = module.get<ConfigValidationService>(ConfigValidationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateAll', () => {
    it('should validate all configuration successfully with valid config', () => {
      // Mock valid configuration
      vi.spyOn(configService, 'all', 'get').mockReturnValue({
        app: {
          port: 3000,
          nodeEnv: 'test',
          apiPrefix: 'api',
          apiVersion: 'v2',
          locale: 'zh-cn',
          isProduction: false,
          isDevelopment: false,
        },
        database: {
          driver: 'local',
          url: process.env.DATABASE_URL || 'file:./test.db',
          filePath: process.env.DATABASE_FILE_PATH || './test.db',
        },
        jwt: {
          secret: 'test-secret-key-with-sufficient-length',
          expiresIn: '1h',
          refreshSecret: 'test-refresh-secret-key-with-sufficient-length',
          refreshExpiresIn: '7d',
        },
        cors: {
          origin: 'http://localhost:3000',
          credentials: true,
        },
        upload: {
          maxFileSize: 52428800,
          destination: './uploads',
        },
        static: {
          path: '/app/static',
        },
        log: {
          level: 'info',
          dir: '/var/log/vanblog',
        },
        waline: {
          db: 'waline',
        },
        runtime: {
          demoMode: false,
          codeRunnerPath: '/app/codeRunner',
          pluginRunnerPath: '/app/pluginRunner',
        },
      });

      const result = service.validateAll();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid configuration', () => {
      // Mock invalid configuration
      vi.spyOn(configService, 'all', 'get').mockReturnValue({
        app: {
          port: -1, // Invalid port
          nodeEnv: 'invalid', // Invalid environment
          apiPrefix: '', // Empty string
          apiVersion: '',
          locale: 'zh-cn',
          isProduction: false,
          isDevelopment: false,
        },
        database: {
          driver: 'local',
          url: '',
        },
        jwt: {
          secret: 'short', // Too short
          expiresIn: '',
          refreshSecret: 'short',
          refreshExpiresIn: '',
        },
        cors: {
          origin: 'http://localhost:3000',
          credentials: true,
        },
        upload: {
          maxFileSize: 0, // Invalid size
          destination: '',
        },
        static: {
          path: '',
        },
        log: {
          level: 'invalid', // Invalid level
          dir: '',
        },
        waline: {
          db: '',
        },
        runtime: {
          demoMode: false,
          codeRunnerPath: '',
          pluginRunnerPath: '',
        },
      });

      const result = service.validateAll();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('port'))).toBe(true);
      expect(result.errors.some((error) => error.includes('nodeEnv'))).toBe(true);
    });

    it('should include security errors for default values in production', () => {
      // Mock configuration with default security values
      vi.spyOn(configService, 'all', 'get').mockReturnValue({
        app: {
          port: 3000,
          nodeEnv: 'production',
          apiPrefix: 'api',
          apiVersion: 'v2',
          locale: 'zh-cn',
          isProduction: true,
          isDevelopment: false,
        },
        database: {
          driver: 'local',
          url: process.env.DATABASE_URL || 'file:./test.db',
          filePath: process.env.DATABASE_FILE_PATH || './test.db',
        },
        jwt: {
          secret: 'your-secret-key-that-is-long-enough-for-validation', // Default value that should trigger error
          expiresIn: '1h',
          refreshSecret: 'your-refresh-secret-that-is-long-enough-too', // Default value that should trigger error
          refreshExpiresIn: '7d',
        },
        cors: {
          origin: '*', // Wildcard in production
          credentials: true,
        },
        upload: {
          maxFileSize: 52428800,
          destination: './uploads',
        },
        static: {
          path: '/app/static',
        },
        log: {
          level: 'info',
          dir: '/var/log/vanblog',
        },
        waline: {
          db: 'waline',
        },
        runtime: {
          demoMode: false,
          codeRunnerPath: '/app/codeRunner',
          pluginRunnerPath: '/app/pluginRunner',
        },
      });

      const result = service.validateAll();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((error) => error.includes('JWT secret'))).toBe(true);
      expect(result.errors.some((error) => error.includes('CORS origin'))).toBe(true);
    });
  });

  describe('validateSection', () => {
    it('should validate specific configuration section', () => {
      const schemas = ConfigValidationService.getSchemas();

      vi.spyOn(configService, 'all', 'get').mockReturnValue({
        app: {
          port: 3000,
          nodeEnv: 'test',
          apiPrefix: 'api',
          apiVersion: 'v2',
          locale: 'zh-cn',
          isProduction: false,
          isDevelopment: true,
        },
        database: { driver: 'local', url: process.env.DATABASE_URL },
        jwt: {
          secret: 'test-secret',
          expiresIn: '1h',
          refreshSecret: 'test-refresh',
          refreshExpiresIn: '7d',
        },
        cors: { origin: '*', credentials: true },
        upload: { maxFileSize: 1024, destination: './uploads' },
        static: { path: '/static' },
        log: { level: 'info', dir: '/logs' },
        waline: { db: 'waline' },
        runtime: { demoMode: false, codeRunnerPath: '/code', pluginRunnerPath: '/plugin' },
      });

      const result = service.validateSection('app', schemas.AppConfigSchema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid section', () => {
      const schemas = ConfigValidationService.getSchemas();

      vi.spyOn(configService, 'all', 'get').mockReturnValue({
        app: {
          port: 'invalid' as any, // Should be number
          nodeEnv: 'invalid' as any,
          apiPrefix: '',
          apiVersion: '',
          locale: 'zh-cn',
          isProduction: 'invalid' as any, // Should be boolean
          isDevelopment: 'invalid' as any,
        },
        database: { driver: 'local', url: process.env.DATABASE_URL },
        jwt: {
          secret: 'test-secret',
          expiresIn: '1h',
          refreshSecret: 'test-refresh',
          refreshExpiresIn: '7d',
        },
        cors: { origin: '*', credentials: true },
        upload: { maxFileSize: 1024, destination: './uploads' },
        static: { path: '/static' },
        log: { level: 'info', dir: '/logs' },
        waline: { db: 'waline' },
        runtime: { demoMode: false, codeRunnerPath: '/code', pluginRunnerPath: '/plugin' },
      });

      const result = service.validateSection('app', schemas.AppConfigSchema);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getSchemas', () => {
    it('should return all validation schemas', () => {
      const schemas = ConfigValidationService.getSchemas();

      expect(schemas).toHaveProperty('AppConfigSchema');
      expect(schemas).toHaveProperty('DatabaseConfigSchema');
      expect(schemas).toHaveProperty('JwtConfigSchema');
      expect(schemas).toHaveProperty('CorsConfigSchema');
      expect(schemas).toHaveProperty('UploadConfigSchema');
      expect(schemas).toHaveProperty('StaticConfigSchema');
      expect(schemas).toHaveProperty('LogConfigSchema');
      expect(schemas).toHaveProperty('WalineConfigSchema');
      expect(schemas).toHaveProperty('RuntimeConfigSchema');
      expect(schemas).toHaveProperty('AllConfigSchema');
    });
  });

  describe('database validation', () => {
    it('should validate turso database configuration', () => {
      vi.spyOn(configService, 'all', 'get').mockReturnValue({
        app: {
          port: 3000,
          nodeEnv: 'test',
          apiPrefix: 'api',
          apiVersion: 'v2',
          locale: 'zh-cn',
          isProduction: false,
          isDevelopment: true,
        },
        database: {
          driver: 'turso',
          url: 'libsql://test.turso.io',
          authToken: 'test-token',
        },
        jwt: {
          secret: 'test-secret-key-with-sufficient-length',
          expiresIn: '1h',
          refreshSecret: 'test-refresh-secret-key-with-sufficient-length',
          refreshExpiresIn: '7d',
        },
        cors: {
          origin: 'http://localhost:3000',
          credentials: true,
        },
        upload: {
          maxFileSize: 52428800,
          destination: './uploads',
        },
        static: {
          path: '/app/static',
        },
        log: {
          level: 'info',
          dir: '/var/log/vanblog',
        },
        waline: {
          db: 'waline',
        },
        runtime: {
          demoMode: false,
          codeRunnerPath: '/app/codeRunner',
          pluginRunnerPath: '/app/pluginRunner',
        },
      });

      const result = service.validateAll();

      expect(result.isValid).toBe(true);
    });

    it('should return errors for incomplete turso configuration', () => {
      vi.spyOn(configService, 'all', 'get').mockReturnValue({
        app: {
          port: 3000,
          nodeEnv: 'test',
          apiPrefix: 'api',
          apiVersion: 'v2',
          locale: 'zh-cn',
          isProduction: false,
          isDevelopment: true,
        },
        database: {
          driver: 'turso',
          url: 'libsql://test.turso.io',
          // authToken is missing - should trigger validation error
        },
        jwt: {
          secret: 'test-secret-key-with-sufficient-length',
          expiresIn: '1h',
          refreshSecret: 'test-refresh-secret-key-with-sufficient-length',
          refreshExpiresIn: '7d',
        },
        cors: {
          origin: 'http://localhost:3000',
          credentials: true,
        },
        upload: {
          maxFileSize: 52428800,
          destination: './uploads',
        },
        static: {
          path: '/app/static',
        },
        log: {
          level: 'info',
          dir: '/var/log/vanblog',
        },
        waline: {
          db: 'waline',
        },
        runtime: {
          demoMode: false,
          codeRunnerPath: '/app/codeRunner',
          pluginRunnerPath: '/app/pluginRunner',
        },
      });

      const result = service.validateAll();

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('authToken'))).toBe(true);
    });
  });
});
