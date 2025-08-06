import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PluginContextFactory,
  PluginDataStorageService,
  PluginConfigReaderService,
  PluginLoggerService,
  PluginContextService,
} from './plugin-context.service';
import { ConfigService } from '../../../config/config.service';
import { DATABASE_CONNECTION } from '../../../database';
import { eq, and } from 'drizzle-orm';
import { pluginData } from '../../../database/schema';
import type { Database } from '../../../database';
interface MockDatabase {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
}

describe('PluginContext Services', () => {
  let factory: PluginContextFactory;
  let mockDb: MockDatabase;
  let mockConfigService: ConfigService;

  beforeEach(async () => {
    const mockReturning = {
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnValue(mockReturning),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    } as MockDatabase;

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'plugin.test.config.key') {
          return 'test-value';
        }
        if (key === 'plugin.test.config.json') {
          return '{"nested": "value"}';
        }
        return defaultValue;
      }),
      configService: {},
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginContextFactory,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    factory = module.get<PluginContextFactory>(PluginContextFactory);
  });

  describe('PluginContextFactory', () => {
    it('should be defined', () => {
      expect(factory).toBeDefined();
    });

    it('should create a plugin context', () => {
      const context = factory.createContext('test-plugin');

      expect(context).toBeDefined();
      expect(context.pluginId).toBe('test-plugin');
      expect(context.logger).toBeDefined();
      expect(context.config).toBeDefined();
      expect(context.data).toBeDefined();
    });
  });

  describe('PluginDataStorageService', () => {
    let dataStorage: PluginDataStorageService;

    beforeEach(() => {
      dataStorage = new PluginDataStorageService(mockDb as unknown as Database, 'test-plugin');
    });

    it('should get data from storage', async () => {
      const testData = { test: 'value' };
      mockDb.limit.mockResolvedValueOnce([{ value: testData }]);

      const result = await dataStorage.get('test-key');

      expect(result).toEqual(testData);
      expect(mockDb.select).toHaveBeenCalledWith({ value: pluginData.value });
      expect(mockDb.from).toHaveBeenCalledWith(pluginData);
      expect(mockDb.where).toHaveBeenCalledWith(
        and(eq(pluginData.pluginId, 'test-plugin'), eq(pluginData.key, 'test-key')),
      );
    });

    it('should return null for non-existent key', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await dataStorage.get('non-existent');

      expect(result).toBeNull();
    });

    it('should set data in storage', async () => {
      const testData = { test: 'value' };

      await dataStorage.set('test-key', testData);

      expect(mockDb.insert).toHaveBeenCalledWith(pluginData);
      expect(mockDb.values).toHaveBeenCalled();
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith({
        target: [pluginData.pluginId, pluginData.key],
        set: {
          value: '{"test":"value"}',
          updatedAt: expect.any(Date) as Date,
        },
      });
    });

    it('should delete data from storage', async () => {
      // Reset and setup the mock chain for select query
      mockDb.select = vi.fn().mockReturnThis();
      mockDb.from = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockReturnThis();
      mockDb.limit = vi.fn().mockResolvedValue([{ key: 'test-key' }]);

      // Setup the mock chain for delete query
      mockDb.delete = vi.fn().mockReturnThis();
      mockDb.where = vi.fn().mockReturnThis();

      const result = await dataStorage.delete('test-key');

      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalledWith(pluginData);
    });

    it('should check if key exists', async () => {
      mockDb.limit.mockResolvedValueOnce([{ key: 'test-key' }]);

      const result = await dataStorage.has('test-key');

      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalledWith({ key: pluginData.key });
      expect(mockDb.where).toHaveBeenCalledWith(
        and(eq(pluginData.pluginId, 'test-plugin'), eq(pluginData.key, 'test-key')),
      );
    });

    it('should get all keys', async () => {
      mockDb.where.mockResolvedValueOnce([{ key: 'key1' }, { key: 'key2' }]);

      const result = await dataStorage.keys();

      expect(result).toEqual(['key1', 'key2']);
      expect(mockDb.select).toHaveBeenCalledWith({ key: pluginData.key });
      expect(mockDb.where).toHaveBeenCalledWith(eq(pluginData.pluginId, 'test-plugin'));
    });
  });

  describe('PluginConfigReaderService', () => {
    let configReader: PluginConfigReaderService;
    const originalEnv = process.env;

    beforeEach(() => {
      configReader = new PluginConfigReaderService(mockConfigService, 'test-plugin');
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should get config value', () => {
      mockConfigService.get = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => {
        if (_key === 'PLUGIN_TEST-PLUGIN_API_KEY') {
          return 'test-api-key';
        }
        return defaultValue;
      });

      const result = configReader.get('api_key');

      expect(result).toBe('test-api-key');
    });

    it('should return default value when config not found', () => {
      mockConfigService.get = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => {
        return defaultValue;
      });

      const result = configReader.get('non_existent', 'default-value');

      expect(result).toBe('default-value');
    });

    it('should parse JSON config values', () => {
      mockConfigService.get = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => {
        if (_key === 'PLUGIN_TEST-PLUGIN_CONFIG') {
          return '{"enabled": true, "count": 5}';
        }
        return defaultValue;
      });

      const result = configReader.get('config');

      expect(result).toEqual({ enabled: true, count: 5 });
    });

    it('should return string value when JSON parsing fails', () => {
      mockConfigService.get = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => {
        if (_key === 'PLUGIN_TEST-PLUGIN_INVALID_JSON') {
          return 'not-json';
        }
        return defaultValue;
      });

      const result = configReader.get('invalid_json');

      expect(result).toBe('not-json');
    });

    it('should return value when it exists', () => {
      mockConfigService.get = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => {
        if (_key === 'PLUGIN_TEST-PLUGIN_REQUIRED') {
          return 'required-value';
        }
        return defaultValue;
      });

      const result = configReader.getOrThrow('required');

      expect(result).toBe('required-value');
    });

    it('should throw error when value does not exist', () => {
      expect(() => configReader.getOrThrow('non_existent')).toThrow(
        "Plugin configuration key 'non_existent' is required but not found",
      );
    });

    it('should check if config exists', () => {
      mockConfigService.get = vi.fn().mockImplementation((_key: string, defaultValue?: unknown) => {
        if (_key === 'PLUGIN_TEST-PLUGIN_EXISTS') {
          return 'true';
        }
        return defaultValue;
      });

      expect(configReader.has('exists')).toBe(true);
      expect(configReader.has('not_exists')).toBe(false);
    });
  });

  describe('PluginLoggerService', () => {
    let logger: PluginLoggerService;

    beforeEach(() => {
      logger = new PluginLoggerService('test-plugin');
    });

    it('should be defined', () => {
      expect(logger).toBeDefined();
    });

    it('should have all logging methods', () => {
      expect(typeof logger.log).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.verbose).toBe('function');
    });
  });

  describe('PluginContextService', () => {
    it('should create context with all components', () => {
      const mockLogger = new PluginLoggerService('test-plugin');
      const mockConfig = new PluginConfigReaderService(mockConfigService, 'test-plugin');
      const mockData = new PluginDataStorageService(mockDb as unknown as Database, 'test-plugin');

      const context = new PluginContextService('test-plugin', mockLogger, mockConfig, mockData);

      expect(context).toBeDefined();
      expect(context.pluginId).toBe('test-plugin');
      expect(context.logger).toBe(mockLogger);
      expect(context.config).toBe(mockConfig);
      expect(context.data).toBe(mockData);
    });
  });
});
