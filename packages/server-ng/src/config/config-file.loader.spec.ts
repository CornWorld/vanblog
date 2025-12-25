import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConfigFileLoader } from './config-file.loader';

describe('config-file.loader', () => {
  const testConfigDir = resolve(process.cwd(), 'test-config');
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置环境变量和模块
    vi.resetModules();
    process.env = { ...originalEnv };

    // 创建测试配置目录
    if (!existsSync(testConfigDir)) {
      mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    // 恢复环境
    process.env = originalEnv;
    vi.clearAllMocks();

    // 清理测试配置目录
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('createConfigFileLoader', () => {
    it('should return a function', () => {
      const loader = createConfigFileLoader();
      expect(typeof loader).toBe('function');
    });

    it('should return empty object when no config file exists', () => {
      // 临时修改 cwd 到一个没有 config 目录的地方
      const originalCwd = process.cwd;
      const tempDir = resolve(testConfigDir, 'no-config');
      mkdirSync(tempDir, { recursive: true });

      process.cwd = () => tempDir;

      const loader = createConfigFileLoader();
      const config = loader();

      expect(config).toEqual({});

      // 恢复 cwd
      process.cwd = originalCwd;
    });

    it('should load config from specified path', () => {
      const configPath = resolve(testConfigDir, 'custom.json');
      const configData = { key: 'value', nested: { prop: 42 } };

      writeFileSync(configPath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
    });

    it('should throw error if required file does not exist', () => {
      const nonExistentPath = resolve(testConfigDir, 'non-existent.json');

      const loader = createConfigFileLoader({
        path: nonExistentPath,
        required: true,
      });

      expect(() => loader()).toThrow();
      expect(() => loader()).toThrow('配置文件不存在');
    });

    it('should not throw if non-required file does not exist', () => {
      const nonExistentPath = resolve(testConfigDir, 'non-existent.json');

      const loader = createConfigFileLoader({
        path: nonExistentPath,
        required: false,
      });

      expect(() => loader()).not.toThrow();
      expect(loader()).toEqual({});
    });

    it('should throw error for invalid JSON', () => {
      const configPath = resolve(testConfigDir, 'invalid.json');
      writeFileSync(configPath, '{ invalid json }');

      const loader = createConfigFileLoader({ path: configPath });

      expect(() => loader()).toThrow();
      expect(() => loader()).toThrow('配置文件解析失败');
    });

    it('should load environment-specific config file', () => {
      const configDir = resolve(process.cwd(), 'config');
      mkdirSync(configDir, { recursive: true });

      const developmentConfig = { env: 'development', debug: true };
      writeFileSync(resolve(configDir, 'development.json'), JSON.stringify(developmentConfig));

      process.env.NODE_ENV = 'development';

      const loader = createConfigFileLoader();
      const config = loader();

      expect(config).toEqual(developmentConfig);

      // Cleanup
      rmSync(configDir, { recursive: true, force: true });
    });

    it('should fallback to default.json if env-specific file does not exist', () => {
      const configDir = resolve(process.cwd(), 'config');
      mkdirSync(configDir, { recursive: true });

      const defaultConfig = { env: 'default', setting: 'value' };
      writeFileSync(resolve(configDir, 'default.json'), JSON.stringify(defaultConfig));

      process.env.NODE_ENV = 'production';

      const loader = createConfigFileLoader();
      const config = loader();

      expect(config).toEqual(defaultConfig);

      // Cleanup
      rmSync(configDir, { recursive: true, force: true });
    });

    it('should prefer environment-specific config over default', () => {
      const configDir = resolve(process.cwd(), 'config');
      mkdirSync(configDir, { recursive: true });

      const defaultConfig = { env: 'default' };
      const testConfig = { env: 'test', testMode: true };

      writeFileSync(resolve(configDir, 'default.json'), JSON.stringify(defaultConfig));
      writeFileSync(resolve(configDir, 'test.json'), JSON.stringify(testConfig));

      process.env.NODE_ENV = 'test';

      const loader = createConfigFileLoader();
      const config = loader();

      expect(config).toEqual(testConfig);

      // Cleanup
      rmSync(configDir, { recursive: true, force: true });
    });

    it('should handle complex JSON structures', () => {
      const configPath = resolve(testConfigDir, 'complex.json');
      const complexConfig = {
        database: {
          host: 'localhost',
          port: 5432,
          credentials: {
            username: 'admin',
            password: 'secret',
          },
        },
        features: ['feature1', 'feature2'],
        settings: {
          enabled: true,
          timeout: 3000,
        },
      };

      writeFileSync(configPath, JSON.stringify(complexConfig));

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(complexConfig);
    });

    it('should handle empty JSON object', () => {
      const configPath = resolve(testConfigDir, 'empty.json');
      writeFileSync(configPath, '{}');

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual({});
    });

    it('should handle JSON with null values', () => {
      const configPath = resolve(testConfigDir, 'null-values.json');
      const configData = {
        key1: null,
        key2: 'value',
        key3: {
          nested: null,
        },
      };

      writeFileSync(configPath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
    });

    it('should handle JSON with arrays', () => {
      const configPath = resolve(testConfigDir, 'arrays.json');
      const configData = {
        list: [1, 2, 3],
        objects: [{ id: 1 }, { id: 2 }],
        nested: {
          items: ['a', 'b', 'c'],
        },
      };

      writeFileSync(configPath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
    });

    it('should handle JSON with boolean values', () => {
      const configPath = resolve(testConfigDir, 'booleans.json');
      const configData = {
        enabled: true,
        disabled: false,
        settings: {
          active: true,
        },
      };

      writeFileSync(configPath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
    });

    it('should handle JSON with numeric values', () => {
      const configPath = resolve(testConfigDir, 'numbers.json');
      const configData = {
        integer: 42,
        float: 3.14,
        negative: -100,
        zero: 0,
      };

      writeFileSync(configPath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error for malformed JSON', () => {
      const configPath = resolve(testConfigDir, 'malformed.json');
      writeFileSync(configPath, '{ "key": "value" ');

      const loader = createConfigFileLoader({ path: configPath });

      expect(() => loader()).toThrow();
      expect(() => loader()).toThrow('配置文件解析失败');
    });

    it('should throw error for non-JSON content', () => {
      const configPath = resolve(testConfigDir, 'not-json.json');
      writeFileSync(configPath, 'This is not JSON');

      const loader = createConfigFileLoader({ path: configPath });

      expect(() => loader()).toThrow();
      expect(() => loader()).toThrow('配置文件解析失败');
    });

    it('should handle file read errors gracefully', () => {
      const nonExistentPath = resolve(testConfigDir, 'does-not-exist.json');

      const loader = createConfigFileLoader({
        path: nonExistentPath,
        required: false,
      });

      expect(() => loader()).not.toThrow();
    });
  });

  describe('file path resolution', () => {
    it('should resolve relative paths from current working directory', () => {
      const relativePath = 'test-config/relative.json';
      const absolutePath = resolve(process.cwd(), relativePath);
      const configData = { from: 'relative-path' };

      mkdirSync(resolve(process.cwd(), 'test-config'), { recursive: true });
      writeFileSync(absolutePath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: relativePath });
      const config = loader();

      expect(config).toEqual(configData);
    });

    it('should handle absolute paths', () => {
      const absolutePath = resolve(testConfigDir, 'absolute.json');
      const configData = { from: 'absolute-path' };

      writeFileSync(absolutePath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: absolutePath });
      const config = loader();

      expect(config).toEqual(configData);
    });
  });

  describe('NODE_ENV handling', () => {
    it('should default to development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const configDir = resolve(process.cwd(), 'config');
      mkdirSync(configDir, { recursive: true });

      const developmentConfig = { env: 'development' };
      writeFileSync(resolve(configDir, 'development.json'), JSON.stringify(developmentConfig));

      const loader = createConfigFileLoader();
      const config = loader();

      expect(config).toEqual(developmentConfig);

      // Cleanup
      rmSync(configDir, { recursive: true, force: true });
    });

    it('should respect NODE_ENV value', () => {
      process.env.NODE_ENV = 'staging';

      const configDir = resolve(process.cwd(), 'config');
      mkdirSync(configDir, { recursive: true });

      const stagingConfig = { env: 'staging' };
      writeFileSync(resolve(configDir, 'staging.json'), JSON.stringify(stagingConfig));

      const loader = createConfigFileLoader();
      const config = loader();

      expect(config).toEqual(stagingConfig);

      // Cleanup
      rmSync(configDir, { recursive: true, force: true });
    });
  });

  describe('search order', () => {
    it('should search for config files in correct order', () => {
      const configDir = resolve(process.cwd(), 'config');
      mkdirSync(configDir, { recursive: true });

      const defaultConfig = { priority: 2 };
      const envConfig = { priority: 1 };

      writeFileSync(resolve(configDir, 'default.json'), JSON.stringify(defaultConfig));
      writeFileSync(resolve(configDir, 'test.json'), JSON.stringify(envConfig));

      process.env.NODE_ENV = 'test';

      const loader = createConfigFileLoader();
      const config = loader();

      // Should load env-specific config first
      expect(config).toEqual(envConfig);
      expect(config.priority).toBe(1);

      // Cleanup
      rmSync(configDir, { recursive: true, force: true });
    });
  });

  describe('integration with NestJS ConfigModule', () => {
    it('should be usable as ConfigFactory', () => {
      const configPath = resolve(testConfigDir, 'nest-config.json');
      const configData = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
        API_KEY: 'test-key',
      };

      writeFileSync(configPath, JSON.stringify(configData));

      const configFactory = createConfigFileLoader({ path: configPath });
      const config = configFactory();

      expect(config).toEqual(configData);
      expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(config.API_KEY).toBe('test-key');
    });

    it('should return config compatible with ConfigModule.forRoot', () => {
      const configPath = resolve(testConfigDir, 'app-config.json');
      const configData = {
        app: {
          port: 3000,
          name: 'TestApp',
        },
      };

      writeFileSync(configPath, JSON.stringify(configData));

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(typeof config).toBe('object');
      expect(config).toHaveProperty('app');
    });
  });

  describe('utf-8 encoding', () => {
    it('should handle UTF-8 encoded files', () => {
      const configPath = resolve(testConfigDir, 'utf8.json');
      const configData = {
        message: '你好世界',
        emoji: '😀',
        special: 'Ñoño',
      };

      writeFileSync(configPath, JSON.stringify(configData), 'utf-8');

      const loader = createConfigFileLoader({ path: configPath });
      const config = loader();

      expect(config).toEqual(configData);
      expect(config.message).toBe('你好世界');
      expect(config.emoji).toBe('😀');
    });
  });
});
