import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginAPI } from '@vanblog/shared/plugin';

import plugin from './index';

describe('Social Links Plugin', () => {
  let mockAPI: Partial<PluginAPI>;
  let storeValue: any[];

  beforeEach(() => {
    storeValue = [];

    mockAPI = {
      id: 'social-links-plugin',
      version: '1.0.0',
      dir: '/path/to/plugin',
      config: { enabled: true },
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
        get value() {
          return storeValue.length > 0 ? storeValue : defaultValue;
        },
        set value(newValue: any) {
          storeValue = newValue;
        },
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
      expect.stringContaining('Social links plugin initializing'),
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

  it('should provide socialLinks data', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.provide).toHaveBeenCalledWith('socialLinks', expect.any(Function));
  });

  it('should register action hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.action).toHaveBeenCalledWith('socialLinks|addOrUpdate', expect.any(Function));
    expect(mockAPI.action).toHaveBeenCalledWith('socialLinks|delete', expect.any(Function));
  });

  it('should register lifecycle hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onActivate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockAPI.onDeactivate).toHaveBeenCalledWith(expect.any(Function));
  });
});
