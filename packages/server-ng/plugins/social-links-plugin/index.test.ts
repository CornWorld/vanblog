import { describe, it, expect, beforeEach, vi } from 'vitest';

import plugin from './index';

import type {
  PluginConfigReader,
  PluginContext,
  PluginDataStorage,
} from '../../src/modules/plugin/interfaces/plugin-context.interface';

// Mock the logger
vi.mock('../../src/utils/logger', () => ({
  withPluginPrefix: () => ({
    log: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe('Social Links Plugin', () => {
  let mockContext: PluginContext;
  let mockDataStorage: PluginDataStorage;
  let mockConfigReader: PluginConfigReader;

  beforeEach(() => {
    mockDataStorage = {
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      keys: vi.fn(),
    };

    mockConfigReader = {
      get: vi.fn(),
      getOrThrow: vi.fn(),
      has: vi.fn(),
    };

    mockContext = {
      pluginId: 'social-links-plugin',
      data: mockDataStorage,
      config: mockConfigReader,
      registry: {
        register: vi.fn(),
        unregister: vi.fn().mockReturnValue(true),
      } as any,
      hooks: {
        register: vi.fn(),
        unregister: vi.fn(),
      } as any,
      logger: {
        log: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      } as any,
    };
  });

  describe('Plugin Structure', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.id).toBe('social-links-plugin');
      expect(plugin.name).toBe('Social Links Plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('Manage social links configuration');
    });

    it('should have init method', () => {
      expect(typeof plugin.init).toBe('function');
    });

    it('should have destroy method', () => {
      expect(typeof plugin.destroy).toBe('function');
    });
  });

  describe('Plugin Methods', () => {
    beforeEach(async () => {
      if (plugin.init) {
        await plugin.init(mockContext);
      }
    });

    it('should initialize successfully', async () => {
      expect(plugin.init).toBeDefined();
      if (plugin.init) {
        await expect(plugin.init(mockContext)).resolves.not.toThrow();
      }
    });

    it('should destroy successfully', async () => {
      expect(plugin.destroy).toBeDefined();
      if (plugin.destroy) {
        await expect(plugin.destroy(mockContext)).resolves.not.toThrow();
      }
    });
  });
});
