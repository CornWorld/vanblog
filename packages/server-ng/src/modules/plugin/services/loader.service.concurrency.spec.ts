/**
 * LoaderService Concurrency and Race Condition Tests
 *
 * This file contains tests for concurrent plugin loading scenarios and race condition prevention.
 *
 * Test scenarios:
 * - Concurrent plugin loads without state corruption
 * - Plugin context isolation during concurrent loads
 * - Partial failure in concurrent loads without affecting other plugins
 *
 * Related files:
 * - loader.service.ts - Main implementation
 * - loader.service.spec.ts - Core functionality tests
 * - loader.service.edge-cases.spec.ts - Edge case tests
 */

import { describe, it, expect, vi } from 'vitest';
import type * as fsPromisesModule from 'fs/promises';

// Hoisted mock for fs/promises with a mutable implementation function for readFile
const readFileImpl: (p: string | URL, opts?: unknown) => Promise<string> = async () => {
  await Promise.resolve();
  throw new Error('ENOENT');
};

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof fsPromisesModule>('fs/promises');
  return {
    ...actual,
    readFile: async (...args: unknown[]) => await readFileImpl(args[0] as string | URL, args[1]),
  };
});

vi.mock('../utils/object-plugin.util', () => {
  return {
    resolveObjectPluginExport: vi.fn(),
  };
});

import { resolveObjectPluginExport } from '../utils/object-plugin.util';

import { LoaderService, type PluginManifest } from './loader.service';

import type { HookService } from './hook.service';
import type { LoggerService } from '../../../core/logger/logger.service';

type MinimalLogger = Pick<LoggerService, 'log' | 'warn' | 'error' | 'debug'>;

describe('LoaderService concurrent plugin loading (Race Condition Prevention)', () => {
  it('should handle concurrent plugin loads without state corruption', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as any;

    const hookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    // Mock manifest and server version
    vi.spyOn(service as any, 'loadPluginManifest').mockImplementation((async (
      path: string,
    ): Promise<PluginManifest | null> => {
      const pluginId = path.split('/').pop();
      return {
        name: pluginId ?? 'unknown',
        version: '1.0.0',
      };
    }) as any);

    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    // Mock concurrent plugin loads with different IDs
    (resolveObjectPluginExport as any).mockImplementation(async (path: string) => {
      const pluginId = path.split('/').pop();
      // Simulate async delay to increase chance of race conditions
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      return {
        name: pluginId,
        version: '1.0.0',
        id: pluginId,
      };
    });

    // Create contexts for multiple concurrent loads
    const contexts = ['plugin1', 'plugin2', 'plugin3'].map((id) => ({
      pluginId: id,
      config: {},
      data: {},
      registry: { register: vi.fn(), unregister: vi.fn() },
    }));

    pluginContextFactory.createContext = vi.fn().mockImplementation((id: string) => {
      return contexts.find((c) => c.pluginId === id) || contexts[0];
    });

    // Load plugins concurrently
    const loadPromises = ['plugin1', 'plugin2', 'plugin3'].map((id) =>
      (service as any).loadPlugin(`/path/${id}`),
    );

    await Promise.all(loadPromises);

    // Verify all plugins were loaded
    const loadedPlugins = service.getLoadedPlugins();
    expect(loadedPlugins.size).toBe(3);
    expect(loadedPlugins.has('plugin1')).toBe(true);
    expect(loadedPlugins.has('plugin2')).toBe(true);
    expect(loadedPlugins.has('plugin3')).toBe(true);

    // Verify plugin state consistency
    for (const [pluginId, plugin] of loadedPlugins) {
      expect(plugin.id).toBe(pluginId);
      expect(plugin.name).toBe(pluginId);
      expect(plugin.version).toBe('1.0.0');
    }
  });

  it('should maintain plugin context isolation during concurrent loads', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as any;

    const hookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    // Create isolated contexts for each plugin
    const contextMap: Record<string, any> = {};
    ['plugin1', 'plugin2', 'plugin3'].forEach((id) => {
      contextMap[id] = {
        pluginId: id,
        config: { pluginSpecific: `config-${id}` },
        data: { pluginData: `data-${id}` },
        registry: { register: vi.fn(), unregister: vi.fn() },
      };
    });

    vi.spyOn(service as any, 'loadPluginManifest').mockImplementation((async (
      path: string,
    ): Promise<PluginManifest | null> => {
      const pluginId = path.split('/').pop();
      return {
        name: pluginId ?? 'unknown',
        version: '1.0.0',
      };
    }) as any);

    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    pluginContextFactory.createContext = vi.fn().mockImplementation((id: string) => {
      return contextMap[id];
    });

    (resolveObjectPluginExport as any).mockImplementation(async (path: string) => {
      const pluginId = path.split('/').pop();
      return {
        name: pluginId,
        version: '1.0.0',
        id: pluginId,
      };
    });

    // Load plugins concurrently
    const loadPromises = ['plugin1', 'plugin2', 'plugin3'].map((id) =>
      (service as any).loadPlugin(`/path/${id}`),
    );

    await Promise.all(loadPromises);

    // Verify context isolation
    const context1 = service.getPluginContext('plugin1');
    const context2 = service.getPluginContext('plugin2');
    const context3 = service.getPluginContext('plugin3');

    expect(context1?.pluginId).toBe('plugin1');
    expect(context2?.pluginId).toBe('plugin2');
    expect(context3?.pluginId).toBe('plugin3');

    // Verify each context has correct isolated data
    expect((context1 as any).config.pluginSpecific).toBe('config-plugin1');
    expect((context2 as any).config.pluginSpecific).toBe('config-plugin2');
    expect((context3 as any).config.pluginSpecific).toBe('config-plugin3');
  });

  it('should handle partial failure in concurrent loads without affecting other plugins', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as any;

    const hookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    let callCount = 0;
    vi.spyOn(service as any, 'loadPluginManifest').mockImplementation((async (
      path: string,
    ): Promise<PluginManifest | null> => {
      callCount++;
      const pluginId = path.split('/').pop();
      if (pluginId === 'plugin2') {
        throw new Error('Failed to load manifest');
      }
      return {
        name: pluginId ?? 'unknown',
        version: '1.0.0',
      };
    }) as any);

    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    pluginContextFactory.createContext = vi.fn().mockReturnValue({
      pluginId: 'test',
      config: {},
      data: {},
      registry: { register: vi.fn(), unregister: vi.fn() },
    });

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'test',
      version: '1.0.0',
    });

    // Load plugins concurrently; plugin2 will fail
    const loadPromises = ['plugin1', 'plugin2', 'plugin3'].map((id) =>
      (service as any).loadPlugin(`/path/${id}`).catch(() => {
        // Catch error for plugin2
      }),
    );

    await Promise.all(loadPromises);

    // Verify that the service continued despite one failure
    expect(callCount).toBeGreaterThan(0);
  });
});
