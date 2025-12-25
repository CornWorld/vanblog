import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { PicgoPluginsController } from './picgo-plugins.controller';
import { PicgoStorageService } from '../services/storages/picgo-storage.service';

describe('PicgoPluginsController', () => {
  let controller: PicgoPluginsController;
  let picgoStorage: PicgoStorageService;

  const mockPicgoStorage = {
    getPluginLogs: vi.fn(),
    installPlugins: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PicgoPluginsController],
      providers: [
        {
          provide: PicgoStorageService,
          useValue: mockPicgoStorage,
        },
      ],
    }).compile();

    controller = module.get<PicgoPluginsController>(PicgoPluginsController);
    picgoStorage = module.get<PicgoStorageService>(PicgoStorageService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listPlugins', () => {
    it('should return empty plugin list with total 0', () => {
      const result = controller.listPlugins();

      expect(result).toEqual({
        plugins: [],
        total: 0,
      });
    });

    it('should always return same structure (backward compatibility)', () => {
      const result1 = controller.listPlugins();
      const result2 = controller.listPlugins();

      expect(result1).toEqual(result2);
      expect(result1.plugins).toEqual([]);
      expect(result1.total).toBe(0);
    });
  });

  describe('getLogs', () => {
    it('should return plugin logs from storage service', () => {
      const mockLogs = [
        {
          timestamp: 1640995200000, // 2022-01-01T00:00:00.000Z
          level: 'info',
          message: 'Plugin installed',
        },
        {
          timestamp: 1640995260000, // 2022-01-01T00:01:00.000Z
          level: 'error',
          message: 'Installation failed',
        },
      ];

      mockPicgoStorage.getPluginLogs.mockReturnValue({
        logs: mockLogs,
        total: 2,
      });

      const result = controller.getLogs();

      expect(result).toEqual({
        logs: mockLogs,
        total: 2,
      });
      expect(picgoStorage.getPluginLogs).toHaveBeenCalledOnce();
    });

    it('should return empty logs when no logs available', () => {
      mockPicgoStorage.getPluginLogs.mockReturnValue({
        logs: [],
        total: 0,
      });

      const result = controller.getLogs();

      expect(result).toEqual({
        logs: [],
        total: 0,
      });
    });

    it('should handle logs with various log levels', () => {
      const mockLogs = [
        { timestamp: 1640995200000, level: 'info', message: 'Debug msg' }, // 2022-01-01T00:00:00.000Z
        { timestamp: 1640995260000, level: 'info', message: 'Info msg' }, // 2022-01-01T00:01:00.000Z
        { timestamp: 1640995320000, level: 'warn', message: 'Warn msg' }, // 2022-01-01T00:02:00.000Z
        { timestamp: 1640995380000, level: 'error', message: 'Error msg' }, // 2022-01-01T00:03:00.000Z
      ];

      mockPicgoStorage.getPluginLogs.mockReturnValue({
        logs: mockLogs,
        total: 4,
      });

      const result = controller.getLogs();

      expect(result.logs).toHaveLength(4);
      expect(result.total).toBe(4);
    });
  });

  describe('install', () => {
    it('should install plugins successfully', async () => {
      const body = {
        plugins: ['picgo-plugin-test', 'picgo-plugin-example'],
      };

      mockPicgoStorage.installPlugins.mockResolvedValue(undefined);

      const result = await controller.install(body);

      expect(result).toEqual({
        success: true,
        message: 'Plugins installed successfully',
        installedPlugins: body.plugins,
      });
      expect(picgoStorage.installPlugins).toHaveBeenCalledWith(body.plugins);
    });

    it('should validate request requires at least one plugin', async () => {
      const body = {
        plugins: [],
      };

      // Should throw validation error from Zod schema (min 1 item required)
      await expect(controller.install(body)).rejects.toThrow();
    });

    it('should handle installation error with Error instance', async () => {
      const body = {
        plugins: ['picgo-plugin-bad'],
      };

      const error = new Error('Network connection failed');
      mockPicgoStorage.installPlugins.mockRejectedValue(error);

      const result = await controller.install(body);

      expect(result).toEqual({
        success: false,
        message: 'Network connection failed',
        errors: ['Network connection failed'],
      });
    });

    it('should handle installation error with string error', async () => {
      const body = {
        plugins: ['picgo-plugin-bad'],
      };

      mockPicgoStorage.installPlugins.mockRejectedValue('Installation timeout');

      const result = await controller.install(body);

      expect(result).toEqual({
        success: false,
        message: 'Installation timeout',
        errors: ['Installation timeout'],
      });
    });

    it('should handle installation error with non-string, non-Error value', async () => {
      const body = {
        plugins: ['picgo-plugin-bad'],
      };

      mockPicgoStorage.installPlugins.mockRejectedValue({ code: 500 });

      const result = await controller.install(body);

      expect(result.success).toBe(false);
      expect(result.message).toBe('[object Object]');
      expect(result.errors).toEqual(['[object Object]']);
    });

    it('should validate request body schema', async () => {
      const invalidBody = {
        notPlugins: ['test'],
      };

      // Should throw validation error from Zod schema
      await expect(controller.install(invalidBody)).rejects.toThrow();
    });

    it('should handle single plugin installation', async () => {
      const body = {
        plugins: ['picgo-plugin-single'],
      };

      mockPicgoStorage.installPlugins.mockResolvedValue(undefined);

      const result = await controller.install(body);

      expect(result.success).toBe(true);
      expect(result.installedPlugins).toHaveLength(1);
      expect(result.installedPlugins).toContain('picgo-plugin-single');
    });

    it('should handle multiple plugins installation', async () => {
      const body = {
        plugins: ['plugin-1', 'plugin-2', 'plugin-3'],
      };

      mockPicgoStorage.installPlugins.mockResolvedValue(undefined);

      const result = await controller.install(body);

      expect(result.success).toBe(true);
      expect(result.installedPlugins).toHaveLength(3);
    });
  });

  describe('uninstall', () => {
    it('should return failure with appropriate message', () => {
      const body = {
        plugins: ['picgo-plugin-test'],
      };

      const result = controller.uninstall(body);

      expect(result).toEqual({
        success: false,
        message: 'PicGo does not support uninstalling plugins via API',
        errors: ['PicGo does not support uninstalling plugins via API'],
      });
    });

    it('should handle multiple plugins uninstall request', () => {
      const body = {
        plugins: ['plugin-1', 'plugin-2', 'plugin-3'],
      };

      const result = controller.uninstall(body);

      expect(result.success).toBe(false);
      expect(result.message).toBe('PicGo does not support uninstalling plugins via API');
    });

    it('should validate request requires at least one plugin', () => {
      const body = {
        plugins: [],
      };

      // Should throw validation error from Zod schema (min 1 item required)
      expect(() => controller.uninstall(body)).toThrow();
    });

    it('should validate request body schema', () => {
      const invalidBody = {
        notPlugins: ['test'],
      };

      // Should throw validation error from Zod schema
      expect(() => controller.uninstall(invalidBody)).toThrow();
    });

    it('should always return same error message (API limitation)', () => {
      const result1 = controller.uninstall({ plugins: ['plugin-1'] });
      const result2 = controller.uninstall({ plugins: ['plugin-2'] });

      expect(result1.message).toBe(result2.message);
      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });
  });
});
