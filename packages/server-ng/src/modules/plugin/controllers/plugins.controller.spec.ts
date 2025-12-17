import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  PluginsController,
  type PluginListResponse,
  type PluginReloadResponse,
  type PluginUnloadResponse,
} from './plugins.controller';

import type { Plugin } from '../services/loader.service';

const makeMap = (plugins: Plugin[]): Map<string, Plugin> => {
  const m = new Map<string, Plugin>();
  for (const p of plugins) m.set(p.name, p);
  return m;
};

describe('PluginsController', () => {
  let controller: PluginsController;
  let loader: {
    getLoadedPlugins: () => Map<string, Plugin>;
    reloadPlugins: () => Promise<void>;
    unloadPlugin: (name: string) => Promise<boolean>;
  };
  let configService: {
    getSchema: (pluginId: string) => Record<string, unknown> | undefined;
    getConfig: (pluginId: string) => Promise<Record<string, unknown>>;
    setConfig: (pluginId: string, key: string, value: unknown) => Promise<boolean>;
    setConfigs: (
      pluginId: string,
      config: Record<string, unknown>,
    ) => Promise<Record<string, boolean>>;
  };

  beforeEach(() => {
    loader = {
      getLoadedPlugins: vi.fn(() => new Map<string, Plugin>()),
      reloadPlugins: vi.fn(async () => {
        await Promise.resolve();
      }),
      unloadPlugin: vi.fn(async (_: string) => {
        await Promise.resolve();
        return false;
      }),
    };
    configService = {
      getSchema: vi.fn((_: string) => undefined),
      getConfig: vi.fn(async (_: string) => ({})),
      setConfig: vi.fn(async (_: string, __: string, ___: unknown) => true),
      setConfigs: vi.fn(async (_: string, __: Record<string, unknown>) => ({})),
    };
    controller = new PluginsController(loader as any, configService as any);
  });

  it('should list zero plugins when none loaded', () => {
    (loader.getLoadedPlugins as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      new Map<string, Plugin>(),
    );

    const res: PluginListResponse = controller.getPlugins();
    expect(res.total).toBe(0);
    expect(res.plugins).toEqual([]);
  });

  it('should list loaded plugins with metadata', () => {
    const plugins: Plugin[] = [
      { id: 'a', name: 'a', version: '1.0.0', description: 'A' },
      { id: 'b', name: 'b', version: '2.0.0' },
    ];
    (loader.getLoadedPlugins as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMap(plugins),
    );

    const res: PluginListResponse = controller.getPlugins();
    expect(res.total).toBe(2);
    expect(res.plugins).toEqual([
      { name: 'a', version: '1.0.0', description: 'A', loaded: true },
      { name: 'b', version: '2.0.0', description: undefined, loaded: true },
    ]);
  });

  it('should get plugin by name or return null', () => {
    const plugins: Plugin[] = [{ id: 'a', name: 'a', version: '1.0.0' }];
    (loader.getLoadedPlugins as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMap(plugins),
    );

    const found = controller.getPlugin('a');
    expect(found?.name).toBe('a');
    const notFound = controller.getPlugin('x');
    expect(notFound).toBeNull();
  });

  it('should reload plugins and return success with loadedCount', async () => {
    (loader.getLoadedPlugins as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMap([
        { id: 'a', name: 'a', version: '1.0.0' },
        { id: 'b', name: 'b', version: '2.0.0' },
      ]),
    );

    const res: PluginReloadResponse = await controller.reloadPlugins();
    expect(loader.reloadPlugins).toHaveBeenCalled();
    expect(res.success).toBe(true);
    expect(res.message).toBe('Plugins reloaded successfully');
    expect(res.loadedCount).toBe(2);
  });

  it('should return failure when reload throws', async () => {
    (loader.reloadPlugins as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('boom'),
    );

    const res: PluginReloadResponse = await controller.reloadPlugins();
    expect(res.success).toBe(false);
    expect(res.message).toBe('boom');
    expect(res.loadedCount).toBe(0);
  });

  it('should unload plugin successfully', async () => {
    (loader.unloadPlugin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const res: PluginUnloadResponse = await controller.unloadPlugin('foo');
    expect(loader.unloadPlugin).toHaveBeenCalledWith('foo');
    expect(res).toEqual({ success: true, message: "Plugin 'foo' unloaded successfully" });
  });

  it('should report not found on unload failure', async () => {
    (loader.unloadPlugin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res: PluginUnloadResponse = await controller.unloadPlugin('bar');
    expect(loader.unloadPlugin).toHaveBeenCalledWith('bar');
    expect(res).toEqual({
      success: false,
      message: "Plugin 'bar' not found or failed to unload",
    });
  });
});
