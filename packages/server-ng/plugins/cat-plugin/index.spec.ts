import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import plugin from './index';

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
});

describe('🐱插件', () => {
  let mockContext: PluginContext;

  beforeEach(() => {
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('插件基本信息', () => {
    it('应该有正确的插件信息', () => {
      expect(plugin.name).toBe('cat-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('🐱插件：在文章保存时在内容/标题/标签的结尾添加喵');
    });
  });

  describe('插件生命周期', () => {
    it('应该正确初始化', async () => {
      expect(plugin.init).toBeDefined();
      await plugin.init!(mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith('cat-plugin:插件正在初始化...');
      expect(mockLogger.log).toHaveBeenCalledWith('cat-plugin:插件初始化成功');
      expect(mockContext.data.set).toHaveBeenCalledWith('initialized_at', expect.any(String));
      expect(mockContext.data.set).toHaveBeenCalledWith('processed_articles', 0);
    });

    it('应该正确销毁', async () => {
      expect(plugin.destroy).toBeDefined();
      await plugin.destroy!(mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith('cat-plugin:插件正在销毁...');
      expect(mockLogger.log).toHaveBeenCalledWith('cat-plugin:插件销毁完成');
      expect(mockContext.data.clear).toHaveBeenCalled();
    });
  });

  describe('article|beforeCreate 钩子', () => {
    it('应该在标题结尾添加喵', () => {
      const handler = plugin.hooks?.['article|beforeCreate']?.handler;
      expect(handler).toBeDefined();

      const articleData = {
        title: '测试文章',
        content: '测试内容',
        tags: ['测试标签'],
      };

      const result = handler!(articleData, mockContext) as typeof articleData;

      expect(result.title).toBe('测试文章喵');
      expect(result.content).toBe('测试内容喵');
      expect(result.tags).toEqual(['测试标签喵']);
    });

    it('不应该重复添加喵', () => {
      const handler = plugin.hooks?.['article|beforeCreate']?.handler;
      expect(handler).toBeDefined();

      const articleData = {
        title: '测试文章喵',
        content: '测试内容喵',
        tags: ['测试标签喵'],
      };

      const result = handler!(articleData, mockContext) as typeof articleData;

      expect(result.title).toBe('测试文章喵');
      expect(result.content).toBe('测试内容喵');
      expect(result.tags).toEqual(['测试标签喵']);
    });

    it('应该处理空值和无效数据', () => {
      const handler = plugin.hooks?.['article|beforeCreate']?.handler;
      expect(handler).toBeDefined();

      // 测试 null
      expect(handler!(null, mockContext)).toBe(null);

      // 测试 undefined
      expect(handler!(undefined, mockContext)).toBe(undefined);

      // 测试非对象
      expect(handler!('string', mockContext)).toBe('string');

      // 测试空对象
      const emptyResult = handler!({}, mockContext);
      expect(emptyResult).toEqual({});
    });

    it('应该根据配置选择性处理字段', () => {
      // 模拟配置：只处理标题
      const contextWithConfig = createMockContext();
      contextWithConfig.config.get = vi
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'enable_title') return true;
          if (key === 'enable_content') return false;
          if (key === 'enable_tags') return false;
          return defaultValue;
        });

      const handler = plugin.hooks?.['article|beforeCreate']?.handler;
      expect(handler).toBeDefined();

      const articleData = {
        title: '测试文章',
        content: '测试内容',
        tags: ['测试标签'],
      };

      const result = handler!(articleData, contextWithConfig) as typeof articleData;

      expect(result.title).toBe('测试文章喵');
      expect(result.content).toBe('测试内容'); // 不应该被修改
      expect(result.tags).toEqual(['测试标签']); // 不应该被修改
    });
  });

  describe('article|beforeUpdate 钩子', () => {
    it('应该在更新时添加喵', () => {
      const handler = plugin.hooks?.['article|beforeUpdate']?.handler;
      expect(handler).toBeDefined();

      const articleData = {
        title: '更新文章',
        content: '更新内容',
        tags: ['更新标签'],
      };

      const result = handler!(articleData, mockContext) as typeof articleData;

      expect(result.title).toBe('更新文章喵');
      expect(result.content).toBe('更新内容喵');
      expect(result.tags).toEqual(['更新标签喵']);
      expect(mockLogger.log).toHaveBeenCalledWith('cat-plugin:已为更新的文章添加喵~');
    });
  });

  describe('钩子配置', () => {
    it('应该有正确的钩子类型和优先级', () => {
      expect(plugin.hooks?.['article|beforeCreate']?.type).toBe('filter');
      expect(plugin.hooks?.['article|beforeCreate']?.priority).toBe(10);

      expect(plugin.hooks?.['article|beforeUpdate']?.type).toBe('filter');
      expect(plugin.hooks?.['article|beforeUpdate']?.priority).toBe(10);
    });
  });
});
