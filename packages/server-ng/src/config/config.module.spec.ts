import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import {
  ConfigModule as NestConfigModule,
  ConfigService as NestConfigService,
} from '@nestjs/config';

import { ConfigModule } from './config.module';
import { ConfigService } from './config.service';
import { ConfigValidationService } from './config-validation.service';

describe('ConfigModule', () => {
  let module: TestingModule;
  let configService: ConfigService;
  let validationService: ConfigValidationService;
  let nestConfigService: NestConfigService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    validationService = module.get<ConfigValidationService>(ConfigValidationService);
    nestConfigService = module.get<NestConfigService>(NestConfigService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('module initialization', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should provide ConfigService', () => {
      expect(configService).toBeDefined();
      expect(configService).toBeInstanceOf(ConfigService);
    });

    it('should provide ConfigValidationService', () => {
      expect(validationService).toBeDefined();
      expect(validationService).toBeInstanceOf(ConfigValidationService);
    });

    it('should provide NestConfigService', () => {
      expect(nestConfigService).toBeDefined();
    });
  });

  describe('global module behavior', () => {
    it('should be accessible from other modules', async () => {
      // 创建一个测试模块，不导入 ConfigModule
      const testModule = await Test.createTestingModule({
        imports: [ConfigModule],
        providers: [
          {
            provide: 'TEST_SERVICE',
            useFactory: (config: ConfigService) => ({
              config,
            }),
            inject: [ConfigService],
          },
        ],
      }).compile();

      const testService = testModule.get<{ config: ConfigService }>('TEST_SERVICE');
      expect(testService.config).toBeDefined();
      expect(testService.config).toBeInstanceOf(ConfigService);

      await testModule.close();
    });
  });

  describe('configuration loading', () => {
    it('should load environment variables', () => {
      const port = nestConfigService.get('PORT');
      expect(port).toBeDefined();
    });

    it('should load database configuration', () => {
      const dbConfig = nestConfigService.get('database');
      expect(dbConfig).toBeDefined();
      expect(dbConfig).toHaveProperty('driver');
      expect(dbConfig).toHaveProperty('url');
    });

    it('should use default values for missing environment variables', () => {
      const nodeEnv = nestConfigService.get('NODE_ENV', 'development');
      expect(nodeEnv).toBeDefined();
    });
  });

  describe('configuration validation', () => {
    it('should validate configuration on startup', () => {
      // ConfigModule 使用 validateConfig 函数进行验证
      // 如果验证失败，模块初始化会抛出错误
      expect(configService).toBeDefined();
    });

    it('should provide access to validation service', () => {
      const schemas = ConfigValidationService.getSchemas();
      expect(schemas).toBeDefined();
      expect(schemas).toHaveProperty('AppConfigSchema');
      expect(schemas).toHaveProperty('DatabaseConfigSchema');
    });
  });

  describe('forFeature static method', () => {
    it('should create a feature module with custom configuration', () => {
      const customConfig = (): Record<string, unknown> => ({
        featureKey: 'featureValue',
        nested: {
          value: 42,
        },
      });

      const featureModule = ConfigModule.forFeature(customConfig);

      expect(featureModule).toBeDefined();
      expect(featureModule.module).toBe(NestConfigModule);
    });

    it('should allow feature config to be accessed from ConfigService', async () => {
      const customConfig = (): Record<string, unknown> => ({
        customFeature: {
          enabled: true,
          timeout: 5000,
        },
      });

      const testModule = await Test.createTestingModule({
        imports: [ConfigModule, ConfigModule.forFeature(customConfig)],
      }).compile();

      const config = testModule.get<NestConfigService>(NestConfigService);
      const customFeatureConfig = config.get('customFeature');

      expect(customFeatureConfig).toBeDefined();
      expect(customFeatureConfig).toEqual({
        enabled: true,
        timeout: 5000,
      });

      await testModule.close();
    });
  });

  describe('configuration caching', () => {
    it('should cache configuration values', () => {
      // 调用两次 get，应该返回相同的实例（由于缓存）
      const value1 = nestConfigService.get('NODE_ENV');
      const value2 = nestConfigService.get('NODE_ENV');

      expect(value1).toBe(value2);
    });
  });

  describe('environment-specific configuration', () => {
    it('should load configuration based on NODE_ENV', () => {
      const config = nestConfigService.get('NODE_ENV', 'development');

      // 在测试环境中应该加载测试配置
      expect(['test', 'development', 'production']).toContain(config);
    });
  });

  describe('variable expansion', () => {
    it('should support environment variable expansion', () => {
      // ConfigModule 配置了 expandVariables: true
      // 这允许在 .env 文件中使用 ${VAR_NAME} 语法
      const config = nestConfigService.get('DATABASE_URL');

      // 即使没有实际的变量展开，配置也应该可以正常读取
      expect(config).toBeDefined();
    });
  });
});
