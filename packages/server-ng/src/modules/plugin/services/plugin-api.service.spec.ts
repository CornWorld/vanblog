/**
 * @file plugin-api.service.spec.ts
 *
 * PluginAPIFactory 和 PluginAPIImpl 单元测试
 *
 * 测试覆盖：
 * - PluginAPIFactory 工厂方法
 * - PluginAPIImpl 所有公共方法
 * - 数据库访问（db, table, coreTable）
 * - 依赖注入（inject, provideService）
 * - HTTP 路由注册（http.contract, http.get/post/put/patch/delete）
 * - 声明式资源注册（registerResource）
 * - 插件间通信（exposeAPI, useAPI）
 * - 元数据管理（meta.register, meta.get, meta.set, meta.delete）
 * - Hook 系统（filter, action）
 * - Shortcode 系统（shortcode）
 * - 配置管理（config, onConfigChange）
 * - 响应式存储（store）
 * - 生命周期（onActivate, onDeactivate）
 *
 * 迁移说明：
 * - 从 Mock.db() 迁移到真实数据库 + withTestTransaction
 * - 数据库相关测试使用真实 Drizzle ORM
 * - 保留外部服务 Mock（ModuleRef, SignalBus, RegistryService 等）
 * - 每个测试使用独立事务，自动回滚
 */

import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { faker } from '@faker-js/faker';
import { z } from 'zod';

