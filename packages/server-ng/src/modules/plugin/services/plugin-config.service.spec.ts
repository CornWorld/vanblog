/**
 * @file plugin-config.service.spec.ts
 *
 * PluginConfigService 测试
 */

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { PluginConfig } from '@vanblog/shared/plugin';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import { ConfigService } from '../../../config/config.service';
import { DATABASE_CONNECTION } from '../../../database';
import { PluginConfigService } from './plugin-config.service';

describe('PluginConfigService', () => {
  let service: PluginConfigService;
  let mockDb: {
    select: Mock;
    delete: Mock;
    $client: { execute: Mock };
  };
  let mockConfigService: { get: Mock };

  beforeEach(async () => {
    // Mock database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      $client: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Add chained methods
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    mockDb.delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    // Mock config service
    mockConfigService = {
      get: vi.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginConfigService,
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

    service = module.get<PluginConfigService>(PluginConfigService);
  });

  afterEach(() => {
    // Clean up
    if (service) {
      service.unregisterPlugin('test-plugin');
    }
    vi.clearAllMocks();
  });

  describe('registerSchema', () => {
    it('should register a config schema', () => {
      const schema: PluginConfig = {
        enableFeature: {
          type: 'boolean',
          default: true,
          title: 'Enable Feature',
        },
      };

      service.registerSchema('test-plugin', schema);

      expect(service.getSchema('test-plugin')).toEqual(schema);
    });

    it('should handle undefined schema', () => {
      service.registerSchema('test-plugin', undefined);

      expect(service.getSchema('test-plugin')).toBeUndefined();
    });
  });

  describe('getConfig', () => {
    it('should return default values from schema', async () => {
      const schema: PluginConfig = {
        enableFeature: {
          type: 'boolean',
          default: true,
        },
        maxCount: {
          type: 'number',
          default: 10,
        },
      };

      service.registerSchema('test-plugin', schema);

      const config = await service.getConfig('test-plugin');

      expect(config).toEqual({
        enableFeature: true,
        maxCount: 10,
      });
    });

    it('should override defaults with environment variables', async () => {
      const schema: PluginConfig = {
        enableFeature: {
          type: 'boolean',
          default: true,
        },
      };

      // Use a different plugin ID to avoid any caching issues
      const pluginId = 'test-env-plugin';
      service.registerSchema(pluginId, schema);

      // Reset database mock to return empty array (no DB overrides)
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Mock env variable using mockImplementation on the existing mock
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PLUGIN_TEST_ENV_PLUGIN_ENABLE_FEATURE') {
          return 'false';
        }
        return undefined;
      });

      // Clear cache to ensure fresh config load
      service.clearCache(pluginId);

      const config = await service.getConfig(pluginId);

      expect(config.enableFeature).toBe(false);

      // Clean up
      service.unregisterPlugin(pluginId);
    });

    it('should override with database values', async () => {
      const schema: PluginConfig = {
        enableFeature: {
          type: 'boolean',
          default: true,
        },
      };

      service.registerSchema('test-plugin', schema);

      // Mock database returning a value
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ key: 'config:enableFeature', value: 'false' }]),
        }),
      });

      // Clear cache first
      service.clearCache('test-plugin');

      const config = await service.getConfig('test-plugin');

      expect(config.enableFeature).toBe(false);
    });

    it('should cache config results', async () => {
      const schema: PluginConfig = {
        count: { type: 'number', default: 5 },
      };

      service.registerSchema('test-plugin', schema);

      // First call
      await service.getConfig('test-plugin');
      // Second call
      await service.getConfig('test-plugin');

      // Database should only be queried once
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  describe('getValue', () => {
    it('should return single config value', async () => {
      const schema: PluginConfig = {
        apiKey: { type: 'string', default: 'default-key' },
      };

      service.registerSchema('test-plugin', schema);

      const value = await service.getValue('test-plugin', 'apiKey');

      expect(value).toBe('default-key');
    });

    it('should return provided default if key not found', async () => {
      service.registerSchema('test-plugin', {});

      const value = await service.getValue('test-plugin', 'unknown', 'fallback');

      expect(value).toBe('fallback');
    });
  });

  describe('setConfig', () => {
    it('should save config to database', async () => {
      const schema: PluginConfig = {
        enabled: { type: 'boolean', default: false },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin'); // Initialize cache

      const result = await service.setConfig('test-plugin', 'enabled', true);

      expect(result).toBe(true);
      expect(mockDb.$client.execute).toHaveBeenCalled();
    });

    it('should validate config value against schema', async () => {
      const schema: PluginConfig = {
        count: {
          type: 'number',
          minimum: 1,
          maximum: 100,
        },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      // Invalid: too high
      const result = await service.setConfig('test-plugin', 'count', 200);

      expect(result).toBe(false);
    });

    it('should validate enum values', async () => {
      const schema: PluginConfig = {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
        },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      // Invalid enum value
      const result = await service.setConfig('test-plugin', 'theme', 'invalid');

      expect(result).toBe(false);
    });

    it('should update cache after setting', async () => {
      const schema: PluginConfig = {
        name: { type: 'string', default: 'default' },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      await service.setConfig('test-plugin', 'name', 'updated');

      const config = await service.getConfig('test-plugin');
      expect(config.name).toBe('updated');
    });
  });

  describe('setConfigs', () => {
    it('should set multiple configs at once', async () => {
      const schema: PluginConfig = {
        enabled: { type: 'boolean', default: false },
        count: { type: 'number', default: 0 },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const result = await service.setConfigs('test-plugin', {
        enabled: true,
        count: 5,
      });

      expect(result).toBe(true);
      expect(mockDb.$client.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteConfig', () => {
    it('should delete config from database', async () => {
      const schema: PluginConfig = {
        name: { type: 'string', default: 'default' },
      };

      service.registerSchema('test-plugin', schema);

      await service.deleteConfig('test-plugin', 'name');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('onConfigChange', () => {
    it('should notify listeners when config changes', async () => {
      const schema: PluginConfig = {
        count: { type: 'number', default: 0 },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const listener = vi.fn();
      service.onConfigChange('test-plugin', 'count', listener);

      await service.setConfig('test-plugin', 'count', 5);

      expect(listener).toHaveBeenCalledWith(5, 0);
    });

    it('should return unsubscribe function', async () => {
      const schema: PluginConfig = {
        count: { type: 'number', default: 0 },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const listener = vi.fn();
      const unsubscribe = service.onConfigChange('test-plugin', 'count', listener);

      unsubscribe();

      await service.setConfig('test-plugin', 'count', 5);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not notify if value unchanged', async () => {
      const schema: PluginConfig = {
        count: { type: 'number', default: 5 },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const listener = vi.fn();
      service.onConfigChange('test-plugin', 'count', listener);

      // Set same value
      await service.setConfig('test-plugin', 'count', 5);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific plugin', async () => {
      const schema: PluginConfig = {
        value: { type: 'number', default: 1 },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      service.clearCache('test-plugin');

      // Should query again
      await service.getConfig('test-plugin');

      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache when no plugin specified', async () => {
      service.registerSchema('plugin1', { v: { type: 'number', default: 1 } });
      service.registerSchema('plugin2', { v: { type: 'number', default: 2 } });

      await service.getConfig('plugin1');
      await service.getConfig('plugin2');

      service.clearCache();

      await service.getConfig('plugin1');
      await service.getConfig('plugin2');

      // 2 initial + 2 after clear
      expect(mockDb.select).toHaveBeenCalledTimes(4);

      // Clean up
      service.unregisterPlugin('plugin1');
      service.unregisterPlugin('plugin2');
    });
  });

  describe('unregisterPlugin', () => {
    it('should clean up all plugin resources', () => {
      const schema: PluginConfig = {
        value: { type: 'number', default: 1 },
      };

      service.registerSchema('test-plugin', schema);
      service.onConfigChange('test-plugin', 'value', vi.fn());

      service.unregisterPlugin('test-plugin');

      expect(service.getSchema('test-plugin')).toBeUndefined();
    });
  });

  describe('environment variable parsing', () => {
    it('should parse boolean env values', async () => {
      const schema: PluginConfig = {
        enabled: { type: 'boolean', default: false },
      };

      service.registerSchema('test-plugin', schema);
      mockConfigService.get.mockReturnValue('true');

      const config = await service.getConfig('test-plugin');

      expect(config.enabled).toBe(true);
    });

    it('should parse number env values', async () => {
      const schema: PluginConfig = {
        count: { type: 'number', default: 0 },
      };

      service.registerSchema('test-plugin', schema);
      mockConfigService.get.mockReturnValue('42');

      const config = await service.getConfig('test-plugin');

      expect(config.count).toBe(42);
    });

    it('should parse JSON array env values', async () => {
      const schema: PluginConfig = {
        items: { type: 'array', items: { type: 'string' } },
      };

      service.registerSchema('test-plugin', schema);
      mockConfigService.get.mockReturnValue('["a","b","c"]');

      const config = await service.getConfig('test-plugin');

      expect(config.items).toEqual(['a', 'b', 'c']);
    });
  });

  describe('validation', () => {
    it('should validate number minimum', async () => {
      const schema: PluginConfig = {
        count: { type: 'number', minimum: 5 },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const result = await service.setConfig('test-plugin', 'count', 3);

      expect(result).toBe(false);
    });

    it('should validate number maximum', async () => {
      const schema: PluginConfig = {
        count: { type: 'number', maximum: 10 },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const result = await service.setConfig('test-plugin', 'count', 15);

      expect(result).toBe(false);
    });

    it('should validate array type', async () => {
      const schema: PluginConfig = {
        items: { type: 'array', items: { type: 'string' } },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const result = await service.setConfig('test-plugin', 'items', 'not-an-array');

      expect(result).toBe(false);
    });

    it('should validate object type', async () => {
      const schema: PluginConfig = {
        settings: { type: 'object' },
      };

      service.registerSchema('test-plugin', schema);
      await service.getConfig('test-plugin');

      const validResult = await service.setConfig('test-plugin', 'settings', { key: 'value' });
      expect(validResult).toBe(true);

      const invalidResult = await service.setConfig('test-plugin', 'settings', ['not', 'object']);
      expect(invalidResult).toBe(false);
    });
  });
});
