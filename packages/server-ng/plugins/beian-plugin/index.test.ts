import { describe, it, expect, beforeEach, vi } from 'vitest';

import plugin from './index';

import type {
  PluginConfigReader,
  PluginContext,
  PluginDataStorage,
} from '../../src/modules/plugin/interfaces/plugin-context.interface';

// Mock the logger
vi.mock('@nestjs/common', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    log: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../../src/modules/plugin/utils/prefix.util', () => ({
  withPluginPrefix: vi.fn((prefix: string) => prefix),
}));

describe('Beian Plugin', () => {
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
      pluginId: 'beian-plugin',
      data: mockDataStorage,
      config: mockConfigReader,
      registry: {
        register: vi.fn(),
        unregister: vi.fn().mockReturnValue(true),
      } as any,
    };
  });

  describe('Plugin Structure', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.id).toBe('beian-plugin');
      expect(plugin.name).toBe('Beian Plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('Manage beian (ICP filing) information');
    });

    it('should have init method', () => {
      expect(typeof plugin.init).toBe('function');
    });

    it('should have destroy method', () => {
      expect(typeof plugin.destroy).toBe('function');
    });

    it('should have hooks defined', () => {
      expect(plugin.hooks).toBeDefined();
      if (plugin.hooks) {
        expect(plugin.hooks['bootstrap|beforeGenerate']).toBeDefined();
        expect(plugin.hooks['bootstrap|transformResponse']).toBeDefined();
      }
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

  describe('Hook Functions', () => {
    beforeEach(async () => {
      if (plugin.init) {
        await plugin.init(mockContext);
      }
    });

    it('should handle bootstrap|beforeGenerate hook', async () => {
      if (plugin.hooks?.['bootstrap|beforeGenerate']) {
        const hook = plugin.hooks['bootstrap|beforeGenerate'];
        await expect(hook.handler(mockContext)).resolves.not.toThrow();
      }
    });

    it('should handle bootstrap|transformResponse hook', async () => {
      if (plugin.hooks?.['bootstrap|transformResponse']) {
        const hook = plugin.hooks['bootstrap|transformResponse'];
        const mockValue = { beianInfo: null };
        const result = await hook.handler(mockValue, mockContext);
        expect(result).toBeDefined();
      }
    });
  });
});
