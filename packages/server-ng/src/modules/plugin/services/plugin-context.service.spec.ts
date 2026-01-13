import { Test, type TestingModule } from '@nestjs/testing';
import { pluginData } from '@vanblog/shared/drizzle';
import { eq, and } from 'drizzle-orm';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ConfigService } from '../../../config/config.service';
import { DATABASE_CONNECTION, type Database } from '../../../database';
import { Mock } from '@test/mock';
import { withTestTransaction } from '@test/utils/db-transaction-helper';

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

  beforeEach(async () => {
    // Create ConfigService mock using MockUtils
    mockConfigService = Mock.config({
      'plugin.test.config.key': 'test-value',
      'plugin.test.config.json': '{"nested": "value"}',
    });

    // Import db from test setup
    const { db } = await import('@test/setup.unit');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginContextFactory,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
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
    it('should get data by key', async () => {
      const { db } = await import('@test/setup.unit');

      await withTestTransaction(db, async (tx) => {
        const testData = { foo: 'bar' };

        // WORKAROUND: Drizzle doesn't call toDriver() for jsonb() in INSERT context
        // Insert test data - manually stringify for now
        await tx.insert(pluginData).values({
          pluginId: 'test-plugin',
          key: 'test-key',
          value: JSON.stringify(testData),
        });

        // Create storage service with transaction database
        const storage = new PluginDataStorageService(tx as unknown as Database, 'test-plugin');

        // Test getting data by key
        const result = await storage.get('test-key');

        // Verify the result - fromDriver() should deserialize
        expect(result).toEqual(testData);

        // Verify database persistence
        const [savedData] = await (tx
          .select()
          .from(pluginData)
          .where(
            and(eq(pluginData.pluginId, 'test-plugin'), eq(pluginData.key, 'test-key')),
          ) as any);

        expect(savedData).toBeDefined();
        // NOTE: In test environment, fromDriver() may not be called
        // Database stores as string, expecting string in test
        expect(savedData.value).toBe('{"foo":"bar"}');
      });
    });

    it('should return null for non-existent key', async () => {
      const { db } = await import('@test/setup.unit');

      await withTestTransaction(db, async (tx) => {
        const storage = new PluginDataStorageService(tx as unknown as Database, 'test-plugin');

        const result = await storage.get('non-existent');

        expect(result).toBeNull();
      });
    });

    it('should set data in storage using single UPSERT', async () => {
      const { db } = await import('@test/setup.unit');
      const testData = { test: 'value' };

      await withTestTransaction(db, async (tx) => {
        const storage = new PluginDataStorageService(tx as unknown as Database, 'test-plugin');

        // Test setting data
        await storage.set('test-key', testData);

        // Verify database persistence
        const [savedData] = await tx
          .select()
          .from(pluginData)
          .where(and(eq(pluginData.pluginId, 'test-plugin'), eq(pluginData.key, 'test-key')));

        expect(savedData).toBeDefined();
        expect(savedData.pluginId).toBe('test-plugin');
        expect(savedData.key).toBe('test-key');
        // Service manually stringifies, SELECT fromDriver() returns string
        // (Drizzle bug: toDriver() not called in INSERT/UPSERT)
        expect(savedData.value).toBe('{"test":"value"}');
      });
    });

    it('should delete data from storage', async () => {
      const { db } = await import('@test/setup.unit');

      await withTestTransaction(db, async (tx) => {
        // WORKAROUND: Drizzle doesn't call toDriver() for jsonb() in INSERT context
        // Insert test data - manually stringify
        await tx.insert(pluginData).values({
          pluginId: 'test-plugin',
          key: 'test-key',
          value: JSON.stringify({ test: 'value' }),
        });

        const storage = new PluginDataStorageService(tx as unknown as Database, 'test-plugin');

        // Test deleting data
        const result = await storage.delete('test-key');

        expect(result).toBe(true);

        // Verify deletion
        const [deletedData] = await tx
          .select()
          .from(pluginData)
          .where(and(eq(pluginData.pluginId, 'test-plugin'), eq(pluginData.key, 'test-key')));

        expect(deletedData).toBeUndefined();
      });
    });

    it('should check if key exists', async () => {
      const { db } = await import('@test/setup.unit');

      await withTestTransaction(db, async (tx) => {
        // First, insert test data
        await tx.insert(pluginData).values({
          pluginId: 'test-plugin',
          key: 'test-key',
          value: '{"test":"value"}',
        });

        const storage = new PluginDataStorageService(tx as unknown as Database, 'test-plugin');

        // Test checking if key exists
        const result = await storage.has('test-key');

        expect(result).toBe(true);

        // Test checking non-existent key
        const notExists = await storage.has('non-existent');
        expect(notExists).toBe(false);
      });
    });

    it('should get all keys', async () => {
      const { db } = await import('@test/setup.unit');

      await withTestTransaction(db, async (tx) => {
        // Insert multiple test data
        await tx.insert(pluginData).values([
          {
            pluginId: 'test-plugin',
            key: 'key1',
            value: '{"test":"value1"}',
          },
          {
            pluginId: 'test-plugin',
            key: 'key2',
            value: '{"test":"value2"}',
          },
        ]);

        const storage = new PluginDataStorageService(tx as unknown as Database, 'test-plugin');

        // Test getting all keys
        const result = await storage.keys();

        expect(result).toEqual(['key1', 'key2']);
      });
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

      const mockRegistryService = { register: vi.fn(), unregister: vi.fn() } as any;
      const mockSignalBus = {
        connect: vi.fn().mockReturnValue(() => {}),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as any;

      // Create a mock database instance
      const mockDb = {} as any;

      const context = new PluginContextService(
        'test-plugin',
        mockConfig,
        new PluginDataStorageService(mockDb, 'test-plugin'),
        mockRegistryService,
        mockSignalBus,
      );

      expect(context).toBeDefined();
      expect(context.pluginId).toBe('test-plugin');
      expect(context.config).toBe(mockConfig);
      expect(context.data).toBeInstanceOf(PluginDataStorageService);
      expect(context.registry).toBeDefined();
      expect(context.signals).toBeDefined();
      expect(context.logger).toBeDefined();
    });

    it('should track and cleanup registrations', () => {
      const mockConfig = new PluginConfigReaderService(mockConfigService, 'test-plugin');
      const mockRegistryService = {
        register: vi.fn(),
        unregister: vi.fn().mockReturnValue(true),
      } as any;
      const mockDisconnect = vi.fn();
      const mockSignalBus = {
        connect: vi.fn().mockReturnValue(mockDisconnect),
        subscribe: vi.fn().mockReturnValue(mockDisconnect),
      } as any;

      // Create a mock database instance
      const mockDb = {} as any;

      const context = new PluginContextService(
        'test-plugin',
        mockConfig,
        new PluginDataStorageService(mockDb, 'test-plugin'),
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
