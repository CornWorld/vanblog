import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginAPI } from '@vanblog/shared/plugin';

import plugin from './index';

describe('Beian Plugin', () => {
  let mockAPI: Partial<PluginAPI>;

  beforeEach(() => {
    mockAPI = {
      id: 'beian-plugin',
      version: '1.0.0',
      dir: '/path/to/plugin',
      config: {
        enabled: true,
        icp: 'ICP 12345678',
        policeIcp: '公网安备 12345678901234 号',
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
      filter: vi.fn(),
      action: vi.fn(),
      shortcode: vi.fn(),
      provide: vi.fn(),
      store: vi.fn((_key: string, defaultValue: any) => ({
        value: defaultValue,
      })),
      onActivate: vi.fn(),
      onDeactivate: vi.fn(),
      onConfigChange: vi.fn(),
    };
  });

  it('should load plugin successfully', () => {
    expect(() => {
      plugin(mockAPI as PluginAPI);
    }).not.toThrow();
    expect(mockAPI.log?.info).toHaveBeenCalledWith(
      expect.stringContaining('Beian plugin initializing'),
    );
    expect(mockAPI.log?.info).toHaveBeenCalledWith(
      expect.stringContaining('initialized successfully'),
    );
  });

  it('should not load when disabled', () => {
    const apiWithDisabledConfig = { ...mockAPI, config: { enabled: false } };
    plugin(apiWithDisabledConfig as PluginAPI);

    expect(mockAPI.log?.warn).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    expect(mockAPI.provide).not.toHaveBeenCalled();
  });

  it('should provide beian data', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.provide).toHaveBeenCalledWith('beian', expect.any(Function));
  });

  it('should register action hook for beian update', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.action).toHaveBeenCalledWith('beian|update', expect.any(Function));
  });

  it('should register config change listeners', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onConfigChange).toHaveBeenCalledWith('icp', expect.any(Function));
    expect(mockAPI.onConfigChange).toHaveBeenCalledWith('policeIcp', expect.any(Function));
  });

  it('should register lifecycle hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onActivate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockAPI.onDeactivate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should use default values when config is empty', () => {
    const apiWithEmptyConfig = { ...mockAPI, config: { enabled: true } };
    plugin(apiWithEmptyConfig as PluginAPI);

    expect(mockAPI.store).toHaveBeenCalledWith('beianInfo', {
      icp: 'ICP 12345678',
      policeIcp: '公网安备 12345678901234 号',
    });
  });

  it('should use configured values', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.store).toHaveBeenCalledWith('beianInfo', {
      icp: 'ICP 12345678',
      policeIcp: '公网安备 12345678901234 号',
    });
  });
});
