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
