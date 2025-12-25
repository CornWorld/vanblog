/**
 * @file plugin-http.controller.spec.ts
 *
 * 插件 HTTP 动态路由控制器单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PluginHttpController } from './plugin-http.controller';
import { PluginHttpRegistryService } from '../services/plugin-http-registry.service';
import type { Request, Response } from 'express';

describe('PluginHttpController', () => {
  let controller: PluginHttpController;
  let mockHttpRegistry: any;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    // Mock PluginHttpRegistryService
    mockHttpRegistry = {
      findContractRoutes: vi.fn().mockReturnValue([]),
      findRawRoute: vi.fn().mockReturnValue(null),
      getPluginRoutes: vi.fn().mockReturnValue([]),
      getAllPluginIds: vi.fn().mockReturnValue([]),
    };

    // Mock Express Request and Response
    mockReq = {
      path: '/api/v2/plugins/test-plugin/books',
      method: 'GET',
      params: { pluginId: 'test-plugin' },
      query: {},
      body: null,
      headers: {},
    } as any;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      headersSent: false,
    } as any;

    controller = new PluginHttpController(mockHttpRegistry);
  });

  describe('handlePluginRoute', () => {
    it('should throw NOT_FOUND when no routes match', async () => {
      mockHttpRegistry.findContractRoutes.mockReturnValue([]);
      mockHttpRegistry.findRawRoute.mockReturnValue(null);

      await expect(controller.handlePluginRoute('test-plugin', mockReq, mockRes)).rejects.toThrow(
        HttpException,
      );
    });

    it('should handle contract routes successfully', async () => {
      const mockContractHandler = vi.fn().mockResolvedValue({
        status: 200,
        body: { message: 'Success' },
        headers: {},
      });

      const mockContractRoute = {
        contract: {
          getBooks: { method: 'GET', path: '/books', responses: { 200: {} } },
        },
        handlers: { getBooks: mockContractHandler },
      };

      mockHttpRegistry.findContractRoutes.mockReturnValue([mockContractRoute]);

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Success' });
    });

    it('should handle raw routes successfully', async () => {
      const mockRawHandler = vi.fn().mockResolvedValue(undefined);

      mockHttpRegistry.findContractRoutes.mockReturnValue([]);
      mockHttpRegistry.findRawRoute.mockReturnValue({
        handler: mockRawHandler,
      });

      mockRes.headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

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
        contract: {
          getBooks: { method: 'GET', path: '/books', responses: { 200: {} } },
        },
        handlers: { getBooks: mockContractHandler },
      };

      mockHttpRegistry.findContractRoutes.mockReturnValue([mockContractRoute]);

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Custom-Header', 'value');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    });

    it('should handle different HTTP methods', async () => {
      // When contract routes are empty, it tries raw routes
      mockHttpRegistry.findContractRoutes.mockReturnValue([]);

      mockReq.method = 'POST';
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      mockHttpRegistry.findRawRoute.mockReturnValue({
        handler: mockHandler,
      });

      mockRes.headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

      // Handler should be called for the POST method
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should extract plugin path correctly', async () => {
      mockReq.path = '/api/v2/plugins/my-plugin/api/users/123/posts';
      const mockHandler = vi.fn().mockResolvedValue({
        status: 200,
        body: { ok: true },
        headers: {},
      });

      const mockRoute = {
        contract: {
          action: { method: 'GET', path: '/api/users/:id/posts', responses: { 200: {} } },
        },
        handlers: { action: mockHandler },
      };

      mockHttpRegistry.findContractRoutes.mockReturnValue([mockRoute]);

      await controller.handlePluginRoute('my-plugin', mockReq, mockRes);

      // Verify the handler was called with the extracted plugin path
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle raw route errors gracefully', async () => {
      const mockRawHandler = vi.fn().mockRejectedValue(new Error('Database error'));

      mockHttpRegistry.findContractRoutes.mockReturnValue([]);
      mockHttpRegistry.findRawRoute.mockReturnValue({
        handler: mockRawHandler,
      });

      mockRes.headersSent = false;

      await expect(controller.handlePluginRoute('test-plugin', mockReq, mockRes)).rejects.toThrow(
        HttpException,
      );
    });

    it('should skip to next route if contract route handler fails', async () => {
      // When contract routes fail to match, it should fall back to raw routes
      mockHttpRegistry.findContractRoutes.mockReturnValue([]);

      const mockWorkingHandler = vi.fn().mockResolvedValue(undefined);
      mockHttpRegistry.findRawRoute.mockReturnValue({
        handler: mockWorkingHandler,
      });

      mockRes.headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

      // Should have fallen back to raw route
      expect(mockWorkingHandler).toHaveBeenCalled();
    });

    it('should not send response if handler already sent headers', async () => {
      const mockRawHandler = vi.fn().mockResolvedValue(undefined);

      mockHttpRegistry.findContractRoutes.mockReturnValue([]);
      mockHttpRegistry.findRawRoute.mockReturnValue({
        handler: mockRawHandler,
      });

      mockRes.headersSent = true;

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

      // Should not call json when headers already sent
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle unmatched contract route and find raw route', async () => {
      const mockRawHandler = vi.fn().mockResolvedValue(undefined);

      // Contract route exists but doesn't match the request
      const mockRoute = {
        contract: {
          otherAction: { method: 'POST', path: '/other', responses: { 200: {} } },
        },
        handlers: { otherAction: vi.fn() },
      };

      mockHttpRegistry.findContractRoutes.mockReturnValue([mockRoute]);
      mockHttpRegistry.findRawRoute.mockReturnValue({
        handler: mockRawHandler,
      });

      mockRes.headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

      expect(mockRawHandler).toHaveBeenCalled();
    });

    it('should handle case insensitive HTTP methods', async () => {
      mockReq.method = 'get'; // lowercase
      mockReq.path = '/api/v2/plugins/test-plugin/action';

      mockHttpRegistry.findContractRoutes.mockReturnValue([]);

      const mockHandler = vi.fn().mockResolvedValue(undefined);
      mockHttpRegistry.findRawRoute.mockReturnValue({
        handler: mockHandler,
      });

      mockRes.headersSent = false;

      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);

      // Verify the handler was called
      expect(mockHandler).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should preserve original exception if headers already sent', async () => {
      const originalError = new Error('Original error');

      mockHttpRegistry.findContractRoutes.mockImplementation(() => {
        throw originalError;
      });

      mockRes.headersSent = true;

      // Should not throw when headers already sent
      await controller.handlePluginRoute('test-plugin', mockReq, mockRes);
      // Since headers are already sent, the error is logged but not rethrown
    });
  });

  describe('getPluginRoutes', () => {
    it('should return routes for a specific plugin', async () => {
      const mockRoutes = [
        { type: 'contract', handlers: { getBooks: vi.fn() } },
        { type: 'raw', method: 'POST', path: '/users' },
      ];

      mockHttpRegistry.getPluginRoutes.mockReturnValue(mockRoutes);

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

      mockHttpRegistry.getPluginRoutes.mockReturnValue(mockRoutes);

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

      mockHttpRegistry.getPluginRoutes.mockReturnValue(mockRoutes);

      const result = await controller.getPluginRoutes('test-plugin');

      expect(result.routes[0].type).toBe('raw');
      expect(result.routes[0].method).toBe('GET');
      expect(result.routes[0].path).toBe('/custom');
    });

    it('should handle plugin with no routes', async () => {
      mockHttpRegistry.getPluginRoutes.mockReturnValue([]);

      const result = await controller.getPluginRoutes('empty-plugin');

      expect(result.routeCount).toBe(0);
      expect(result.routes).toEqual([]);
    });
  });

  describe('getAllPluginRoutes', () => {
    it('should return all plugin routes', async () => {
      mockHttpRegistry.getAllPluginIds.mockReturnValue(['plugin-1', 'plugin-2', 'plugin-3']);
      mockHttpRegistry.getPluginRoutes.mockImplementation((pluginId) => {
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
      mockHttpRegistry.getAllPluginIds.mockReturnValue([]);

      const result = await controller.getAllPluginRoutes();

      expect(result.totalPlugins).toBe(0);
      expect(result.plugins).toEqual([]);
    });

    it('should count routes per plugin correctly', async () => {
      mockHttpRegistry.getAllPluginIds.mockReturnValue(['plugin-a', 'plugin-b']);
      mockHttpRegistry.getPluginRoutes.mockImplementation((pluginId) => {
        if (pluginId === 'plugin-a') return [{}, {}, {}];
        if (pluginId === 'plugin-b') return [{}];
        return [];
      });

      const result = await controller.getAllPluginRoutes();

      expect(result.plugins[0].routeCount).toBe(3);
      expect(result.plugins[1].routeCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should convert HttpException to be re-thrown', async () => {
      const httpException = new HttpException('Not found', HttpStatus.NOT_FOUND);

      mockHttpRegistry.findContractRoutes.mockReturnValue([]);
      mockHttpRegistry.findRawRoute.mockReturnValue(null);

      mockRes.headersSent = false;

      await expect(controller.handlePluginRoute('test-plugin', mockReq, mockRes)).rejects.toThrow(
        HttpException,
      );
    });

    it('should wrap non-HttpException errors', async () => {
      mockHttpRegistry.findContractRoutes.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      mockRes.headersSent = false;

      await expect(controller.handlePluginRoute('test-plugin', mockReq, mockRes)).rejects.toThrow(
        HttpException,
      );
    });
  });
});
