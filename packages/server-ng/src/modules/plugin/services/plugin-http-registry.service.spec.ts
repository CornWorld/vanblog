/**
 * @file plugin-http-registry.service.spec.ts
 *
 * 单元测试 - 插件 HTTP 路由注册表服务
 */

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginHttpRegistryService } from './plugin-http-registry.service';

describe('PluginHttpRegistryService', () => {
  let service: PluginHttpRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginHttpRegistryService],
    }).compile();

    service = module.get<PluginHttpRegistryService>(PluginHttpRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerRawRoute', () => {
    it('should register a raw GET route', () => {
      const handler = async () => {};

      service.registerRawRoute('test-plugin', 'GET', '/books', handler);

      const routes = service.getPluginRoutes('test-plugin');
      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        type: 'raw',
        pluginId: 'test-plugin',
        method: 'GET',
        path: '/books',
        handler,
      });
    });

    it('should register multiple routes for the same plugin', () => {
      const getHandler = async () => {};
      const postHandler = async () => {};

      service.registerRawRoute('test-plugin', 'GET', '/books', getHandler);
      service.registerRawRoute('test-plugin', 'POST', '/books', postHandler);

      const routes = service.getPluginRoutes('test-plugin');
      expect(routes).toHaveLength(2);
    });

    it('should register routes for different plugins', () => {
      const handler1 = async () => {};
      const handler2 = async () => {};

      service.registerRawRoute('plugin-a', 'GET', '/books', handler1);
      service.registerRawRoute('plugin-b', 'GET', '/books', handler2);

      expect(service.getPluginRoutes('plugin-a')).toHaveLength(1);
      expect(service.getPluginRoutes('plugin-b')).toHaveLength(1);
      expect(service.getAllPluginIds()).toEqual(['plugin-a', 'plugin-b']);
    });
  });

  describe('registerContract', () => {
    it('should register a ts-rest contract', () => {
      const contract = {
        getBooks: {
          method: 'GET',
          path: '/books',
          responses: { 200: {} },
        },
      };
      const handlers = {
        getBooks: async () => ({ status: 200, body: [] }),
      };

      service.registerContract('test-plugin', contract as any, handlers);

      const routes = service.getPluginRoutes('test-plugin');
      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        type: 'contract',
        pluginId: 'test-plugin',
      });
    });
  });

  describe('findRawRoute', () => {
    it('should find a matching raw route', () => {
      const handler = async () => {};

      service.registerRawRoute('test-plugin', 'GET', '/books', handler);

      const found = service.findRawRoute('test-plugin', 'GET', '/books');

      expect(found).toBeDefined();
      expect(found?.handler).toBe(handler);
    });

    it('should return null if route not found', () => {
      const found = service.findRawRoute('test-plugin', 'GET', '/nonexistent');

      expect(found).toBeNull();
    });

    it('should differentiate between methods', () => {
      const getHandler = async () => {};
      const postHandler = async () => {};

      service.registerRawRoute('test-plugin', 'GET', '/books', getHandler);
      service.registerRawRoute('test-plugin', 'POST', '/books', postHandler);

      const foundGet = service.findRawRoute('test-plugin', 'GET', '/books');
      const foundPost = service.findRawRoute('test-plugin', 'POST', '/books');

      expect(foundGet?.handler).toBe(getHandler);
      expect(foundPost?.handler).toBe(postHandler);
    });
  });

  describe('findContractRoutes', () => {
    it('should find all contract routes for a plugin', () => {
      const contract1 = { getBooks: {} };
      const contract2 = { getAuthors: {} };

      service.registerContract('test-plugin', contract1 as any, {});
      service.registerContract('test-plugin', contract2 as any, {});
      service.registerRawRoute('test-plugin', 'GET', '/stats', async () => {});

      const contracts = service.findContractRoutes('test-plugin');

      expect(contracts).toHaveLength(2);
      expect(contracts.every((c) => c.type === 'contract')).toBe(true);
    });

    it('should return empty array if no contract routes', () => {
      service.registerRawRoute('test-plugin', 'GET', '/books', async () => {});

      const contracts = service.findContractRoutes('test-plugin');

      expect(contracts).toHaveLength(0);
    });
  });

  describe('clearPluginRoutes', () => {
    it('should clear all routes for a plugin', () => {
      service.registerRawRoute('test-plugin', 'GET', '/books', async () => {});
      service.registerRawRoute('test-plugin', 'POST', '/books', async () => {});

      expect(service.getPluginRoutes('test-plugin')).toHaveLength(2);

      service.clearPluginRoutes('test-plugin');

      expect(service.getPluginRoutes('test-plugin')).toHaveLength(0);
    });

    it('should not affect other plugins', () => {
      service.registerRawRoute('plugin-a', 'GET', '/books', async () => {});
      service.registerRawRoute('plugin-b', 'GET', '/books', async () => {});

      service.clearPluginRoutes('plugin-a');

      expect(service.getPluginRoutes('plugin-a')).toHaveLength(0);
      expect(service.getPluginRoutes('plugin-b')).toHaveLength(1);
    });
  });

  describe('clearAllRoutes', () => {
    it('should clear all routes from all plugins', () => {
      service.registerRawRoute('plugin-a', 'GET', '/books', async () => {});
      service.registerRawRoute('plugin-b', 'GET', '/books', async () => {});

      expect(service.getAllPluginIds()).toHaveLength(2);

      service.clearAllRoutes();

      expect(service.getAllPluginIds()).toHaveLength(0);
    });
  });

  describe('getAllPluginIds', () => {
    it('should return all registered plugin IDs', () => {
      service.registerRawRoute('plugin-a', 'GET', '/books', async () => {});
      service.registerRawRoute('plugin-b', 'GET', '/authors', async () => {});
      service.registerRawRoute('plugin-c', 'GET', '/tags', async () => {});

      const pluginIds = service.getAllPluginIds();

      expect(pluginIds).toHaveLength(3);
      expect(pluginIds).toContain('plugin-a');
      expect(pluginIds).toContain('plugin-b');
      expect(pluginIds).toContain('plugin-c');
    });

    it('should return empty array if no plugins registered', () => {
      const pluginIds = service.getAllPluginIds();

      expect(pluginIds).toHaveLength(0);
    });
  });

  describe('getAllRoutes', () => {
    it('should return the full route registry', () => {
      service.registerRawRoute('plugin-a', 'GET', '/books', async () => {});
      service.registerRawRoute('plugin-b', 'POST', '/authors', async () => {});

      const allRoutes = service.getAllRoutes();

      expect(allRoutes.size).toBe(2);
      expect(allRoutes.get('plugin-a')).toHaveLength(1);
      expect(allRoutes.get('plugin-b')).toHaveLength(1);
    });
  });
});
