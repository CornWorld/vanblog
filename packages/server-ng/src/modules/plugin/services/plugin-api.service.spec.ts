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
 */

import { Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { z } from 'zod';

import { DATABASE_CONNECTION } from '../../../database';
import { ShortcodeService } from '../../shortcode/shortcode.service';
import { PluginConfigService } from './plugin-config.service';
import { PluginRegistryService } from './plugin-registry.service';
import { SignalBus } from './signal.service';
import { PluginAPIFactory, PluginAPIImpl } from './plugin-api.service';

import type { PluginMetadata, PluginPackageJson } from '@vanblog/shared/plugin';
import type { Database } from '../../../database/connection';

describe('PluginAPIFactory', () => {
  let factory: PluginAPIFactory;
  let mockDb: Partial<Database>;
  let mockModuleRef: Partial<ModuleRef>;
  let mockSignalBus: Partial<SignalBus>;
  let mockRegistryService: Partial<PluginRegistryService>;
  let mockShortcodeService: Partial<ShortcodeService>;
  let mockPluginConfigService: Partial<PluginConfigService>;
  let mockHttpRegistry: any;
  let mockServiceRegistry: any;

  beforeEach(async () => {
    // Mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    } as any;

    // Mock ModuleRef
    mockModuleRef = {
      get: vi.fn(),
    };

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
          useValue: mockDb,
        },
        {
          provide: ModuleRef,
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
      const packageJson: PluginPackageJson = {
        name: '@vanblog/test-plugin',
        version: '1.0.0',
        vanblog: {
          config: {
            enabled: {
              type: 'boolean',
              default: true,
            },
          },
        },
      };

      const api = await factory.createAPI(packageJson, '/plugins/test-plugin');

      expect(api).toBeInstanceOf(PluginAPIImpl);
      expect(api.id).toBe('test-plugin');
      expect(api.version).toBe('1.0.0');
      expect(api.dir).toBe('/plugins/test-plugin');
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
    let metadata: PluginMetadata;

    beforeEach(async () => {
      metadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        dir: '/plugins/test-plugin',
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
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      expect(api.id).toBe('test-plugin');
      expect(api.version).toBe('1.0.0');
      expect(api.dir).toBe('/plugins/test-plugin');
      expect(api.metadata).toBe(metadata);
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

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
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
        mockDb as Database,
        mockModuleRef as ModuleRef,
        mockSignalBus as SignalBus,
        mockRegistryService as PluginRegistryService,
        mockShortcodeService as ShortcodeService,
        mockPluginConfigService as PluginConfigService,
        new Map(),
        mockHttpRegistry,
        mockServiceRegistry,
      );

      (mockPluginConfigService.getConfig as Mock).mockResolvedValue({
        enabled: true,
        count: 10,
      });

      await api._loadConfig();
    });

    it('should return config', () => {
      const config = api.config;
      expect(config).toEqual({ enabled: true, count: 10 });
    });

    it('should register config change listener', () => {
      const callback = vi.fn();
      const unsubscribe = api.onConfigChange('enabled', callback);

      expect(mockPluginConfigService.onConfigChange).toHaveBeenCalledWith(
        'test-plugin',
        'enabled',
        expect.any(Function),
      );
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return default config when not loaded', () => {
      const metadata: PluginMetadata = {
        id: 'new-plugin',
        name: 'New Plugin',
        version: '1.0.0',
        dir: '/plugins/new-plugin',
        config: {
          value: {
            type: 'string',
            default: 'default-value',
          },
        },
      };

      const newApi = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      expect(config).toEqual({ value: 'default-value' });
    });
  });

  describe('PluginAPIImpl - Store', () => {
    let api: PluginAPIImpl;

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      // Mock database with $client.execute for store save
      (mockDb as any).$client = {
        execute: vi.fn().mockResolvedValue(undefined),
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

    it('should create and get store', () => {
      const ref = api.store('count', 0);
      expect(ref).toBeDefined();
      expect(ref.value).toBe(0);
    });

    it('should update store value', () => {
      const ref = api.store('count', 0);
      ref.value = 5;
      expect(ref.value).toBe(5);
    });

    it('should return same ref for same key', () => {
      const ref1 = api.store('count', 0);
      const ref2 = api.store('count', 10); // Should return existing ref
      expect(ref1).toBe(ref2);
      expect(ref2.value).toBe(0); // Should keep original value
    });

    it('should create different refs for different keys', () => {
      const ref1 = api.store('count1', 0);
      const ref2 = api.store('count2', 10);
      expect(ref1).not.toBe(ref2);
      expect(ref1.value).toBe(0);
      expect(ref2.value).toBe(10);
    });
  });

  describe('PluginAPIImpl - Database Access', () => {
    let api: PluginAPIImpl;

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      expect(api.db).toBe(mockDb);
    });

    it('should get core table', () => {
      // Mock allTables by adding a table to the module
      const table = api.coreTable('articles');
      expect(table).toBeDefined();
    });

    it('should throw error for non-existent core table', () => {
      expect(() => api.coreTable('nonExistentTable')).toThrow(/核心表 'nonExistentTable' 不存在/);
    });

    it('should create plugin table with schema', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const table = api.table('books', schema);
      expect(table).toBeDefined();
    });

    it('should throw error when accessing table without schema', () => {
      expect(() => api.table('books')).toThrow(/插件表 'books' 不存在/);
    });

    it('should cache plugin tables', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const table1 = api.table('books', schema);
      const table2 = api.table('books');
      expect(table1).toBe(table2);
    });
  });

  describe('PluginAPIImpl - Dependency Injection', () => {
    let api: PluginAPIImpl;

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      (mockModuleRef.get as Mock).mockReturnValue(mockService);

      const service = api.inject(TestService);
      expect(service).toBe(mockService);
      expect(mockModuleRef.get).toHaveBeenCalledWith(TestService, { strict: false });
    });

    it('should inject cross-plugin service', () => {
      class TestService {}
      const mockService = new TestService();
      (mockServiceRegistry.getService as Mock).mockReturnValue(mockService);

      const service = api.inject(TestService, 'other-plugin');
      expect(service).toBe(mockService);
      expect(mockServiceRegistry.getService).toHaveBeenCalledWith('other-plugin', TestService);
    });

    it('should throw error when cross-plugin service not found', () => {
      class TestService {}
      (mockServiceRegistry.getService as Mock).mockReturnValue(null);

      expect(() => api.inject(TestService, 'other-plugin')).toThrow(/无法注入服务/);
    });

    it('should throw error for non-class token in cross-plugin injection', () => {
      expect(() => api.inject('STRING_TOKEN', 'other-plugin')).toThrow(/无法注入服务/);
    });

    it('should throw error when service registry not available', () => {
      const apiWithoutRegistry = new PluginAPIImpl(
        api.metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      (mockModuleRef.get as Mock).mockReturnValue(mockService);

      api.provideService(TestService, { scope: 'singleton' });

      expect(mockServiceRegistry.registerService).toHaveBeenCalledWith(
        'test-plugin',
        TestService,
        mockService,
        'singleton',
      );
    });

    it('should provide transient service', () => {
      class TestService {}

      api.provideService(TestService, { scope: 'transient' });

      expect(mockServiceRegistry.registerService).toHaveBeenCalledWith(
        'test-plugin',
        TestService,
        null,
        'transient',
      );
    });

    it('should throw error when providing service without registry', () => {
      const apiWithoutRegistry = new PluginAPIImpl(
        api.metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

      expect(mockHttpRegistry.registerContract).toHaveBeenCalledWith(
        'test-plugin',
        contract,
        handlers,
      );
    });

    it('should register GET route', () => {
      const handler = vi.fn();
      api.http.get('/test', handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'GET',
        '/test',
        handler,
      );
    });

    it('should register POST route', () => {
      const handler = vi.fn();
      api.http.post('/test', handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'POST',
        '/test',
        handler,
      );
    });

    it('should register PUT route', () => {
      const handler = vi.fn();
      api.http.put('/test', handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'PUT',
        '/test',
        handler,
      );
    });

    it('should register PATCH route', () => {
      const handler = vi.fn();
      api.http.patch('/test', handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'PATCH',
        '/test',
        handler,
      );
    });

    it('should register DELETE route', () => {
      const handler = vi.fn();
      api.http.delete('/test', handler);

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'DELETE',
        '/test',
        handler,
      );
    });

    it('should throw error when http registry not available', () => {
      const apiWithoutHttp = new PluginAPIImpl(
        api.metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      api.registerResource('books', { schema });

      // Should create table
      const table = api.table('books');
      expect(table).toBeDefined();
    });

    it('should throw error when http registry not available for resource', () => {
      const apiWithoutHttp = new PluginAPIImpl(
        api.metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      pluginAPIRegistry = new Map();

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      const testAPI = {
        method1: vi.fn(),
        method2: vi.fn(),
      };

      api.exposeAPI('testAPI', testAPI);

      expect(pluginAPIRegistry.has('test-plugin')).toBe(true);
      expect(pluginAPIRegistry.get('test-plugin')?.get('testAPI')).toBe(testAPI);
    });

    it('should use other plugin API', () => {
      const otherAPI = {
        getData: vi.fn(),
      };

      pluginAPIRegistry.set('other-plugin', new Map([['dataAPI', otherAPI]]));

      const usedAPI = api.useAPI('other-plugin', 'dataAPI');

      expect(usedAPI).toBe(otherAPI);
    });

    it('should return null when plugin has no APIs', () => {
      const result = api.useAPI('non-existent-plugin', 'testAPI');
      expect(result).toBeNull();
    });

    it('should return null when API not found', () => {
      pluginAPIRegistry.set('other-plugin', new Map());

      const result = api.useAPI('other-plugin', 'non-existent-api');
      expect(result).toBeNull();
    });
  });

  describe('PluginAPIImpl - Metadata Manager', () => {
    let api: PluginAPIImpl;

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      const schema = z.object({ value: z.string() });
      api.meta.register('article', 'customField', schema);
      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should get metadata (not implemented)', async () => {
      const result = await api.meta.get('article', 1, 'customField');
      expect(result).toBeNull();
    });

    it('should set metadata (not implemented)', async () => {
      await api.meta.set('article', 1, 'customField', { value: 'test' });
      // Should complete without error
      expect(true).toBe(true);
    });

    it('should delete metadata (not implemented)', async () => {
      await api.meta.delete('article', 1, 'customField');
      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe('PluginAPIImpl - Hooks', () => {
    let api: PluginAPIImpl;

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

    it('should register shortcode', () => {
      const handler = vi.fn((attrs, content) => content);
      api.shortcode('highlight', handler);

      expect(mockShortcodeService.register).toHaveBeenCalledWith(
        'highlight',
        handler,
        'test-plugin',
      );
    });
  });

  describe('PluginAPIImpl - Public Data', () => {
    let api: PluginAPIImpl;

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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
      const data = { key: 'value' };
      api.provide('testData', data);

      expect(mockRegistryService.register).toHaveBeenCalledWith(
        'testData',
        expect.any(Function),
        10,
      );
    });

    it('should provide function data', () => {
      const dataFn = () => ({ key: 'value' });
      api.provide('testData', dataFn);

      expect(mockRegistryService.register).toHaveBeenCalledWith(
        'testData',
        expect.any(Function),
        10,
      );
    });
  });

  describe('PluginAPIImpl - Lifecycle', () => {
    let api: PluginAPIImpl;

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

    beforeEach(async () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        dir: '/plugins/test-plugin',
      };

      api = new PluginAPIImpl(
        metadata,
        mockDb as Database,
        mockModuleRef as ModuleRef,
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

      (mockSignalBus.connect as Mock).mockReturnValue(filterDisconnect);
      (mockSignalBus.subscribe as Mock).mockReturnValue(actionUnsubscribe);
      (mockShortcodeService.register as Mock).mockReturnValue(shortcodeUnregister);
      (mockPluginConfigService.onConfigChange as Mock).mockReturnValue(configUnsubscribe);

      // Register various hooks
      api.filter('test|filter', (data: any) => data);
      api.action('test|action', () => {});
      api.shortcode('test', (_, content) => content);
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

      expect(mockHttpRegistry.clearPluginRoutes).toHaveBeenCalledWith('test-plugin');
    });

    it('should handle cleanup errors gracefully', () => {
      const errorDisconnect = vi.fn(() => {
        throw new Error('Cleanup error');
      });

      (mockSignalBus.connect as Mock).mockReturnValue(errorDisconnect);
      api.filter('test|filter', (data: any) => data);

      // Should not throw
      expect(() => {
        api.cleanup();
      }).not.toThrow();
    });
  });
});
