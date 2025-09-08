import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mock for fs/promises with a mutable implementation function for readFile
let readFileImpl: (p: string | URL, opts?: unknown) => Promise<string> = async () => {
  await Promise.resolve();
  throw new Error('ENOENT');
};

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
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

import type { LoggerService } from '../../../core/logger/logger.service';

type MinimalLogger = Pick<LoggerService, 'log' | 'warn' | 'error' | 'debug'>;

type VersionHelpers = {
  parseVersion: (v: string) => [number, number, number];
  satisfiesVanblogEngine: (r: string, v: string) => boolean;
};

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
  } as unknown as import('./plugin-context.service').PluginContextFactory;

  const hookService = {
    addAction: vi.fn(),
    addFilter: vi.fn(),
    clearAll: vi.fn(),
  } as unknown as import('./hook.service').HookService;

  return {
    service: new LoaderService(logger as any, pluginContextFactory, hookService),
    logger,
  };
};

describe('LoaderService version utilities', () => {
  let service: LoaderService;
  let logger: MinimalLogger;
  let parseVersion: VersionHelpers['parseVersion'];
  let satisfies: VersionHelpers['satisfiesVanblogEngine'];

  beforeEach(() => {
    ({ service, logger } = createService());

    const { parseVersion: pv, satisfiesVanblogEngine: sv } = service as unknown as VersionHelpers;
    parseVersion = pv.bind(service);
    satisfies = sv.bind(service);
  });
  it('parseVersion should parse semantic versions and default missing parts to 0', () => {
    expect(parseVersion('2.1.3')).toEqual([2, 1, 3]);
    expect(parseVersion('2.1')).toEqual([2, 1, 0]);
    expect(parseVersion('2')).toEqual([2, 0, 0]);
    expect(parseVersion('')).toEqual([0, 0, 0]);
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
  let logger: MinimalLogger;

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
  it('loadPlugin should register action/filter hooks with context and priorities', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const createdContext = {
      pluginId: 'p1',
      config: {} as any,
      data: {} as any,
      registry: { register: vi.fn(), unregister: vi.fn() },
    } as any;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue(createdContext),
    } as unknown as import('./plugin-context.service').PluginContextFactory;

    let capturedActionHandler: ((...args: unknown[]) => unknown) | undefined;
    let capturedFilterHandler: ((...args: unknown[]) => unknown) | undefined;

    const hookService = {
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
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as import('./hook.service').HookService;

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

  it("unloadPlugin should call destroy and remove only this plugin's hooks", async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const pluginContextFactory = {
      createContext: vi.fn().mockReturnValue({ pluginId: 'p2' } as any),
    } as unknown as import('./plugin-context.service').PluginContextFactory;

    const addAction = vi.fn().mockReturnValue('act-42');
    const addFilter = vi.fn().mockReturnValue('fil-24');
    const removeAction = vi.fn();
    const removeFilter = vi.fn();

    const hookService = {
      addAction,
      addFilter,
      removeAction,
      removeFilter,
      clearAll: vi.fn(),
    } as unknown as import('./hook.service').HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    const destroySpy = vi.fn();
    vi.spyOn<any, any>(service as any, 'loadPluginManifest').mockResolvedValue({
      name: 'p2',
      version: '1.0.0',
    });
    vi.spyOn<any, any>(service as any, 'getServerVersion').mockReturnValue('1.0.0');

    (resolveObjectPluginExport as any).mockResolvedValue({
      name: 'p2',
      version: '1.0.0',
      hooks: {
        a: { type: 'action', handler: vi.fn() },
        f: { type: 'filter', handler: vi.fn() },
      },
      destroy: destroySpy,
    });

    await (service as any).loadPlugin('/p2');

    const unloaded = await service.unloadPlugin('p2');
    expect(unloaded).toBe(true);
    expect(destroySpy).toHaveBeenCalled();
    expect(removeAction).toHaveBeenCalledWith('a', 'act-42');
    expect(removeFilter).toHaveBeenCalledWith('f', 'fil-24');
    // subsequent unload should return false
    const again = await service.unloadPlugin('p2');
    expect(again).toBe(false);
  });

  it('loadPlugin should skip when engines.vanblog does not satisfy current version', async () => {
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as import('./plugin-context.service').PluginContextFactory;

    const hookService = {
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as import('./hook.service').HookService;

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
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as MinimalLogger;

    const pluginContextFactory = {
      createContext: vi.fn(),
    } as unknown as import('./plugin-context.service').PluginContextFactory;

    const hookService = {
      getAllActionHooks: vi.fn().mockReturnValue(['a1', 'a2']),
      getAllFilterHooks: vi.fn().mockReturnValue(['f1']),
      addAction: vi.fn(),
      addFilter: vi.fn(),
      removeAction: vi.fn(),
      removeFilter: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as import('./hook.service').HookService;

    const service = new LoaderService(logger as any, pluginContextFactory, hookService);

    const plugin = { id: 'id4', name: 'p4', version: '0.0.1' } as any;
    const ctx = { pluginId: 'p4' } as any;
    const meta = {
      pluginDir: '/p4',
      hooks: [
        { type: 'action' as const, hookName: 'hA', id: '1' },
        { type: 'filter' as const, hookName: 'hF', id: '2' },
      ],
    };

    service.registerExternalPlugin(plugin, ctx, meta);

    expect(service.getPluginContext('p4')).toBe(ctx);
    // call again to cover getters
    const m = service.getLoadedPlugins();
    expect(m.has('p4')).toBe(true);
    expect(logger.log).toHaveBeenCalled();
  });
});
