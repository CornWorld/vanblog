import { describe, it, expect, vi, beforeEach } from 'vitest';

import plugin from './index';

import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

// 模拟 PluginContext
// Mock Logger
const mockLogger = vi.hoisted(() => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
}));

vi.mock('@nestjs/common', () => ({
  Logger: vi.fn().mockImplementation(() => mockLogger),
}));

const createMockContext = (): PluginContext => ({
  pluginId: 'cat-plugin',
  data: {
    get: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
    keys: vi.fn().mockResolvedValue([]),
  },
  config: {
    get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'enable_title') return true;
      if (key === 'enable_content') return true;
      if (key === 'enable_tags') return true;
      return defaultValue;
    }),
    getOrThrow: vi.fn(),
    has: vi.fn().mockReturnValue(true),
  },
  registry: {
    register: vi.fn(),
    unregister: vi.fn().mockReturnValue(true),
  },
  hooks: {
    register: vi.fn(),
    unregister: vi.fn(),
  } as any,
  logger: mockLogger as any,
});

describe('🐱插件', () => {
  let mockContext: PluginContext;

  beforeEach(() => {
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('插件基本信息', () => {
    it('应该有正确的插件信息', () => {
      expect(plugin.id).toBe('cat-plugin');
      expect(plugin.name).toBe('Cat Plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toContain('喵');
    });
  });

  describe('初始化与销毁', () => {
    it('init: 应初始化状态', async () => {
      if (plugin.init) await plugin.init(mockContext);
      expect(mockContext.data.set).toHaveBeenCalledWith('initialized_at', expect.any(String));
      expect(mockContext.data.set).toHaveBeenCalledWith('processed_articles', 0);
    });

    it('destroy: 应清理数据', async () => {
      if (plugin.destroy) await plugin.destroy(mockContext);
      expect(mockContext.data.clear).toHaveBeenCalled();
    });
  });

  describe('过滤器行为', () => {
    beforeEach(() => {
      (mockContext.data.get as any).mockResolvedValue(0);
    });

    it('article|beforeCreate: 应添加喵并增加计数', async () => {
      const hook = plugin.hooks?.['article|beforeCreate'];
      expect(hook).toBeDefined();
      if (!hook || hook.type !== 'filter') return;

      const input = { title: 'Hello', content: 'World', tags: ['tag1', 'tag2喵'] } as any;
      const result = (hook as any).handler(input, mockContext);

      // 结果检查
      expect(result.title).toBe('Hello喵');
      expect(result.content).toBe('World喵');
      expect(result.tags).toEqual(['tag1喵', 'tag2喵']);

      // 等待微任务队列使内部计数更新触发
      await Promise.resolve();

      expect(mockContext.data.set).toHaveBeenCalledWith('processed_articles', 1);
      expect(mockLogger.log).toHaveBeenCalled();
    });
  });
});
