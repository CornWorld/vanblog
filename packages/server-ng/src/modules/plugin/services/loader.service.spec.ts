import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as fsPromisesModule from 'fs/promises';

import { MockUtils } from '../../../../test/mock-utils';

// Hoisted mock for fs/promises with a mutable implementation function for readFile
let readFileImpl: (p: string | URL, opts?: unknown) => Promise<string> = async () => {
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
import { PluginContextService, type PluginContextFactory } from './plugin-context.service';

import type { HookService } from './hook.service';

type VersionHelpers = {
  satisfiesVanblogEngine: (r: string, v: string) => boolean;
};

// Helper to create LoaderService with mocked dependencies
const createService = () => {
  const logger = MockUtils.services.createLoggerMock();

  const pluginContextFactory = {
    createContext: vi.fn(),
  } as unknown as PluginContextFactory;

  const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

  return {
    service: new LoaderService(logger as any, pluginContextFactory, hookService),
    logger,
  };
};

describe('LoaderService version utilities', () => {
  let service: LoaderService;
  let logger: ReturnType<typeof MockUtils.services.createLoggerMock>;
  let satisfies: VersionHelpers['satisfiesVanblogEngine'];

  beforeEach(() => {
    ({ service, logger } = createService());

    const { satisfiesVanblogEngine: sv } = service as unknown as VersionHelpers;
    satisfies = sv.bind(service);
  });

  it('satisfiesVanblogEngine should support caret ranges', () => {
    expect(satisfies('^2.0.0', '2.0.0')).toBe(true);
    expect(satisfies('^2.0.0', '2.5.4')).toBe(true);
    expect(satisfies('^2.0.0', '3.0.0')).toBe(false);
    expect(satisfies('^2.0.0', '1.9.9')).toBe(false);
  });

  it('satisfiesVanblogEngine should support tilde ranges', () => {
    expect(satisfies('~2.1.3', '2.1.3')).toBe(true);
    expect(satisfies('~2.1.3', '2.1.9')).toBe(true);
    expect(satisfies('~2.1.3', '2.2.0')).toBe(false);
    expect(satisfies('~2.1.3', '2.0.9')).toBe(false);
  });

  it('satisfiesVanblogEngine should support comparison operators', () => {
    expect(satisfies('>=2.1.0', '2.1.0')).toBe(true);
    expect(satisfies('>=2.1.0', '2.0.9')).toBe(false);
    expect(satisfies('> 2.1.0', '2.1.1')).toBe(true);
    expect(satisfies('> 2.1.0', '2.1.0')).toBe(false);
    expect(satisfies('<=2.1.0', '2.1.0')).toBe(true);
    expect(satisfies('<=2.1.0', '2.1.1')).toBe(false);
    expect(satisfies('< 2.1.0', '2.0.9')).toBe(true);
    expect(satisfies('< 2.1.0', '2.1.0')).toBe(false);
  });

  it('satisfiesVanblogEngine should support exact versions', () => {
    expect(satisfies('2.1.3', '2.1.3')).toBe(true);
    expect(satisfies('2.1.3', '2.1.4')).toBe(false);
  });

  it("satisfiesVanblogEngine should support '2' (major only) and '2.1' (major.minor)", () => {
    expect(satisfies('2', '2.0.0')).toBe(true);
    expect(satisfies('2', '2.5.4')).toBe(true);
    expect(satisfies('2', '3.0.0')).toBe(false);

    expect(satisfies('2.1', '2.1.0')).toBe(true);
    expect(satisfies('2.1', '2.1.9')).toBe(true);
    expect(satisfies('2.1', '2.2.0')).toBe(false);
  });

  it('satisfiesVanblogEngine should allow unknown patterns and log a warning', () => {
    const result = satisfies('foo', '2.1.0');
    expect(result).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  // New edge cases
  it('should not accept prerelease versions when includePrerelease=false', () => {
    expect(satisfies('^2.0.0', '2.0.0-alpha.1')).toBe(false);
    expect(satisfies('>=2.1.0', '2.1.0-beta')).toBe(false);
  });

  it('should ignore build metadata in version comparison', () => {
    expect(satisfies('>=2.1.0', '2.1.0+build.1')).toBe(true);
    expect(satisfies('2.1.0', '2.1.0+exp.sha.5114f85')).toBe(true);
  });

  it('should handle x/wildcard minor/patch patterns', () => {
    expect(satisfies('2.x', '2.1.0')).toBe(true);
    expect(satisfies('2.*', '2.3.4')).toBe(true);
    expect(satisfies('2.x', '3.0.0')).toBe(false);
  });

  it('should trim whitespace and strip leading v/V prefixes', () => {
    expect(satisfies('  ^2.1.0  ', '  v2.1.3  ')).toBe(true);
    expect(satisfies('v2.1', 'V2.1.2')).toBe(true);
  });

  it('should treat invalid version as 0.0.0 via coerce fallback', () => {
    expect(satisfies('>=1.0.0', 'not-a-version')).toBe(false);
    expect(satisfies('>=0.0.0', 'not-a-version')).toBe(true);
  });

  it("should allow empty range, '*' and 'x' as allow-all", () => {
    expect(satisfies('', '2.0.0')).toBe(true);
    expect(satisfies('*', '100.0.0')).toBe(true);
    expect(satisfies('x', '0.0.0')).toBe(true);
  });
});

describe('LoaderService manifest validation', () => {
  let service: LoaderService;
  let logger: ReturnType<typeof MockUtils.services.createLoggerMock>;

  beforeEach(() => {
    ({ service, logger } = createService());
    readFileImpl = async () => {
      await Promise.resolve();
      throw new Error('ENOENT');
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse valid plugin.json via Zod schema', async () => {
    vi.spyOn<any, any>(service as any, 'readPackageJson').mockResolvedValue(null);

    readFileImpl = async (p: string | URL) => {
      await Promise.resolve();
      if (typeof p === 'string' && p.endsWith('plugin.json')) {
        return await Promise.resolve(
          JSON.stringify({ name: 'foo', version: '1.2.3', hooks: { a: { type: 'action' } } }),
        );
      }
      throw new Error('ENOENT');
    };

    const manifest = await (service as any).loadPluginManifest('/tmp/x');
    expect(manifest).toEqual(expect.objectContaining({ name: 'foo', version: '1.2.3' }));
  });

  it('should fallback to package.json when plugin.json invalid', async () => {
    vi.spyOn<any, any>(service as any, 'readPackageJson').mockResolvedValue({
      name: 'bar',
      version: '0.1.0',
    });

    readFileImpl = async (p: string | URL) => {
      await Promise.resolve();
      if (typeof p === 'string' && p.endsWith('plugin.json')) {
        // invalid: missing name/version
        return await Promise.resolve(JSON.stringify({ foo: 'bar' }));
      }
      throw new Error('ENOENT');
    };

    const manifest = await (service as any).loadPluginManifest('/tmp/y');
    expect(manifest).toEqual(expect.objectContaining({ name: 'bar', version: '0.1.0' }));
  });

  it('should return null when both manifests are missing essential fields', async () => {
    vi.spyOn<any, any>(service as any, 'readPackageJson').mockResolvedValue({});

    readFileImpl = async () => {
      await Promise.resolve();
      throw new Error('ENOENT');
    };

    const manifest = await (service as any).loadPluginManifest('/tmp/z');
    expect(manifest).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  // New tests for lenient input and internal strictness
  it('should preserve unknown fields from plugin.json due to Zod .loose()', async () => {
    vi.spyOn<any, any>(service as any, 'readPackageJson').mockResolvedValue(null);
    readFileImpl = async (p: string | URL) => {
      await Promise.resolve();
      if (typeof p === 'string' && p.endsWith('plugin.json')) {
        return await Promise.resolve(
          JSON.stringify({
            name: 'baz',
            version: '3.2.1',
            description: 'desc',
            extra: { keep: true },
            hooks: { h: { type: 'filter', priority: 5 } },
          }),
        );
      }
      throw new Error('ENOENT');
    };
    const manifest = await (service as any).loadPluginManifest('/tmp/a');
    expect(manifest).toEqual(
      expect.objectContaining({ name: 'baz', version: '3.2.1', description: 'desc' }),
    );
    // unknown field should be present on the runtime object even if not typed
    expect(manifest.extra).toEqual({ keep: true });
    expect(manifest.hooks.h.priority).toBe(5);
  });

  it('should fallback when hooks.priority is not an integer (schema invalid)', async () => {
    vi.spyOn<any, any>(service as any, 'readPackageJson').mockResolvedValue({
      name: 'fallback',
      version: '9.9.9',
    });
    readFileImpl = async (p: string | URL) => {
      await Promise.resolve();
      if (typeof p === 'string' && p.endsWith('plugin.json')) {
        // priority must be int; using float to trigger invalid schema
        return await Promise.resolve(
          JSON.stringify({
            name: 'oops',
            version: '1.0.0',
            hooks: { a: { type: 'action', priority: 1.5 } },
          }),
        );
      }
      throw new Error('ENOENT');
    };
    const manifest = await (service as any).loadPluginManifest('/tmp/b');
    expect(manifest).toEqual(expect.objectContaining({ name: 'fallback', version: '9.9.9' }));
    // hooks should not exist because we fell back to package.json
    expect(manifest.hooks).toBeUndefined();
  });
});

describe('LoaderService load/unload behavior', () => {
  it('loadPlugin should register action/filter hooks with hookService and priorities', async () => {
    const logger = MockUtils.services.createLoggerMock();

    let capturedActionHandler: ((...args: unknown[]) => unknown) | undefined;
    let capturedFilterHandler: ((...args: unknown[]) => unknown) | undefined;

    const createdContext = {
      pluginId: 'p1',
      config: {} as any,
      data: {} as any,
      registry: { register: vi.fn(), unregister: vi.fn() },
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(createdContext),
    } as unknown as PluginContextFactory;

    const hookService = {
      ...MockUtils.services.createHookServiceMock(),
      addAction: vi.fn().mockImplementation((_hook: string, fn: unknown, priority?: number) => {
        capturedActionHandler = fn as typeof capturedActionHandler;
        expect(priority).toBe(10); // default priority when not provided
        return 'act-1';
      }),
      addFilter: vi.fn().mockImplementation((_hook: string, fn: unknown, priority?: number) => {
        capturedFilterHandler = fn as typeof capturedFilterHandler;
        expect(priority).toBe(7); // provided priority should be respected
        return 'fil-7';
      }),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    // Mock manifest and server version to pass engines check
    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p1',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    // Prepare plugin export with hooks
    const actionSpy = vi.fn((_a: unknown, _b: unknown, _ctx: unknown) => {
      // no-op
    });
    const filterSpy = vi.fn((value: unknown, _ctx: unknown) => `handled:${String(value)}`);

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p1',
      version: '1.0.0',
      hooks: {
        a: { type: 'action', handler: actionSpy },
        f: { type: 'filter', handler: filterSpy, priority: 7 },
      },
      init: vi.fn(),
    });

    await (service as any).loadPlugin('/fake/dir');

    expect(hookService.addAction).toHaveBeenCalledTimes(1);
    expect(hookService.addFilter).toHaveBeenCalledTimes(1);

    // Verify wrappers pass context and return values
    expect(typeof capturedActionHandler).toBe('function');
    expect(typeof capturedFilterHandler).toBe('function');

    await capturedActionHandler?.('x', 1);
    expect(actionSpy).toHaveBeenCalled();
    const [firstActionCall] = actionSpy.mock.calls;
    const [, , passedCtxA] = firstActionCall;
    expect(passedCtxA).toBe(createdContext);

    const r = await capturedFilterHandler?.('v0');
    expect(filterSpy).toHaveBeenCalled();
    const [firstFilterCall] = filterSpy.mock.calls;
    const [, passedCtxF] = firstFilterCall;
    expect(passedCtxF).toBe(createdContext);
    expect(r).toBe('handled:v0');
  });

  it('loadPlugin should skip when engines.vanblog does not satisfy current version', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p3',
      version: '1.0.0',
      engines: { vanblog: '^999.0.0' },
    } as any);
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    await (service as any).loadPlugin('/p3');

    expect(logger.warn).toHaveBeenCalled();
    expect(hookService.addAction).not.toHaveBeenCalled();
    expect(hookService.addFilter).not.toHaveBeenCalled();
  });

  it('registerExternalPlugin should persist meta and log hook totals snapshot', () => {
    const logger = MockUtils.services.createLoggerMock();

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as PluginContextFactory;

    const hookService = {
      ...MockUtils.services.createHookServiceMock(),
      getAllActionHooks: vi.fn().mockReturnValue(['a1', 'a2']),
      getAllFilterHooks: vi.fn().mockReturnValue(['f1']),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    const plugin = { id: 'id4', name: 'p4', version: '0.0.1' } as any;
    const ctx = { pluginId: 'p4' } as any;
    const meta = {
      pluginDir: '/p4',
    };

    service.registerExternalPlugin(plugin, ctx, meta);

    expect(service.getPluginContext('p4')).toBe(ctx);
    // call again to cover getters
    const m = service.getLoadedPlugins();
    expect(m.has('p4')).toBe(true);
    expect(logger.log).toHaveBeenCalled();
  });

  it('filter wrapper should fall back to previous value when handler times out or returns undefined', async () => {
    const logger = MockUtils.services.createLoggerMock();

    let capturedFilterHandler: ((...args: unknown[]) => unknown) | undefined;
    const createdContext = {
      pluginId: 'p1',
      config: {},
      data: {},
      registry: { register: vi.fn(), unregister: vi.fn() },
    } as any;

    const hookService = {
      ...MockUtils.services.createHookServiceMock(),
      addFilter: vi.fn().mockImplementation((_hook: string, fn: unknown, _priority?: number) => {
        capturedFilterHandler = fn as typeof capturedFilterHandler;
        return 'fil-1';
      }),
    } as unknown as HookService;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(createdContext),
    } as unknown as PluginContextFactory;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);
    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p1',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    // plugin exports a filter hook; handler won't be used because we mock safeExecuteWithTimeout
    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p1',
      version: '1.0.0',
      hooks: { f: { type: 'filter', handler: vi.fn() } },
    });

    await (service as any).loadPlugin('/p1');
    expect(typeof capturedFilterHandler).toBe('function');

    // Make safeExecuteWithTimeout resolve to undefined (simulate timeout or undefined return)
    const spy = vi
      .spyOn<any, any>(service as any, 'safeExecuteWithTimeout')
      .mockResolvedValue(undefined);

    const prev = 'v0';
    const result = await capturedFilterHandler?.(prev);
    expect(result).toBe(prev);
    expect(logger.warn).toHaveBeenCalled();

    // ensure label carries hook metadata
    expect(spy).toHaveBeenCalled();
    if (spy.mock.calls.length === 0) {
      throw new Error('Expected spy to have at least one call');
    }
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(String(lastCall[2])).toContain('plugin:p1:f:filter');
  });

  it('action wrapper should use safeExecuteWithTimeout and not throw on errors/timeouts', async () => {
    const logger = MockUtils.services.createLoggerMock();

    let capturedActionHandler: ((...args: unknown[]) => unknown) | undefined;

    const createdContext = {
      pluginId: 'p2',
    } as any;

    const hookService = {
      ...MockUtils.services.createHookServiceMock(),
      addAction: vi.fn().mockImplementation((_hook: string, fn: unknown) => {
        capturedActionHandler = fn as typeof capturedActionHandler;
        return 'act-1';
      }),
    } as unknown as HookService;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(createdContext),
    } as unknown as PluginContextFactory;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);
    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p2',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p2',
      version: '1.0.0',
      hooks: { a: { type: 'action', handler: vi.fn() } },
    });

    await (service as any).loadPlugin('/p2');
    expect(typeof capturedActionHandler).toBe('function');

    const spy = vi
      .spyOn<any, any>(service as any, 'safeExecuteWithTimeout')
      .mockResolvedValue(undefined);

    // Should not throw regardless of inner failure/timeout
    await expect(capturedActionHandler?.('x', 1)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    if (spy.mock.calls.length === 0) {
      throw new Error('Expected spy to have at least one call');
    }
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(String(lastCall[2])).toContain('plugin:p2:a:action');
  });

  it('loadPlugin should skip when engines.vanblog does not satisfy current version', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p3',
      version: '1.0.0',
      engines: { vanblog: '^999.0.0' },
    } as any);
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    await (service as any).loadPlugin('/p3');

    expect(logger.warn).toHaveBeenCalled();
    expect(hookService.addAction).not.toHaveBeenCalled();
    expect(hookService.addFilter).not.toHaveBeenCalled();
  });

  it('unloadPlugin should call cleanupRegistrations if context is PluginContextService', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const mockContext = Object.create(PluginContextService.prototype);
    mockContext.cleanupRegistrations = vi.fn();

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p5',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');
    (resolveObjectPluginExport as any).mockResolvedValue({
      id: 'p5',
      name: 'p5',
      version: '1.0.0',
    });

    await (service as any).loadPlugin('/p5');
    await service.unloadPlugin('p5');

    expect(mockContext.cleanupRegistrations).toHaveBeenCalled();
  });

  it('unloadPlugin should return false when plugin not found', async () => {
    const { service } = createService();

    const result = await service.unloadPlugin('non-existent');

    expect(result).toBe(false);
  });

  it('cleanupPlugin should call plugin.destroy with timeout', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const destroySpy = vi.fn();
    const mockContext = {
      pluginId: 'p6',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p6',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p6',
      version: '1.0.0',
      destroy: destroySpy,
    });

    await (service as any).loadPlugin('/p6');
    await service.unloadPlugin('p6');

    expect(destroySpy).toHaveBeenCalledWith(mockContext);
  });

  it('cleanupPlugin should handle destroy errors gracefully', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const destroySpy = vi.fn().mockRejectedValue(new Error('Destroy failed'));
    const mockContext = {
      pluginId: 'p7',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p7',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p7',
      version: '1.0.0',
      destroy: destroySpy,
    });

    await (service as any).loadPlugin('/p7');
    await service.unloadPlugin('p7');

    expect(logger.error).toHaveBeenCalled();
  });

  it('cleanupPlugin should execute cleanup functions', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const cleanupSpy1 = vi.fn();
    const cleanupSpy2 = vi.fn();

    const mockContext = {
      pluginId: 'p8',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as PluginContextFactory;

    const hookService = {
      ...MockUtils.services.createHookServiceMock(),
      addAction: vi.fn().mockImplementation(() => 'action-1'),
      addFilter: vi.fn().mockImplementation(() => 'filter-1'),
      removeAction: cleanupSpy1,
      removeFilter: cleanupSpy2,
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p8',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p8',
      version: '1.0.0',
      hooks: {
        a: { type: 'action', handler: vi.fn() },
        f: { type: 'filter', handler: vi.fn() },
      },
    });

    await (service as any).loadPlugin('/p8');
    await service.unloadPlugin('p8');

    expect(cleanupSpy1).toHaveBeenCalledWith('a', 'action-1');
    expect(cleanupSpy2).toHaveBeenCalledWith('f', 'filter-1');
  });

  it('cleanupPlugin should warn on cleanup function errors', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const mockContext = {
      pluginId: 'p9',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as PluginContextFactory;

    const hookService = {
      ...MockUtils.services.createHookServiceMock(),
      addAction: vi.fn().mockImplementation(() => 'action-1'),
      removeAction: vi.fn().mockImplementation(() => {
        throw new Error('Cleanup error');
      }),
    } as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p9',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p9',
      version: '1.0.0',
      hooks: {
        a: { type: 'action', handler: vi.fn() },
      },
    });

    await (service as any).loadPlugin('/p9');
    await service.unloadPlugin('p9');

    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('LoaderService plugin lifecycle', () => {
  it('onModuleInit should log initialization message', () => {
    const { service, logger } = createService();

    service.onModuleInit();

    expect(logger.log).toHaveBeenCalledWith(
      'LoaderService: plugin modules are loaded via PluginModule.forRoot, skip internal scanning',
    );
  });

  it('reloadPlugins should cleanup all plugins and reload from directory', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const mockContext = {
      pluginId: 'p10',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    // Mock initial plugin loading
    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p10',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');
    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p10',
      version: '1.0.0',
    });

    await (service as any).loadPlugin('/p10');

    // Mock loadPluginsFromDirectories
    vi.spyOn<any, any>(service as any, 'loadPluginsFromDirectories').mockResolvedValue(undefined);

    await service.reloadPlugins();

    expect(logger.log).toHaveBeenCalledWith('Starting plugin reload...');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Successfully reloaded'));
  });

  it('reloadPlugins should clear failed plugins set', async () => {
    const { service } = createService();

    vi.spyOn<any, any>(service as any, 'loadPluginsFromDirectories').mockResolvedValue(undefined);

    // Add a failed plugin manually
    (service as any).failedPlugins.add('failed-plugin');
    expect(service.getFailedPlugins().size).toBe(1);

    await service.reloadPlugins();

    expect(service.getFailedPlugins().size).toBe(0);
  });

  it('getFailedPlugins should return copy of failed plugins set', () => {
    const { service } = createService();

    (service as any).failedPlugins.add('failed1');
    (service as any).failedPlugins.add('failed2');

    const failed = service.getFailedPlugins();

    expect(failed.size).toBe(2);
    expect(failed.has('failed1')).toBe(true);
    expect(failed.has('failed2')).toBe(true);

    // Verify it's a copy
    failed.add('failed3');
    expect(service.getFailedPlugins().size).toBe(2);
  });

  it('getLoadedPlugins should return copy of loaded plugins map', () => {
    const { service } = createService();

    const plugin1 = { name: 'p1', version: '1.0.0' } as any;
    const plugin2 = { name: 'p2', version: '1.0.0' } as any;

    (service as any).loadedPlugins.set('p1', plugin1);
    (service as any).loadedPlugins.set('p2', plugin2);

    const loaded = service.getLoadedPlugins();

    expect(loaded.size).toBe(2);
    expect(loaded.get('p1')).toBe(plugin1);
    expect(loaded.get('p2')).toBe(plugin2);

    // Verify it's a copy
    loaded.set('p3', { name: 'p3', version: '1.0.0' } as any);
    expect(service.getLoadedPlugins().size).toBe(2);
  });

  it('getPluginContext should return undefined for non-existent plugin', () => {
    const { service } = createService();

    const context = service.getPluginContext('non-existent');

    expect(context).toBeUndefined();
  });

  it('retryPlugin should return false if plugin is not in failed set', async () => {
    const { service } = createService();

    const result = await service.retryPlugin('not-failed');

    expect(result).toBe(false);
  });

  it('retryPlugin should load plugin and remove from failed set on success', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const mockContext = {
      pluginId: 'p11',
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(mockContext),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    // Add plugin to failed set
    (service as any).failedPlugins.add('p11');

    // Mock successful load
    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p11',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');
    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p11',
      version: '1.0.0',
    });

    const result = await service.retryPlugin('p11', '/p11');

    expect(result).toBe(true);
    expect(service.getFailedPlugins().has('p11')).toBe(false);
  });

  it('retryPlugin should keep plugin in failed set on failure', async () => {
    const logger = MockUtils.services.createLoggerMock();

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as PluginContextFactory;

    const hookService = MockUtils.services.createHookServiceMock() as unknown as HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    // Add plugin to failed set
    (service as any).failedPlugins.add('p12');

    // Mock failed load
    vi.spyOn<any, any>(service as any, 'loadPlugin').mockRejectedValue(new Error('Load failed'));

    const result = await service.retryPlugin('p12', '/p12');

    expect(result).toBe(false);
    expect(service.getFailedPlugins().has('p12')).toBe(true);
    expect(logger.error).toHaveBeenCalled();
  });
});
