/**
 * LoaderService Edge Cases and Error Handling Tests
 *
 * This file contains edge case scenarios and error handling tests for LoaderService.
 *
 * Test scenarios:
 * - loadPlugin edge cases (manifest null, invalid exports, missing fields)
 * - Hook handler validation (non-function handlers)
 * - Plugin initialization errors
 * - Dependency installation edge cases
 *
 * Related files:
 * - loader.service.ts - Main implementation
 * - loader.service.spec.ts - Core functionality tests
 * - loader.service.concurrency.spec.ts - Concurrency tests
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

import { LoaderService } from './loader.service';

import type { HookService } from './hook.service';
import type { LoggerService } from '../../../core/logger/logger.service';

type MinimalLogger = Pick<LoggerService, 'log' | 'warn' | 'error' | 'debug'>;

// Minimal mocks for dependencies; we won't use them in these tests
const createService = (): { service: LoaderService; logger: MinimalLogger } => {
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
    clearAll: vi.fn(),
  } as unknown as HookService;

  return {
    service: new LoaderService(logger as any, pluginContextFactory, hookService),
    logger,
  };
};

describe('LoaderService loadPlugin edge cases', () => {
  it('loadPlugin should skip when manifest is null', async () => {
    const { service, logger } = createService();

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue(null);

    await (service as any).loadPlugin('/invalid');

    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining('Loaded plugin'));
  });

  it('loadPlugin should skip when plugin export is null', async () => {
    const { service, logger } = createService();

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'test',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');
    (resolveObjectPluginExport as any).mockResolvedValue(null);

    await (service as any).loadPlugin('/test');

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('has no valid export'));
  });

  it('loadPlugin should skip when plugin missing name', async () => {
    const { service, logger } = createService();

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'test',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');
    (resolveObjectPluginExport as any).mockResolvedValue({
      name: '', // Empty name
      version: '1.0.0',
    });

    await (service as any).loadPlugin('/test');

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('missing name/version'));
  });

  it('loadPlugin should skip when plugin missing version', async () => {
    const { service, logger } = createService();

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'test',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');
    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'test',
      version: '', // Empty version
    });

    await (service as any).loadPlugin('/test');

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('missing name/version'));
  });

  it('loadPlugin should warn when action hook handler is not a function', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const mockContext = {
      pluginId: 'p13',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as any;

    const hookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p13',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p13',
      version: '1.0.0',
      hooks: {
        'test-hook': { type: 'action', handler: 'not-a-function' },
      },
    });

    await (service as any).loadPlugin('/p13');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("defined action hook 'test-hook' but handler is not a function"),
    );
    expect(hookService.addAction).not.toHaveBeenCalled();
  });

  it('loadPlugin should warn when filter hook handler is not a function', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const mockContext = {
      pluginId: 'p14',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as any;

    const hookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p14',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p14',
      version: '1.0.0',
      hooks: {
        'test-filter': { type: 'filter', handler: null },
      },
    });

    await (service as any).loadPlugin('/p14');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("defined filter hook 'test-filter' but handler is not a function"),
    );
    expect(hookService.addFilter).not.toHaveBeenCalled();
  });

  it('loadPlugin should handle plugin.init errors gracefully', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const mockContext = {
      pluginId: 'p15',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as any;

    const hookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p15',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    const initSpy = vi.fn().mockRejectedValue(new Error('Init failed'));

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p15',
      version: '1.0.0',
      init: initSpy,
    });

    await (service as any).loadPlugin('/p15');

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to init plugin 'p15'"),
      expect.any(String),
    );
    // Plugin should still be loaded despite init error
    expect(service.getLoadedPlugins().has('p15')).toBe(true);
  });

  it('loadPlugin should call installPluginDependencies with manifest', async () => {
    const { service } = createService();

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p16',
      version: '1.0.0',
      dependencies: ['dep1', 'dep2'],
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');
    vi.spyOn<any, any>(service as any, 'installPluginDependencies').mockImplementation(() => {});
    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p16',
      version: '1.0.0',
    });

    await (service as any).loadPlugin('/p16');

    expect((service as any).installPluginDependencies).toHaveBeenCalledWith(
      '/p16',
      expect.objectContaining({ dependencies: ['dep1', 'dep2'] }),
    );
  });
});

describe('LoaderService installPluginDependencies', () => {
  it('should return early when manifest is null', () => {
    const { service } = createService();

    (service as any).installPluginDependencies('/test', null);

    // Should not throw
  });

  it('should return early when manifest has no dependencies', () => {
    const { service } = createService();

    (service as any).installPluginDependencies('/test', {
      name: 'test',
      version: '1.0.0',
    });

    // Should not throw
  });

  it('should warn about array dependencies but skip auto-install', () => {
    const { service, logger } = createService();

    (service as any).installPluginDependencies('/test', {
      name: 'test',
      version: '1.0.0',
      dependencies: ['dep1', 'dep2'],
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('declares dependencies: dep1, dep2 (skipped auto-install)'),
    );
  });

  it('should warn about object dependencies but skip auto-install', () => {
    const { service, logger } = createService();

    (service as any).installPluginDependencies('/test', {
      name: 'test',
      version: '1.0.0',
      dependencies: { dep1: '^1.0.0', dep2: '^2.0.0' },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('declares dependencies: dep1, dep2 (skipped auto-install)'),
    );
  });

  it('should not warn when dependencies array is empty', () => {
    const { service, logger } = createService();

    (service as any).installPluginDependencies('/test', {
      name: 'test',
      version: '1.0.0',
      dependencies: [],
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should not warn when dependencies object is empty', () => {
    const { service, logger } = createService();

    (service as any).installPluginDependencies('/test', {
      name: 'test',
      version: '1.0.0',
      dependencies: {},
    });

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
