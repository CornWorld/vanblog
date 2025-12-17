import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginAPI } from '@vanblog/shared/plugin';

import plugin from './index';

describe('Cat Plugin (Functional API)', () => {
  let mockAPI: Partial<PluginAPI>;
  let storeValues: Map<string, any>;

  beforeEach(() => {
    storeValues = new Map();

    mockAPI = {
      id: 'cat-plugin',
      version: '1.0.0',
      dir: '/path/to/plugin',
      config: {
        enableTitle: true,
        enableContent: true,
        enableTags: true,
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
      store: vi.fn((key: string, defaultValue: any) => ({
        get value() {
          return storeValues.has(key) ? storeValues.get(key) : defaultValue;
        },
        set value(newValue: any) {
          storeValues.set(key, newValue);
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
    expect(mockAPI.log?.info).toHaveBeenCalledWith('Cat Plugin 加载成功');
  });

  it('should register filter hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).toHaveBeenCalledWith('article.beforeCreate', expect.any(Function));
    expect(mockAPI.filter).toHaveBeenCalledWith('article.beforeUpdate', expect.any(Function));
  });

  it('should register shortcode hook', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.shortcode).toHaveBeenCalledWith('cat', expect.any(Function));
  });

  it('should register lifecycle hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onActivate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockAPI.onDeactivate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should process article title when filter is called', () => {
    let filterHandler: any;
    mockAPI.filter = vi.fn((hookName, handler) => {
      if (hookName === 'article.beforeCreate') {
        filterHandler = handler;
      }
    }) as any;

    plugin(mockAPI as PluginAPI);

    const article = { title: 'Test', content: 'Content', tags: ['tag1'] };
    const result = filterHandler(article);

    expect(result.title).toBe('Test喵');
    expect(result.content).toBe('Content喵');
    expect(result.tags).toEqual(['tag1喵']);
  });

  it('should not add 喵 if already present', () => {
    let filterHandler: any;
    mockAPI.filter = vi.fn((hookName, handler) => {
      if (hookName === 'article.beforeCreate') {
        filterHandler = handler;
      }
    }) as any;

    plugin(mockAPI as PluginAPI);

    const article = { title: 'Test喵', content: 'Content喵', tags: ['tag1喵'] };
    const result = filterHandler(article);

    expect(result.title).toBe('Test喵');
    expect(result.content).toBe('Content喵');
    expect(result.tags).toEqual(['tag1喵']);
  });

  it('should respect config settings', () => {
    const apiWithCustomConfig = {
      ...mockAPI,
      config: {
        enableTitle: false,
        enableContent: true,
        enableTags: false,
      },
    };

    let filterHandler: any;
    apiWithCustomConfig.filter = vi.fn((hookName, handler) => {
      if (hookName === 'article.beforeCreate') {
        filterHandler = handler;
      }
    }) as any;

    plugin(apiWithCustomConfig as PluginAPI);

    const article = { title: 'Test', content: 'Content', tags: ['tag1'] };
    const result = filterHandler(article);

    expect(result.title).toBe('Test'); // not modified
    expect(result.content).toBe('Content喵'); // modified
    expect(result.tags).toEqual(['tag1']); // not modified
  });

  it('should process shortcode correctly', () => {
    let shortcodeHandler: any;
    mockAPI.shortcode = vi.fn((name, handler) => {
      if (name === 'cat') {
        shortcodeHandler = handler;
      }
    });

    plugin(mockAPI as PluginAPI);

    // Default emoji
    expect(shortcodeHandler({}, '')).toBe('🐱');

    // With mood
    expect(shortcodeHandler({ mood: 'happy' }, '')).toBe('😺');

    // With content
    expect(shortcodeHandler({}, '喵喵')).toBe('🐱喵喵🐱');
    expect(shortcodeHandler({ mood: 'love' }, '喵喵')).toBe('😻喵喵😻');
  });

  it('should increment processed count', () => {
    let filterHandler: any;
    mockAPI.filter = vi.fn((hookName, handler) => {
      if (hookName === 'article.beforeCreate') {
        filterHandler = handler;
      }
    }) as any;

    plugin(mockAPI as PluginAPI);

    const article = { title: 'Test', content: 'Content', tags: [] };

    filterHandler(article);
    expect(storeValues.get('processedCount')).toBe(1);

    filterHandler(article);
    expect(storeValues.get('processedCount')).toBe(2);
  });
});
