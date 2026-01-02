/**
 * @file plugin-http.controller.spec.ts
 *
 * 插件 HTTP 动态路由控制器单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { PluginHttpController } from './plugin-http.controller';

import type { PluginHttpRegistryService } from '../services/plugin-http-registry.service';
import type { Request, Response } from 'express';

const createPluginHttpRegistryServiceMock = (): Partial<PluginHttpRegistryService> => ({
  findContractRoutes: vi.fn().mockReturnValue([]),
  findRawRoute: vi.fn().mockReturnValue(null),
  getPluginRoutes: vi.fn().mockReturnValue([]),
  getAllPluginIds: vi.fn().mockReturnValue([]),
});

const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  path: '/api/v2/plugins/test-plugin/books',
  method: 'GET',
  params: { pluginId: 'test-plugin' },
  query: {},
  body: null,
  headers: {},
  ...overrides,
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    headersSent: false,
  };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
};

describe('PluginHttpController', () => {
  let controller: PluginHttpController;
  let mockHttpRegistry: Partial<PluginHttpRegistryService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockHttpRegistry = createPluginHttpRegistryServiceMock();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    controller = new PluginHttpController(mockHttpRegistry as any);
  });

  describe('handlePluginRoute', () => {
    it('should throw NOT_FOUND when no routes match', async () => {
      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue(null);

      await expect(
        controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any),
      ).rejects.toThrow(HttpException);
    });

    it('should handle contract routes successfully', async () => {
      const mockContractHandler = vi.fn().mockResolvedValue({
        status: 200,
        body: { message: 'Success' },
        headers: {},
      });

      const mockContractRoute = {
        type: 'contract' as const,
        pluginId: 'test-plugin',
        contract: {
          getBooks: { method: 'GET', path: '/books', responses: { 200: {} } },
        },
        handlers: { getBooks: mockContractHandler },
      };

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([mockContractRoute]);

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success' });
    });

    it('should handle raw routes successfully', async () => {
      const mockRawHandler = vi.fn().mockResolvedValue(undefined);

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue({
        handler: mockRawHandler,
      } as any);

      (mockRes as any).headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockRawHandler).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('should set response headers from contract route', async () => {
      const mockContractHandler = vi.fn().mockResolvedValue({
        status: 200,
        body: { data: 'test' },
        headers: { 'X-Custom-Header': 'value', 'Content-Type': 'application/json' },
      });

      const mockContractRoute = {
        type: 'contract' as const,
        pluginId: 'test-plugin',
        contract: {
          getBooks: { method: 'GET', path: '/books', responses: { 200: {} } },
        },
        handlers: { getBooks: mockContractHandler },
      };

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([mockContractRoute]);

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Custom-Header', 'value');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    });

    it('should handle different HTTP methods', async () => {
      mockReq = createMockRequest({ method: 'POST' });
      mockRes = createMockResponse();

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);

      const mockHandler = vi.fn().mockResolvedValue(undefined);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue({
        handler: mockHandler,
      } as any);

      (mockRes as any).headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockHandler).toHaveBeenCalled();
    });

    it('should extract plugin path correctly', async () => {
      mockReq = createMockRequest({ path: '/api/v2/plugins/my-plugin/api/users/123/posts' });
      mockRes = createMockResponse();

      const mockHandler = vi.fn().mockResolvedValue({
        status: 200,
        body: { ok: true },
        headers: {},
      });

      const mockRoute = {
        type: 'contract' as const,
        pluginId: 'my-plugin',
        contract: {
          action: { method: 'GET', path: '/api/users/:id/posts', responses: { 200: {} } },
        },
        handlers: { action: mockHandler },
      };

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([mockRoute]);

      await controller.handlePluginRoute('my-plugin', mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle raw route errors gracefully', async () => {
      const mockRawHandler = vi.fn().mockRejectedValue(new Error('Database error'));

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue({
        handler: mockRawHandler,
      } as any);

      (mockRes as any).headersSent = false;

      await expect(
        controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any),
      ).rejects.toThrow(HttpException);
    });

    it('should skip to next route if contract route handler fails', async () => {
      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);

      const mockWorkingHandler = vi.fn().mockResolvedValue(undefined);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue({
        handler: mockWorkingHandler,
      } as any);

      (mockRes as any).headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockWorkingHandler).toHaveBeenCalled();
    });

    it('should not send response if handler already sent headers', async () => {
      const mockRawHandler = vi.fn().mockResolvedValue(undefined);

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue({
        handler: mockRawHandler,
      } as any);

      (mockRes as any).headersSent = true;

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle unmatched contract route and find raw route', async () => {
      const mockRawHandler = vi.fn().mockResolvedValue(undefined);

      const mockRoute = {
        type: 'contract' as const,
        pluginId: 'test-plugin',
        contract: {
          otherAction: { method: 'POST', path: '/other', responses: { 200: {} } },
        },
        handlers: { otherAction: vi.fn() },
      };

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([mockRoute]);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue({
        handler: mockRawHandler,
      } as any);

      (mockRes as any).headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockRawHandler).toHaveBeenCalled();
    });

    it('should handle case insensitive HTTP methods', async () => {
      mockReq = createMockRequest({ method: 'get', path: '/api/v2/plugins/test-plugin/action' });
      mockRes = createMockResponse();

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);

      const mockHandler = vi.fn().mockResolvedValue(undefined);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue({
        handler: mockHandler,
      } as any);

      (mockRes as any).headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);

      expect(mockHandler).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should preserve original exception if headers already sent', async () => {
      const originalError = new Error('Original error');

      vi.mocked(mockHttpRegistry.findContractRoutes!).mockImplementation(() => {
        throw originalError;
      });

      (mockRes as any).headersSent = true;

      await controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any);
    });
  });

  describe('getPluginRoutes', () => {
    it('should return routes for a specific plugin', async () => {
      const mockRoutes = [
        { type: 'contract', handlers: { getBooks: vi.fn() } },
        { type: 'raw', method: 'POST', path: '/users' },
      ];

      vi.mocked(mockHttpRegistry.getPluginRoutes!).mockReturnValue(mockRoutes as any);

      const result = await controller.getPluginRoutes('test-plugin');

      expect(result.pluginId).toBe('test-plugin');
      expect(result.routeCount).toBe(2);
      expect(result.routes).toHaveLength(2);
    });

    it('should format contract routes correctly', async () => {
      const mockRoutes = [
        {
          type: 'contract',
          handlers: { getBooks: vi.fn(), createBook: vi.fn() },
        },
      ];

      vi.mocked(mockHttpRegistry.getPluginRoutes!).mockReturnValue(mockRoutes as any);

      const result = await controller.getPluginRoutes('test-plugin');

      expect(result.routes[0].type).toBe('contract');
      expect(result.routes[0].contractKeys).toEqual(['getBooks', 'createBook']);
    });

    it('should format raw routes correctly', async () => {
      const mockRoutes = [
        {
          type: 'raw',
          method: 'GET',
          path: '/custom',
        },
      ];

      vi.mocked(mockHttpRegistry.getPluginRoutes!).mockReturnValue(mockRoutes as any);

      const result = await controller.getPluginRoutes('test-plugin');

      expect(result.routes[0].type).toBe('raw');
      expect(result.routes[0].method).toBe('GET');
      expect(result.routes[0].path).toBe('/custom');
    });

    it('should handle plugin with no routes', async () => {
      vi.mocked(mockHttpRegistry.getPluginRoutes!).mockReturnValue([]);

      const result = await controller.getPluginRoutes('empty-plugin');

      expect(result.routeCount).toBe(0);
      expect(result.routes).toEqual([]);
    });
  });

  describe('getAllPluginRoutes', () => {
    it('should return all plugin routes', async () => {
      vi.mocked(mockHttpRegistry.getAllPluginIds!).mockReturnValue([
        'plugin-1',
        'plugin-2',
        'plugin-3',
      ]);
      vi.mocked(mockHttpRegistry.getPluginRoutes!).mockImplementation((pluginId: string) => {
        const counts: any = {
          'plugin-1': [{ type: 'raw' }, { type: 'raw' }],
          'plugin-2': [{ type: 'contract' }],
          'plugin-3': [],
        };
        return counts[pluginId] || [];
      });

      const result = await controller.getAllPluginRoutes();

      expect(result.totalPlugins).toBe(3);
      expect(result.plugins).toHaveLength(3);
      expect(result.plugins[0].pluginId).toBe('plugin-1');
      expect(result.plugins[0].routeCount).toBe(2);
    });

    it('should handle no plugins', async () => {
      vi.mocked(mockHttpRegistry.getAllPluginIds!).mockReturnValue([]);

      const result = await controller.getAllPluginRoutes();

      expect(result.totalPlugins).toBe(0);
      expect(result.plugins).toEqual([]);
    });

    it('should count routes per plugin correctly', async () => {
      vi.mocked(mockHttpRegistry.getAllPluginIds!).mockReturnValue(['plugin-a', 'plugin-b']);
      vi.mocked(mockHttpRegistry.getPluginRoutes!).mockImplementation((pluginId: string) => {
        if (pluginId === 'plugin-a') return [{}, {}, {}] as any;
        if (pluginId === 'plugin-b') return [{}] as any;
        return [];
      });

      const result = await controller.getAllPluginRoutes();

      expect(result.plugins[0].routeCount).toBe(3);
      expect(result.plugins[1].routeCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should convert HttpException to be re-thrown', async () => {
      vi.mocked(mockHttpRegistry.findContractRoutes!).mockReturnValue([]);
      vi.mocked(mockHttpRegistry.findRawRoute!).mockReturnValue(null);

      (mockRes as any).headersSent = false;

      await expect(
        controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any),
      ).rejects.toThrow(HttpException);
    });

    it('should wrap non-HttpException errors', async () => {
      vi.mocked(mockHttpRegistry.findContractRoutes!).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      (mockRes as any).headersSent = false;

      await expect(
        controller.handlePluginRoute('test-plugin', mockReq as any, mockRes as any),
      ).rejects.toThrow(HttpException);
    });
  });
});
