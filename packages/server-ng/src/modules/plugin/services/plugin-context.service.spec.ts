import { Test, type TestingModule } from '@nestjs/testing';
import { pluginData } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ConfigService } from '../../../config/config.service';
import { DATABASE_CONNECTION, type Database } from '../../../database';
import { Mock } from '@test/mock';

import {
  PluginContextFactory,
  PluginDataStorageService,
  PluginConfigReaderService,
  // PluginSettingsRegistryService,
  PluginContextService,
} from './plugin-context.service';
import { PluginRegistryService } from './plugin-registry.service';
import { SignalBus } from './signal.service';

describe('PluginContext Services', () => {
  let factory: PluginContextFactory;
  let mockConfigService: ConfigService;
  let mockDb: ReturnType<typeof Mock.db>['db'];

  beforeEach(async () => {
    // Create database mock using MockUtils
    const dbBuilder = Mock.db();
    dbBuilder.setQueryResult([]);
    mockDb = dbBuilder.build();

    // Add $client for raw SQL execution
    (mockDb as any).$client = {
      execute: vi.fn().mockResolvedValue({}),
    };

    // Create ConfigService mock using MockUtils
    mockConfigService = Mock.config({
      'plugin.test.config.key': 'test-value',
      'plugin.test.config.json': '{"nested": "value"}',
    });

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
        {
          provide: PluginRegistryService,
          useValue: {
            register: vi.fn(),
            unregister: vi.fn().mockReturnValue(true),
            getAllPublicData: vi.fn().mockResolvedValue({}),
          },
        },
        {
          provide: SignalBus,
          useValue: {
            connect: vi.fn().mockReturnValue(() => {}),
            subscribe: vi.fn().mockReturnValue(() => {}),
            send: vi.fn().mockResolvedValue({}),
            emit: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    factory = module.get<PluginContextFactory>(PluginContextFactory);
  });

  describe('PluginContextFactory', () => {
    it('should be defined', () => {
      expect(factory).toBeDefined();
    });

    it('should create context for plugin', () => {
      const context = factory.createContext('test-plugin');
      expect(context).toBeDefined();
      expect(context.pluginId).toBe('test-plugin');
      expect(context.config).toBeInstanceOf(PluginConfigReaderService);
      expect(context.data).toBeInstanceOf(PluginDataStorageService);
    });
  });

  describe('PluginDataStorageService', () => {
    let dataStorage: PluginDataStorageService;

    beforeEach(() => {
      dataStorage = new PluginDataStorageService(mockDb as unknown as Database, 'test-plugin');
    });

    it('should get data by key', async () => {
      const testData = { foo: 'bar' };
      // Create new builder for this test with specific query result
      const dbBuilder = Mock.db();
      const localDb = dbBuilder.build();

      // Mock the complete chain: select().from().where().limit()
      const limitMock = vi.fn().mockResolvedValue([{ value: testData }]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      localDb.select = vi.fn().mockReturnValue({ from: fromMock });

      const storage = new PluginDataStorageService(localDb as unknown as Database, 'test-plugin');

      const result = await storage.get('test-key');

      expect(result).toEqual(testData);
      expect(localDb.select).toHaveBeenCalledWith({ value: pluginData.value });
      expect(fromMock).toHaveBeenCalled();
    });

    it('should return null for non-existent key', async () => {
      const dbBuilder = Mock.db();
      dbBuilder.setQueryResult([]);
      const localDb = dbBuilder.build();
      const storage = new PluginDataStorageService(localDb as unknown as Database, 'test-plugin');

      const result = await storage.get('non-existent');

      expect(result).toBeNull();
    });

    it('should set data in storage using single UPSERT', async () => {
      const testData = { test: 'value' };
      // Use existing mockDb with $client
      await dataStorage.set('test-key', testData);

      expect((mockDb as any).$client.execute).toHaveBeenCalledTimes(1);
      expect((mockDb as any).$client.execute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO plugin_data'),
        args: expect.arrayContaining(['test-plugin', 'test-key', '{"test":"value"}']),
      });
    });

    it('should delete data from storage', async () => {
      // Create new builder with query and delete results
      const dbBuilder = Mock.db();
      dbBuilder.setQueryResult([{ key: 'test-key' }]);
      dbBuilder.setDeleteResult([{ id: 1 }]);
      const localDb = dbBuilder.build();
      const storage = new PluginDataStorageService(localDb as unknown as Database, 'test-plugin');

      const result = await storage.delete('test-key');

      expect(result).toBe(true);
      expect(localDb.select).toHaveBeenCalled();
      expect(localDb.delete).toHaveBeenCalled();
    });

    it('should check if key exists', async () => {
      const dbBuilder = Mock.db();
      const localDb = dbBuilder.build();

      // Mock the complete chain: select().from().where().limit()
      const limitMock = vi.fn().mockResolvedValue([{ key: 'test-key' }]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      localDb.select = vi.fn().mockReturnValue({ from: fromMock });

      const storage = new PluginDataStorageService(localDb as unknown as Database, 'test-plugin');

      const result = await storage.has('test-key');

      expect(result).toBe(true);
      expect(localDb.select).toHaveBeenCalledWith({ key: pluginData.key });
    });

    it('should get all keys', async () => {
      const dbBuilder = Mock.db();
      // For this query, the result is returned directly from where()
      const localDb = dbBuilder.build();
      (localDb as any).where = vi.fn().mockResolvedValue([{ key: 'key1' }, { key: 'key2' }]);
      const storage = new PluginDataStorageService(localDb as unknown as Database, 'test-plugin');

      const result = await storage.keys();

      expect(result).toEqual(['key1', 'key2']);
      expect(localDb.select).toHaveBeenCalledWith({ key: pluginData.key });
      expect(localDb.where).toHaveBeenCalledWith(eq(pluginData.pluginId, 'test-plugin'));
    });
  });

  describe('PluginConfigReaderService', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // configReader is created but not needed for tests
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should get config value', () => {
      const localConfig = Mock.config({
        PLUGIN_TEST_PLUGIN_API_KEY: 'test-api-key',
      });
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      const result = reader.get('api_key');

      expect(result).toBe('test-api-key');
    });

    it('should return default value when config not found', () => {
      const localConfig = Mock.config({});
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      const result = reader.get('non_existent', 'default-value');

      expect(result).toBe('default-value');
    });

    it('should parse JSON config values', () => {
      const localConfig = Mock.config({
        PLUGIN_TEST_PLUGIN_CONFIG: '{"enabled": true, "count": 5}',
      });
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      const result = reader.get('config');

      expect(result).toEqual({ enabled: true, count: 5 });
    });

    it('should return string value when JSON parsing fails', () => {
      const localConfig = Mock.config({
        PLUGIN_TEST_PLUGIN_INVALID_JSON: 'not-json',
      });
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      const result = reader.get('invalid_json');

      expect(result).toBe('not-json');
    });

    it('should return value when it exists', () => {
      const localConfig = Mock.config({
        PLUGIN_TEST_PLUGIN_REQUIRED: 'required-value',
      });
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      const result = reader.getOrThrow('required');

      expect(result).toBe('required-value');
    });

    it('should throw error when value does not exist', () => {
      const localConfig = Mock.config({});
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      expect(() => reader.getOrThrow('non_existent')).toThrow(
        "Plugin configuration key 'non_existent' is required but not found",
      );
    });

    it('should check if config exists', () => {
      const localConfig = Mock.config({
        PLUGIN_TEST_PLUGIN_EXISTS: 'true',
      });
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      expect(reader.has('exists')).toBe(true);
      expect(reader.has('not_exists')).toBe(false);
    });

    it('should fallback to underscore variant when hyphenated key not found', () => {
      const localConfig = Mock.config({
        PLUGIN_TEST_PLUGIN_FOO_BAR: 'ok',
      });
      const reader = new PluginConfigReaderService(localConfig, 'test-plugin');

      const value = reader.get('foo_bar');
      expect(value).toBe('ok');
    });
  });

  describe('PluginContextService', () => {
    it('should create context with components', () => {
      const mockConfig = new PluginConfigReaderService(mockConfigService, 'test-plugin');
      const mockData = new PluginDataStorageService(mockDb as unknown as Database, 'test-plugin');

      const mockRegistryService = { register: vi.fn(), unregister: vi.fn() } as any;
      const mockSignalBus = {
        connect: vi.fn().mockReturnValue(() => {}),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as any;

      const context = new PluginContextService(
        'test-plugin',
        mockConfig,
        mockData,
        mockRegistryService,
        mockSignalBus,
      );

      expect(context).toBeDefined();
      expect(context.pluginId).toBe('test-plugin');
      expect(context.config).toBe(mockConfig);
      expect(context.data).toBe(mockData);
      expect(context.registry).toBeDefined();
      expect(context.signals).toBeDefined();
      expect(context.logger).toBeDefined();
    });

    it('should track and cleanup registrations', () => {
      const mockConfig = new PluginConfigReaderService(mockConfigService, 'test-plugin');
      const mockData = new PluginDataStorageService(mockDb as unknown as Database, 'test-plugin');
      const mockRegistryService = {
        register: vi.fn(),
        unregister: vi.fn().mockReturnValue(true),
      } as any;
      const mockDisconnect = vi.fn();
      const mockSignalBus = {
        connect: vi.fn().mockReturnValue(mockDisconnect),
        subscribe: vi.fn().mockReturnValue(mockDisconnect),
      } as any;

      const context = new PluginContextService(
        'test-plugin',
        mockConfig,
        mockData,
        mockRegistryService,
        mockSignalBus,
      );

      // Register provider
      context.registry.register('p1', () => 1);
      expect(mockRegistryService.register).toHaveBeenCalledWith(
        'p1',
        expect.any(Function),
        undefined,
      );

      // Register signals
      context.signals.connect({} as any, () => ({}));
      expect(mockSignalBus.connect).toHaveBeenCalled();

      // Cleanup
      context.cleanupRegistrations();
      expect(mockRegistryService.unregister).toHaveBeenCalledWith('p1');
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
