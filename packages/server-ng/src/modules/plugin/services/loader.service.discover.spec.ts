import { join } from 'path';

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared before importing the SUT
const readdirMock = vi.fn();
const statMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('fs/promises', () => ({
  readdir: (...args: any[]) => readdirMock(...args),
  stat: (...args: any[]) => statMock(...args),
  readFile: (...args: any[]) => readFileMock(...args),
}));

const loadNestDynamicModulesMock = vi.fn();
const hasNestModuleMock = vi.fn();

vi.mock('../utils/module-loader.util', () => ({
  loadNestDynamicModules: (...args: any[]) => loadNestDynamicModulesMock(...args),
  hasNestModule: (...args: any[]) => hasNestModuleMock(...args),
}));

import { discoverNestDynamicModules } from './loader.service';

import type { Logger } from '@nestjs/common';

function dirent(name: string): { name: string; isDirectory: () => boolean } {
  return { name, isDirectory: () => true };
}

describe('discoverNestDynamicModules', () => {
  const logger: Pick<Logger, 'log'> = { log: vi.fn() } as any;
  const pluginsDir = '/virtual/plugins';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps object-style plugins and merges with discovered Nest modules', async () => {
    // Given filesystem structure
    readdirMock.mockResolvedValue([
      dirent('a-plugin'),
      dirent('b-module'),
      dirent('d-object-main'),
      dirent('node_modules'),
      dirent('.hidden'),
      dirent('_tmp'),
      dirent('dist'),
      dirent('coverage'),
    ]);

    // hasNestModule: only b-module is a Nest module, skip wrapping
    hasNestModuleMock.mockImplementation((p: string) => p.endsWith('/b-module'));

    // loadNestDynamicModules: returns one real module
    loadNestDynamicModulesMock.mockResolvedValue([{ module: class RealNestMod {}, providers: [] }]);

    // stat: only a-plugin/index.js exists
    statMock.mockImplementation((p: string) => {
      if (p === join(pluginsDir, 'a-plugin', 'index.js')) return { isFile: () => true } as any;
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    // readFile: only d-object-main/package.json has a valid main
    readFileMock.mockImplementation((p: string, _enc?: string) => {
      if (p === join(pluginsDir, 'd-object-main', 'package.json')) {
        return JSON.stringify({ main: 'lib.js' });
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const mods = await discoverNestDynamicModules(pluginsDir, logger as Logger);

    // 1 from loadNestDynamicModules + 2 wrapped (a-plugin via index.js, d-object-main via package.json.main)
    expect(mods.length).toBe(3);

    // Assert wrapper providers include PLUGIN_DIR for the two object plugins
    const wrappedDirs = new Set<string>();
    for (const m of mods) {
      const { providers } = m as unknown as { providers?: unknown[] };
      if (!providers || !Array.isArray(providers)) continue;
      for (const prov of providers) {
        if (typeof prov === 'object' && prov !== null) {
          const p = prov as { provide?: unknown; useValue?: unknown };
          if (p.provide === 'PLUGIN_DIR') {
            wrappedDirs.add(String(p.useValue));
          }
        }
      }
    }
    expect(wrappedDirs.has(join(pluginsDir, 'a-plugin'))).toBe(true);
    expect(wrappedDirs.has(join(pluginsDir, 'd-object-main'))).toBe(true);

    // Logger should be called for wrapped entries (not for hidden/ignored ones)
    expect((logger.log as any).mock.calls.flat().join('\n')).toContain(
      'Wrapping plugin object as DynamicModule: a-plugin',
    );
    expect((logger.log as any).mock.calls.flat().join('\n')).toContain(
      'Wrapping plugin object as DynamicModule: d-object-main',
    );
  });

  it('tolerates missing plugins directory and returns only discovered Nest modules', async () => {
    // readdir throws
    readdirMock.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    loadNestDynamicModulesMock.mockResolvedValue([]);

    const mods = await discoverNestDynamicModules(pluginsDir, logger as Logger);
    expect(mods).toEqual([]);
  });

  it('skips object plugins that fail isLikelyObjectStylePlugin checks due to invalid JSON files', async () => {
    // Given filesystem structure with a potential object plugin
    readdirMock.mockResolvedValue([dirent('malformed-plugin')]);

    // hasNestModule: not a Nest module
    hasNestModuleMock.mockImplementation(() => false);
    loadNestDynamicModulesMock.mockResolvedValue([]);

    // stat: no index.* files exist
    statMock.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    // readFile: package.json contains malformed JSON
    readFileMock.mockImplementation((p: string) => {
      if (p === join(pluginsDir, 'malformed-plugin', 'package.json')) {
        return '{ invalid json }'; // Malformed JSON
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const mods = await discoverNestDynamicModules(pluginsDir, logger as Logger);

    // Should return empty array since the malformed plugin is skipped
    expect(mods).toEqual([]);
    expect((logger.log as any).mock.calls).toEqual([]);
  });

  it('handles mixed scenarios with some plugins failing and others succeeding', async () => {
    // Given filesystem structure with multiple plugins
    readdirMock.mockResolvedValue([
      dirent('good-plugin'),
      dirent('bad-json-plugin'),
      dirent('no-files-plugin'),
      dirent('nest-module'),
    ]);

    // hasNestModule: only nest-module is a Nest module
    hasNestModuleMock.mockImplementation((p: string) => p.endsWith('/nest-module'));
    loadNestDynamicModulesMock.mockResolvedValue([{ module: class NestMod {}, providers: [] }]);

    // stat: good-plugin has index.js, others don't
    statMock.mockImplementation((p: string) => {
      if (p === join(pluginsDir, 'good-plugin', 'index.js')) return { isFile: () => true } as any;
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    // readFile: bad-json-plugin has malformed package.json
    readFileMock.mockImplementation((p: string) => {
      if (p === join(pluginsDir, 'bad-json-plugin', 'package.json')) {
        return '{ "main": }'; // Invalid JSON
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const mods = await discoverNestDynamicModules(pluginsDir, logger as Logger);

    // Should return 1 Nest module + 1 wrapped object plugin (good-plugin)
    expect(mods.length).toBe(2);

    // Verify good-plugin was wrapped
    const wrappedDirs = new Set<string>();
    for (const m of mods) {
      const { providers } = m as unknown as { providers?: unknown[] };
      if (!providers || !Array.isArray(providers)) continue;
      for (const prov of providers) {
        if (typeof prov === 'object' && prov !== null) {
          const p = prov as { provide?: unknown; useValue?: unknown };
          if (p.provide === 'PLUGIN_DIR') {
            wrappedDirs.add(String(p.useValue));
          }
        }
      }
    }
    expect(wrappedDirs.has(join(pluginsDir, 'good-plugin'))).toBe(true);
    expect(wrappedDirs.has(join(pluginsDir, 'bad-json-plugin'))).toBe(false);
    expect(wrappedDirs.has(join(pluginsDir, 'no-files-plugin'))).toBe(false);

    // Logger should only mention the good plugin
    expect((logger.log as any).mock.calls.flat().join('\n')).toContain(
      'Wrapping plugin object as DynamicModule: good-plugin',
    );
    expect((logger.log as any).mock.calls.flat().join('\n')).not.toContain('bad-json-plugin');
    expect((logger.log as any).mock.calls.flat().join('\n')).not.toContain('no-files-plugin');
  });

  it('isolates plugin failures and continues processing other plugins', async () => {
    // Given filesystem structure
    readdirMock.mockResolvedValue([dirent('crash-plugin'), dirent('good-plugin')]);

    hasNestModuleMock.mockImplementation(() => false);
    loadNestDynamicModulesMock.mockResolvedValue([]);

    // stat: both plugins have index.js
    statMock.mockImplementation((p: string) => {
      if (p.includes('index.js')) return { isFile: () => true } as any;
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    // Mock hasNestModule to throw error for crash-plugin but succeed for good-plugin
    hasNestModuleMock.mockImplementation((p: string) => {
      if (p.endsWith('/crash-plugin')) {
        throw new Error('Simulated hasNestModule failure');
      }
      return false;
    });

    const mods = await discoverNestDynamicModules(pluginsDir, logger as Logger);

    // Should still wrap the good plugin despite crash-plugin failing
    expect(mods.length).toBe(1);

    const wrappedDirs = new Set<string>();
    for (const m of mods) {
      const { providers } = m as unknown as { providers?: unknown[] };
      if (!providers || !Array.isArray(providers)) continue;
      for (const prov of providers) {
        if (typeof prov === 'object' && prov !== null) {
          const p = prov as { provide?: unknown; useValue?: unknown };
          if (p.provide === 'PLUGIN_DIR') {
            wrappedDirs.add(String(p.useValue));
          }
        }
      }
    }
    expect(wrappedDirs.has(join(pluginsDir, 'good-plugin'))).toBe(true);
    expect(wrappedDirs.has(join(pluginsDir, 'crash-plugin'))).toBe(false);
  });

  it('recognizes object plugins through plugin.json main field', async () => {
    readdirMock.mockResolvedValue([dirent('plugin-json-main')]);

    hasNestModuleMock.mockImplementation(() => false);
    loadNestDynamicModulesMock.mockResolvedValue([]);

    // stat: no index.* files
    statMock.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    // readFile: plugin.json has main field, package.json doesn't exist
    readFileMock.mockImplementation((p: string) => {
      if (p === join(pluginsDir, 'plugin-json-main', 'plugin.json')) {
        return JSON.stringify({ main: 'custom.js' });
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const mods = await discoverNestDynamicModules(pluginsDir, logger as Logger);

    expect(mods.length).toBe(1);
    expect((logger.log as any).mock.calls.flat().join('\n')).toContain(
      'Wrapping plugin object as DynamicModule: plugin-json-main',
    );
  });

  it('propagates errors from loadNestDynamicModules', async () => {
    readdirMock.mockResolvedValue([]);
    loadNestDynamicModulesMock.mockRejectedValue(new Error('Module loader failed'));

    await expect(discoverNestDynamicModules(pluginsDir, logger as Logger)).rejects.toThrow(
      'Module loader failed',
    );
  });
});
