import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginAPI } from '@vanblog/shared/plugin';

import plugin from './index';

describe('Reading Time Plugin', () => {
  let mockAPI: Partial<PluginAPI>;
  let filterHandlers: Map<string, Function>;
  let shortcodeHandlers: Map<string, Function>;

  beforeEach(() => {
    filterHandlers = new Map();
    shortcodeHandlers = new Map();

    mockAPI = {
      id: 'read-time-plugin',
      version: '1.0.0',
      dir: '/path/to/plugin',
      config: {
        enabled: true,
        wordsPerMinute: 200,
        showInArticle: true,
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
      filter: vi.fn((hookName: string, handler: Function) => {
        filterHandlers.set(hookName, handler);
      }) as any,
      action: vi.fn(),
      shortcode: vi.fn((name: string, handler: Function) => {
        shortcodeHandlers.set(name, handler);
      }),
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
      expect.stringContaining('Reading Time Plugin loaded'),
    );
  });

  it('should not load when disabled', () => {
    const apiWithDisabledConfig = { ...mockAPI, config: { enabled: false } };
    plugin(apiWithDisabledConfig as PluginAPI);

    expect(mockAPI.log?.warn).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    expect(mockAPI.filter).not.toHaveBeenCalled();
  });

  it('should register filter hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).toHaveBeenCalledWith('article|beforeCreate', expect.any(Function));
    expect(mockAPI.filter).toHaveBeenCalledWith('article|beforeUpdate', expect.any(Function));
  });

  it('should register markdown render filter when showInArticle is true', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).toHaveBeenCalledWith('markdown|render', expect.any(Function));
  });

  it('should not register markdown render filter when showInArticle is false', () => {
    const apiWithCustomConfig = {
      ...mockAPI,
      config: {
        enabled: true,
        wordsPerMinute: 200,
        showInArticle: false,
      },
    };
    plugin(apiWithCustomConfig as PluginAPI);

    const { calls } = (mockAPI.filter as any).mock;
    const hasMarkdownFilter = calls.some((call: any[]) => call[0] === 'markdown|render');

    expect(hasMarkdownFilter).toBe(false);
  });

  it('should calculate reading time correctly', () => {
    plugin(mockAPI as PluginAPI);

    const handler = filterHandlers.get('article|beforeCreate');
    expect(handler).toBeDefined();

    const article = {
      title: 'Test Article',
      content: '这是一篇测试文章。'.repeat(100), // ~600 Chinese chars
    };

    const result = handler!(article);
    expect(result).toBe(article);
  });

  it('should handle markdown content in reading time calculation', () => {
    plugin(mockAPI as PluginAPI);

    const handler = filterHandlers.get('markdown|render');
    expect(handler).toBeDefined();

    const content = `
# Title

This is a test article with **bold** and *italic* text.

\`\`\`javascript
const code = 'should be ignored';
\`\`\`

[Link](https://example.com) and ![Image](image.jpg) should also be ignored.

${'Regular text. '.repeat(50)}
    `;

    const result = handler!(content);

    // Should add reading time indicator
    expect(result).toContain('预计阅读时长');
    expect(result).toContain('分钟');
  });

  it('should register read-time shortcode', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.shortcode).toHaveBeenCalledWith('read-time', expect.any(Function));
  });

  it('should render read-time shortcode correctly', () => {
    plugin(mockAPI as PluginAPI);

    const handler = shortcodeHandlers.get('read-time');
    expect(handler).toBeDefined();

    const content = '这是测试内容。'.repeat(100);
    const result = handler!({}, content);

    expect(result).toContain('class="read-time"');
    expect(result).toContain('📖');
    expect(result).toContain('分钟');
  });

  it('should support custom emoji in shortcode', () => {
    plugin(mockAPI as PluginAPI);

    const handler = shortcodeHandlers.get('read-time');
    const content = 'Test content';
    const result = handler!({ emoji: '⏱️' }, content);

    expect(result).toContain('⏱️');
  });

  it('should support different time formats in shortcode', () => {
    plugin(mockAPI as PluginAPI);

    const handler = shortcodeHandlers.get('read-time');
    const content = '测试内容。'.repeat(50);

    // Minutes format (default)
    const minutesResult = handler!({}, content);
    expect(minutesResult).toContain('分钟');

    // Seconds format
    const secondsResult = handler!({ format: 'seconds' }, content);
    expect(secondsResult).toContain('秒');

    // Hours format
    const hoursResult = handler!({ format: 'hours' }, content);
    expect(hoursResult).toContain('小时');
  });

  it('should provide public data', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.provide).toHaveBeenCalledWith('readingTime', expect.any(Function));
  });

  it('should register lifecycle hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onActivate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockAPI.onDeactivate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should register config change listeners', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onConfigChange).toHaveBeenCalledWith('wordsPerMinute', expect.any(Function));
    expect(mockAPI.onConfigChange).toHaveBeenCalledWith('showInArticle', expect.any(Function));
  });

  it('should calculate at least 1 minute for very short content', () => {
    plugin(mockAPI as PluginAPI);

    const handler = filterHandlers.get('markdown|render');
    const shortContent = '短文本';

    const result = handler!(shortContent);

    // Should still show 1 minute minimum
    expect(result).toContain('1 分钟');
  });
});