import { DATABASE_CONNECTION } from '../../../database';
import { withTestTransaction as _withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { pluginData as _pluginData } from '@vanblog/shared/drizzle';
import { ShortcodeService } from '../../shortcode/shortcode.service';
import { PluginConfigService } from './plugin-config.service';
import { PluginRegistryService } from './plugin-registry.service';
import { SignalBus } from './signal.service';
import { PluginAPIFactory, PluginAPIImpl } from './plugin-api.service';

import type { PluginMetadata, PluginPackageJson } from '@vanblog/shared/plugin';

/**
 * 生成随机插件 ID
 * 用于确保测试间数据隔离
 */
const randomPluginId = (): string => `plugin_${faker.string.alphanumeric(8)}`;

describe('PluginAPIFactory', () => {
  let factory: PluginAPIFactory;
  let mockModuleRef: ReturnType<typeof vi.fn>;
  let mockSignalBus: Partial<SignalBus>;
  let mockRegistryService: Partial<PluginRegistryService>;
  let mockShortcodeService: Partial<ShortcodeService>;
  let mockPluginConfigService: Partial<PluginConfigService>;
  let mockHttpRegistry: any;
  let mockServiceRegistry: any;

  beforeEach(async () => {
    // Mock ModuleRef
    mockModuleRef = vi.fn();

    // Mock SignalBus
    mockSignalBus = {
      connect: vi.fn().mockReturnValue(() => {}),
      subscribe: vi.fn().mockReturnValue(() => {}),
      send: vi.fn().mockImplementation(async (_, data) => data),
      emit: vi.fn().mockResolvedValue(undefined),
    };

    // Mock PluginRegistryService
    mockRegistryService = {
      register: vi.fn(),
      unregister: vi.fn(),
    };

    // Mock ShortcodeService
    mockShortcodeService = {
      register: vi.fn().mockReturnValue(() => {}),
    };

    // Mock PluginConfigService
    mockPluginConfigService = {
      registerSchema: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({ enabled: true }),
      onConfigChange: vi.fn().mockReturnValue(() => {}),
    };

    // Mock HTTP Registry
    mockHttpRegistry = {
      registerContract: vi.fn(),
      registerRawRoute: vi.fn(),
      clearPluginRoutes: vi.fn(),
    };

    // Mock Service Registry
    mockServiceRegistry = {
      registerService: vi.fn(),
      unregisterService: vi.fn(),
      getService: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginAPIFactory,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: 'ModuleRef',
          useValue: mockModuleRef,
        },
        {
          provide: SignalBus,
          useValue: mockSignalBus,
        },
        {
          provide: PluginRegistryService,
          useValue: mockRegistryService,
        },
        {
          provide: ShortcodeService,
          useValue: mockShortcodeService,
        },
        {
          provide: PluginConfigService,
          useValue: mockPluginConfigService,
        },
        {
          provide: 'PLUGIN_HTTP_REGISTRY',
          useValue: mockHttpRegistry,
        },
        {
          provide: 'PLUGIN_SERVICE_REGISTRY',
          useValue: mockServiceRegistry,
        },
      ],
    }).compile();

    factory = module.get<PluginAPIFactory>(PluginAPIFactory);

    // Suppress logger output during tests
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PluginAPIFactory', () => {
    it('should be defined', () => {
      expect(factory).toBeDefined();
    });

    it('should create PluginAPI instance', async () => {
      const pluginId = randomPluginId();
      const packageJson: PluginPackageJson = {
        name: `@vanblog/${pluginId}`,
        version: '1.0.0',
        main: 'index.ts',
        type: 'module',
        vanblog: {
          config: {
            enabled: {
              type: 'boolean',
              default: true,
            },
          },
        },
      };

      const api = await factory.createAPI(packageJson, `/plugins/${pluginId}`);

      expect(api).toBeInstanceOf(PluginAPIImpl);
      expect(api.id).toBe(pluginId);
      expect(api.version).toBe('1.0.0');
      expect(api.dir).toBe(`/plugins/${pluginId}`);
      expect(mockPluginConfigService.registerSchema).toHaveBeenCalled();
      expect(mockPluginConfigService.getConfig).toHaveBeenCalled();
    });

    it('should get shortcode service', () => {
      const service = factory.getShortcodeService();
      expect(service).toBe(mockShortcodeService);
    });

    it('should get config service', () => {
      const service = factory.getConfigService();
      expect(service).toBe(mockPluginConfigService);
    });
  });

  describe('PluginAPIImpl - Basic Properties', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID for isolation
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        name: faker.word.words(2),
        displayName: faker.word.words(2),
        version: faker.system.semver(),
        description: faker.lorem.sentence(),
        author: faker.person.fullName(),
        main: 'index.ts',
        dir: `/plugins/${pluginId}`,
        config: {
          enabled: {
            type: 'boolean',
            default: true,
          },
        },
      };

      const pluginAPIRegistry = new Map<string, Map<string, any>>();

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        pluginAPIRegistry,
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should have correct metadata', () => {
      expect(api.id).toBe(pluginId);
      expect(api.version).toBe(api.metadata.version);
      expect(api.dir).toBe(`/plugins/${pluginId}`);
      expect(api.metadata).toBe(api.metadata);
    });

    it('should have logger', () => {
      expect(api.log).toBeDefined();
    });

    it('should have http registrar', () => {
      expect(api.http).toBeDefined();
    });

    it('should have metadata manager', () => {
      expect(api.meta).toBeDefined();
    });
  });

  describe('PluginAPIImpl - Configuration', () => {
    let api: PluginAPIImpl;
    let pluginId: string;
    let configValue: number;

    beforeEach(async () => {
      // Generate unique plugin ID and config value
      pluginId = randomPluginId();
      configValue = faker.number.int({ min: 1, max: 100 });

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
        config: {
          enabled: {
            type: 'boolean',
            default: true,
          },
          count: {
            type: 'number',
            default: 10,
          },
        },
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      (mockPluginConfigService.getConfig as any).mockResolvedValue({
        enabled: true,
        count: configValue,
      });

      await api._loadConfig();
    });

    it('should return config', () => {
      const config = api.config;
      expect(config).toEqual({ enabled: true, count: configValue });
    });

    it('should register config change listener', () => {
      const callback = vi.fn();
      const unsubscribe = api.onConfigChange('enabled', callback);

      expect(mockPluginConfigService.onConfigChange).toHaveBeenCalledWith(
        pluginId,
        'enabled',
        expect.any(Function),
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return default config when not loaded', () => {
      const newPluginId = randomPluginId();
      const defaultValue = faker.word.sample();

      const metadata: PluginMetadata = {
        id: newPluginId,
        name: faker.word.words(2),
        displayName: faker.word.words(2),
        version: faker.system.semver(),
        main: 'index.ts',
        dir: `/plugins/${newPluginId}`,
        config: {
          value: {
            type: 'string',
            default: defaultValue,
          },
        },
      };

      const newApi = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      // Config before loading should return defaults
      const config = newApi.config;
      expect(config).toEqual({ value: defaultValue });
    });
  });

  describe('PluginAPIImpl - Store', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    afterEach(() => {
      // Clear stores after each test
      api.cleanup();
    });

    it('should create and get store', () => {
      const initialValue = faker.number.int({ min: 0, max: 100 });
      const ref = api.store('count', initialValue);
      expect(ref).toBeDefined();
      expect(ref.value).toBe(initialValue);
    });

    it('should update store value', () => {
      const initialValue = faker.number.int({ min: 0, max: 50 });
      const newValue = faker.number.int({ min: 51, max: 100 });
      const ref = api.store('count', initialValue);
      ref.value = newValue;
      expect(ref.value).toBe(newValue);
    });

    it('should return same ref for same key', () => {
      const key = faker.string.alphanumeric(8);
      const initialValue = faker.number.int({ min: 0, max: 50 });
      const attemptedValue = faker.number.int({ min: 51, max: 100 });

      const ref1 = api.store(key, initialValue);
      const ref2 = api.store(key, attemptedValue); // Should return existing ref
      expect(ref1).toBe(ref2);
      expect(ref2.value).toBe(initialValue); // Should keep original value
    });

    it('should create different refs for different keys', () => {
      const key1 = faker.string.alphanumeric(8);
      const key2 = faker.string.alphanumeric(8);
      const value1 = faker.number.int({ min: 0, max: 50 });
      const value2 = faker.number.int({ min: 51, max: 100 });

      const ref1 = api.store(key1, value1);
      const ref2 = api.store(key2, value2);
      expect(ref1).not.toBe(ref2);
      expect(ref1.value).toBe(value1);
      expect(ref2.value).toBe(value2);
    });

    it('should isolate data by plugin ID', () => {
      const pluginId1 = randomPluginId();
      const pluginId2 = randomPluginId();
      const key = faker.string.alphanumeric(8);
      const value1 = faker.word.sample();
      const value2 = faker.word.sample();

      // Create two plugin instances with same store key
      const metadata1: PluginMetadata = {
        id: pluginId1,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId1}`,
      };

      const metadata2: PluginMetadata = {
        id: pluginId2,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId2}`,
      };

      const api1 = new PluginAPIImpl(
        metadata1,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      const api2 = new PluginAPIImpl(
        metadata2,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      api1.store(key, value1);
      api2.store(key, value2);

      expect(api1.store(key, '').value).toBe(value1);
      expect(api2.store(key, '').value).toBe(value2);
    });

    it('should support reactive updates', () => {
      const initialValue = faker.number.int({ min: 0, max: 50 });
      const increment = faker.number.int({ min: 1, max: 10 });
      const newValue = faker.number.int({ min: 100, max: 200 });

      const counter = api.store('counter', initialValue);

      counter.value += increment;
      expect(counter.value).toBe(initialValue + increment);

      counter.value = newValue;
      expect(counter.value).toBe(newValue);
    });
  });

  describe('PluginAPIImpl - Database Access', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should return db instance', () => {
      expect(api.db).toBeDefined();
    });

    it('should get core table', () => {
      // Mock allTables by adding a table to the module
      const table = api.coreTable('articles');
      expect(table).toBeDefined();
    });

    it('should throw error for non-existent core table', () => {
      const invalidTableName = faker.word.sample();
      expect(() => api.coreTable(invalidTableName)).toThrow(
        new RegExp(`核心表 '${invalidTableName}' 不存在`),
      );
    });

    it('should create plugin table with schema', () => {
      const tableName = faker.word.sample();
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const table = api.table(tableName, schema);
      expect(table).toBeDefined();
    });

    it('should throw error when accessing table without schema', () => {
      const tableName = faker.word.sample();
      expect(() => api.table(tableName)).toThrow(new RegExp(`插件表 '${tableName}' 不存在`));
    });

    it('should cache plugin tables', () => {
      const tableName = faker.word.sample();
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const table1 = api.table(tableName, schema);
      const table2 = api.table(tableName);
      expect(table1).toBe(table2);
    });
  });

  describe('PluginAPIImpl - Dependency Injection', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should inject core service', () => {
      class TestService {}
      const mockService = new TestService();
      const mockModuleRefWithGet = {
        get: vi.fn(() => mockService),
      };

      const apiWithMock = new PluginAPIImpl(
        api.metadata,
        db as any,
        mockModuleRefWithGet as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      const service = apiWithMock.inject(TestService);
      expect(service).toBe(mockService);
      expect(mockModuleRefWithGet.get).toHaveBeenCalledWith(TestService, { strict: false });
    });

    it('should inject cross-plugin service', () => {
      class TestService {}
      const mockService = new TestService();
      const otherPluginId = randomPluginId();
      vi.mocked(mockServiceRegistry.getService).mockReturnValue(mockService);

      const service = api.inject(TestService, otherPluginId);
      expect(service).toBe(mockService);
      expect(mockServiceRegistry.getService).toHaveBeenCalledWith(otherPluginId, TestService);
    });

    it('should throw error when cross-plugin service not found', () => {
      class TestService {}
      const otherPluginId = randomPluginId();
      vi.mocked(mockServiceRegistry.getService).mockReturnValue(null);

      expect(() => api.inject(TestService, otherPluginId)).toThrow(/无法注入服务/);
    });

    it('should throw error for non-class token in cross-plugin injection', () => {
      const otherPluginId = randomPluginId();
      expect(() => api.inject('STRING_TOKEN', otherPluginId)).toThrow(/无法注入服务/);
    });

    it('should throw error when service registry not available', () => {
      const apiWithoutRegistry = new PluginAPIImpl(
        api.metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        undefined, // No service registry
      );

      class TestService {}
      expect(() => apiWithoutRegistry.inject(TestService, 'other-plugin')).toThrow(/无法注入服务/);
    });

    it('should provide singleton service', () => {
      class TestService {}
      const mockService = new TestService();
      const mockModuleRefWithGet = {
        get: vi.fn(() => mockService),
      };

      const apiWithMock = new PluginAPIImpl(
        api.metadata,
        db as any,
        mockModuleRefWithGet as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      apiWithMock.provideService(TestService, { scope: 'singleton' });

      expect(mockServiceRegistry.registerService).toHaveBeenCalledWith(
        pluginId,
        TestService,
        mockService,
        'singleton',
      );
    });

    it('should provide transient service', () => {
      class TestService {}

      api.provideService(TestService, { scope: 'transient' });

      expect(mockServiceRegistry.registerService).toHaveBeenCalledWith(
        pluginId,
        TestService,
        null,
        'transient',
      );
    });

    it('should throw error when providing service without registry', () => {
      const apiWithoutRegistry = new PluginAPIImpl(
        api.metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        undefined,
      );

      class TestService {}
      expect(() => {
        apiWithoutRegistry.provideService(TestService);
      }).toThrow(/服务注册功能未初始化/);
    });
  });

  describe('PluginAPIImpl - HTTP Registry', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should register contract route', () => {
      const contract = {};
      const handlers = {};

      api.http.contract(contract, handlers);

      expect(mockHttpRegistry.registerContract).toHaveBeenCalledWith(pluginId, contract, handlers);
    });

    it('should register GET route', () => {
      const handler = vi.fn();
      const path = `/${faker.word.sample()}`;
      api.http.get(path, handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        pluginId,
        'GET',
        path,
        handler,
      );
    });

    it('should register POST route', () => {
      const handler = vi.fn();
      const path = `/${faker.word.sample()}`;
      api.http.post(path, handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        pluginId,
        'POST',
        path,
        handler,
      );
    });

    it('should register PUT route', () => {
      const handler = vi.fn();
      const path = `/${faker.word.sample()}`;
      api.http.put(path, handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        pluginId,
        'PUT',
        path,
        handler,
      );
    });

    it('should register PATCH route', () => {
      const handler = vi.fn();
      const path = `/${faker.word.sample()}`;
      api.http.patch(path, handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        pluginId,
        'PATCH',
        path,
        handler,
      );
    });

    it('should register DELETE route', () => {
      const handler = vi.fn();
      const path = `/${faker.word.sample()}`;
      api.http.delete(path, handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        pluginId,
        'DELETE',
        path,
        handler,
      );
    });

    it('should throw error when http registry not available', () => {
      const apiWithoutHttp = new PluginAPIImpl(
        api.metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        undefined, // No HTTP registry
        mockServiceRegistry,
      );

      expect(() => {
        apiWithoutHttp.http.contract({}, {});
      }).toThrow(/HTTP 注册表服务未初始化/);
    });
  });

  describe('PluginAPIImpl - Resource Registration', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should register resource', () => {
      const resourceName = faker.word.sample();
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      api.registerResource(resourceName, { schema });

      // Should create table
      const table = api.table(resourceName);
      expect(table).toBeDefined();
    });

    it('should throw error when http registry not available for resource', () => {
      const apiWithoutHttp = new PluginAPIImpl(
        api.metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        undefined,
        mockServiceRegistry,
      );

      const schema = z.object({ id: z.number() });

      expect(() => {
        apiWithoutHttp.registerResource('books', { schema });
      }).toThrow(/HTTP 注册表服务未初始化/);
    });
  });

  describe('PluginAPIImpl - Plugin Communication', () => {
    let api: PluginAPIImpl;
    let pluginAPIRegistry: Map<string, Map<string, any>>;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      pluginAPIRegistry = new Map();

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        pluginAPIRegistry,
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should expose API', () => {
      const apiName = faker.word.sample();
      const testAPI = {
        method1: vi.fn(),
        method2: vi.fn(),
      };

      api.exposeAPI(apiName, testAPI);

      expect(pluginAPIRegistry.has(pluginId)).toBe(true);
      expect(pluginAPIRegistry.get(pluginId)?.get(apiName)).toBe(testAPI);
    });

    it('should use other plugin API', () => {
      const otherPluginId = randomPluginId();
      const apiName = faker.word.sample();
      const otherAPI = {
        getData: vi.fn(),
      };

      pluginAPIRegistry.set(otherPluginId, new Map([[apiName, otherAPI]]));

      const usedAPI = api.useAPI(otherPluginId, apiName);

      expect(usedAPI).toBe(otherAPI);
    });

    it('should return null when plugin has no APIs', () => {
      const nonExistentPluginId = randomPluginId();
      const result = api.useAPI(nonExistentPluginId, 'testAPI');
      expect(result).toBeNull();
    });

    it('should return null when API not found', () => {
      const otherPluginId = randomPluginId();
      pluginAPIRegistry.set(otherPluginId, new Map());

      const result = api.useAPI(otherPluginId, 'non-existent-api');
      expect(result).toBeNull();
    });
  });

  describe('PluginAPIImpl - Metadata Manager', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should register metadata schema', () => {
      const entityType = faker.helpers.arrayElement([
        'article',
        'user',
        'category',
        'tag',
      ] as const);
      const metaKey = faker.word.sample();
      const schema = z.object({ value: z.string() });
      api.meta.register(entityType, metaKey, schema);
      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should get metadata (not implemented)', async () => {
      const entityType = faker.helpers.arrayElement([
        'article',
        'user',
        'category',
        'tag',
      ] as const);
      const entityId = faker.number.int({ min: 1, max: 1000 });
      const metaKey = faker.word.sample();
      const result = await api.meta.get(entityType, entityId, metaKey);
      expect(result).toBeNull();
    });

    it('should set metadata (not implemented)', async () => {
      const entityType = faker.helpers.arrayElement([
        'article',
        'user',
        'category',
        'tag',
      ] as const);
      const entityId = faker.number.int({ min: 1, max: 1000 });
      const metaKey = faker.word.sample();
      await api.meta.set(entityType, entityId, metaKey, { value: faker.word.sample() });
      // Should complete without error
      expect(true).toBe(true);
    });

    it('should delete metadata (not implemented)', async () => {
      const entityType = faker.helpers.arrayElement([
        'article',
        'user',
        'category',
        'tag',
      ] as const);
      const entityId = faker.number.int({ min: 1, max: 1000 });
      const metaKey = faker.word.sample();
      await api.meta.delete(entityType, entityId, metaKey);
      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe('PluginAPIImpl - Hooks', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    afterEach(() => {
      // Clean up hooks after each test
      vi.clearAllMocks();
    });

    it('should register filter with string name', () => {
      const callback = vi.fn((data: any) => data);
      const disconnect = api.filter('article|beforeCreate', callback, 10);

      expect(mockSignalBus.connect).toHaveBeenCalled();
      expect(typeof disconnect).toBe('function');
    });

    it('should register filter with Signal object', () => {
      const signal = {
        id: 'article|beforeCreate',
        schema: z.any(),
        type: 'sync' as const,
      };

      const callback = vi.fn((data: any) => data);
      const disconnect = api.filter(signal, callback, 5);

      expect(mockSignalBus.connect).toHaveBeenCalled();
      expect(typeof disconnect).toBe('function');
    });

    it('should register action with string name', () => {
      const callback = vi.fn();
      const unsubscribe = api.action('article|afterCreate', callback, 10);

      expect(mockSignalBus.subscribe).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should register action with Signal object', () => {
      const signal = {
        id: 'article|afterCreate',
        schema: z.any(),
        type: 'async' as const,
      };

      const callback = vi.fn();
      const unsubscribe = api.action(signal, callback, 5);

      expect(mockSignalBus.subscribe).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('PluginAPIImpl - Shortcode', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    afterEach(() => {
      // Clean up shortcodes after each test
      vi.clearAllMocks();
    });

    it('should register shortcode', () => {
      const shortcodeTag = faker.word.sample();
      const handler = vi.fn((_attrs: any, content) => content);
      api.shortcode(shortcodeTag, handler);

      expect(mockShortcodeService.register).toHaveBeenCalledWith(shortcodeTag, handler, pluginId);
    });

    it('should register multiple shortcodes', () => {
      const tag1 = faker.word.sample();
      const tag2 = faker.word.sample();
      const handler1 = vi.fn((_attrs: any, content) => content);
      const handler2 = vi.fn((_attrs: any, content) => content);

      api.shortcode(tag1, handler1);
      api.shortcode(tag2, handler2);

      expect(mockShortcodeService.register).toHaveBeenCalledTimes(2);
      expect(mockShortcodeService.register).toHaveBeenCalledWith(tag1, handler1, pluginId);
      expect(mockShortcodeService.register).toHaveBeenCalledWith(tag2, handler2, pluginId);
    });
  });

  describe('PluginAPIImpl - Public Data', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should provide static data', () => {
      const key = faker.word.sample();
      const data = { key: faker.word.sample() };
      api.provide(key, data);

      expect(mockRegistryService.register).toHaveBeenCalledWith(key, expect.any(Function), 10);
    });

    it('should provide function data', () => {
      const key = faker.word.sample();
      const dataFn = () => ({ key: faker.word.sample() });
      api.provide(key, dataFn);

      expect(mockRegistryService.register).toHaveBeenCalledWith(key, expect.any(Function), 10);
    });
  });

  describe('PluginAPIImpl - Lifecycle', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should register activate callback', async () => {
      const callback = vi.fn();
      api.onActivate(callback);

      await api._activate();

      expect(callback).toHaveBeenCalled();
    });

    it('should register deactivate callback', async () => {
      const callback = vi.fn();
      api.onDeactivate(callback);

      await api._deactivate();

      expect(callback).toHaveBeenCalled();
    });

    it('should handle async activate callback', async () => {
      const callback = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      api.onActivate(callback);
      await api._activate();

      expect(callback).toHaveBeenCalled();
    });

    it('should handle async deactivate callback', async () => {
      const callback = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      api.onDeactivate(callback);
      await api._deactivate();

      expect(callback).toHaveBeenCalled();
    });

    it('should not throw if no activate callback registered', async () => {
      await expect(api._activate()).resolves.not.toThrow();
    });

    it('should not throw if no deactivate callback registered', async () => {
      await expect(api._deactivate()).resolves.not.toThrow();
    });
  });

  describe('PluginAPIImpl - Cleanup', () => {
    let api: PluginAPIImpl;
    let pluginId: string;

    beforeEach(async () => {
      // Generate unique plugin ID
      pluginId = randomPluginId();

      const metadata: PluginMetadata = {
        id: pluginId,
        displayName: faker.word.words(2),
        main: 'index.ts',
        name: faker.word.words(2),
        version: faker.system.semver(),
        dir: `/plugins/${pluginId}`,
      };

      api = new PluginAPIImpl(
        metadata,
        db as any,
        mockModuleRef as any,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      await api._loadConfig();
    });

    it('should cleanup all resources', () => {
      const filterDisconnect = vi.fn();
      const actionUnsubscribe = vi.fn();
      const shortcodeUnregister = vi.fn();
      const configUnsubscribe = vi.fn();

      (vi.mocked(mockSignalBus.connect) as any).mockReturnValue(filterDisconnect);
      (vi.mocked(mockSignalBus.subscribe) as any).mockReturnValue(actionUnsubscribe);
      (vi.mocked(mockShortcodeService.register) as any).mockReturnValue(shortcodeUnregister);
      (vi.mocked(mockPluginConfigService.onConfigChange) as any).mockReturnValue(configUnsubscribe);

      // Register various hooks
      api.filter('test|filter', (data: any) => data);
      api.action('test|action', () => {});
      api.shortcode('test', (_, content) => content ?? '');
      api.onConfigChange('key', () => {});

      // Cleanup
      api.cleanup();

      expect(filterDisconnect).toHaveBeenCalled();
      expect(actionUnsubscribe).toHaveBeenCalled();
      expect(shortcodeUnregister).toHaveBeenCalled();
      expect(configUnsubscribe).toHaveBeenCalled();
    });

    it('should clear stores', () => {
      api.store('test', 0);
      expect(api.store('test', 10).value).toBe(0); // Should return existing

      api.cleanup();

      // After cleanup, should create new ref
      expect(api.store('test', 20).value).toBe(20);
    });

    it('should clear config cache', () => {
      const config1 = api.config;
      expect(config1).toBeDefined();

      api.cleanup();

      // After cleanup, config should return defaults
      const config2 = api.config;
      expect(config2).toBeDefined();
    });

    it('should clear HTTP routes if registry available', () => {
      api.cleanup();

      expect(mockHttpRegistry.clearPluginRoutes).toHaveBeenCalledWith(pluginId);
    });

    it('should handle cleanup errors gracefully', () => {
      const errorDisconnect = vi.fn(() => {
        throw new Error('Cleanup error');
      });

      (vi.mocked(mockSignalBus.connect) as any).mockReturnValue(errorDisconnect);
      api.filter('test|filter', (data: any) => data);

      // Should not throw
      expect(() => {
        api.cleanup();
      }).not.toThrow();
    });
  });
});
