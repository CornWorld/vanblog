import { describe, it, expect, vi, beforeEach } from 'vitest';
import plugin from './index';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

const createMockContext = (): PluginContext => ({
  pluginId: 'rewards-plugin',
  data: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(),
    keys: vi.fn(),
  },
  config: {
    get: vi.fn().mockImplementation((key: string, defaultValue: any) => defaultValue || []),
    getOrThrow: vi.fn(),
    has: vi.fn(),
  },
});

describe('🧩 bootstrap-reward-plugin', () => {
  let ctx: PluginContext;

  beforeEach(() => {
    ctx = createMockContext();
    vi.clearAllMocks();
  });

  describe('插件基本信息', () => {
    it('应包含正确的元信息', () => {
      expect(plugin.name).toBe('rewards-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toContain('rewards');
    });
  });

  describe('生命周期', () => {
    it('init: 初始化数据', async () => {
      await plugin.init!(ctx);

      expect(ctx.data.set).toHaveBeenCalledWith('extra_rewards', []);
      expect(ctx.data.set).toHaveBeenCalledWith('boot_count', 0);
    });

    it('destroy: 清理数据', async () => {
      await plugin.destroy!(ctx);
      expect(ctx.data.clear).toHaveBeenCalled();
    });
  });

  describe('hooks', () => {
    it('应有正确的钩子类型与优先级', () => {
      expect(plugin.hooks?.['bootstrap|beforeGenerate']?.type).toBe('action');
      expect(plugin.hooks?.['bootstrap|beforeGenerate']?.priority).toBe(10);
      expect(plugin.hooks?.['bootstrap|transformResponse']?.type).toBe('filter');
      expect(plugin.hooks?.['bootstrap|transformResponse']?.priority).toBe(10);
      expect(plugin.hooks?.['bootstrap|afterGenerate']?.type).toBe('action');
      expect(plugin.hooks?.['bootstrap|afterGenerate']?.priority).toBe(10);
    });

    it('beforeGenerate: 自增计数', async () => {
      (ctx.data.get as any).mockResolvedValueOnce(1); // boot_count=1

      const handler = plugin.hooks?.['bootstrap|beforeGenerate']?.handler as (
        value: unknown,
        context: PluginContext,
      ) => Promise<void>;

      await handler(undefined, ctx);

      expect(ctx.data.set).toHaveBeenCalledWith('boot_count', 2);
    });

    it('transformResponse: 使用缓存的 extras 合并并去重，extras 覆盖同名项', async () => {
      const cachedExtras = [
        { name: 'Coffee', value: 'extra://coffee' },
        { name: 'Alipay', value: 'ali://zz' },
      ];
      (ctx.data.get as any).mockImplementation(async (key: string) => {
        if (key === 'extra_rewards') return cachedExtras;
        return null;
      });

      const value = {
        rewards: [
          { name: 'Coffee', value: 'base://coffee' },
          { name: 'Snack', value: 'base://snack' },
        ],
        other: 123,
      } as any;

      const handler = plugin.hooks?.['bootstrap|transformResponse']?.handler as (
        value: unknown,
        context: PluginContext,
      ) => Promise<any>;

      const result = await handler(value, ctx);

      // 不应回写缓存（已有缓存）
      expect(ctx.data.set).not.toHaveBeenCalledWith('extra_rewards', expect.anything());

      expect(result.other).toBe(123);
      expect(result.rewards).toEqual(
        expect.arrayContaining([
          { name: 'Coffee', value: 'extra://coffee' }, // extras 覆盖 base
          { name: 'Snack', value: 'base://snack' },
          { name: 'Alipay', value: 'ali://zz' },
        ]),
      );
      // 名称去重
      const names = new Set(result.rewards.map((r: any) => r.name));
      expect(names.size).toBe(result.rewards.length);
    });

    it('transformResponse: 无缓存时使用空数组', async () => {
      (ctx.data.get as any).mockResolvedValueOnce(null); // 没有缓存

      const value = { rewards: [] } as any;
      const handler = plugin.hooks?.['bootstrap|transformResponse']?.handler as (
        value: unknown,
        context: PluginContext,
      ) => Promise<any>;

      const result = await handler(value, ctx);

      expect(result.rewards).toEqual([]);
      // 回填缓存
      expect(ctx.data.set).toHaveBeenCalledWith('extra_rewards', []);
    });

    it('afterGenerate: 处理完成', async () => {
      const handler = plugin.hooks?.['bootstrap|afterGenerate']?.handler as (
        value: unknown,
        context: PluginContext,
      ) => Promise<void>;

      await handler(
        {
          rewards: [
            { name: 'A', value: 'a' },
            { name: 'B', value: 'b' },
          ],
        },
        ctx,
      );

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });
});
