import { describe, it, expect, vi, beforeEach } from 'vitest';

import plugin from './index';

import type { RewardService } from './reward.service';
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
    get: vi.fn().mockImplementation((_key: string, defaultValue: unknown) => defaultValue ?? []),
    getOrThrow: vi.fn(),
    has: vi.fn(),
  },
  registry: {
    register: vi.fn(),
    unregister: vi.fn().mockReturnValue(true),
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
      expect(plugin.id).toBe('rewards-plugin');
      expect(plugin.name).toBe('Rewards Plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toContain('rewards');
    });
  });

  describe('生命周期', () => {
    it('init: 初始化数据并注册 provider', async () => {
      if (plugin.init) {
        await plugin.init(ctx);
      }

      expect(ctx.data.set).toHaveBeenCalledWith('extra_rewards', []);
      expect(ctx.data.set).toHaveBeenCalledWith('boot_count', 0);
      expect(ctx.registry.register).toHaveBeenCalledTimes(1);
      expect(ctx.registry.register).toHaveBeenCalledWith(
        'rewards',
        expect.any(Function),
        expect.any(Number),
      );
    });

    it('destroy: 清理数据并注销 provider', async () => {
      if (plugin.init) await plugin.init(ctx);
      if (plugin.destroy) {
        await plugin.destroy(ctx);
      }
      expect(ctx.data.clear).toHaveBeenCalled();
    });
  });

  describe('服务方法', () => {
    it('getRewards: 获取奖励列表', async () => {
      const pluginWithMethods = plugin as typeof plugin & {
        getRewards: () => Promise<unknown[]>;
      };
      const rewards = await pluginWithMethods.getRewards();
      expect(Array.isArray(rewards)).toBe(true);
    });

    it('addOrUpdateReward: 添加或更新奖励', async () => {
      const pluginWithMethods = plugin as typeof plugin & {
        addOrUpdateReward: (reward: unknown) => Promise<void>;
      };
      const reward = { name: 'Test', value: 'test://reward' };
      await expect(pluginWithMethods.addOrUpdateReward(reward)).resolves.not.toThrow();
    });

    it('deleteReward: 删除奖励', async () => {
      const pluginWithMethods = plugin as typeof plugin & {
        deleteReward: (id: string) => Promise<void>;
      };
      await expect(pluginWithMethods.deleteReward('test-id')).resolves.not.toThrow();
    });
  });

  describe('插件注册表集成', () => {
    it('应该支持通过插件注册表提供数据', async () => {
      if (plugin.init) await plugin.init(ctx);
      expect(plugin.id).toBe('rewards-plugin');
      expect(plugin.rewardService).toBeDefined();
      expect(ctx.registry.register).toHaveBeenCalled();
    });
  });

  describe('RewardService', () => {
    let rewardService: RewardService;

    beforeEach(async () => {
      // 初始化插件以设置 rewardService
      if (plugin.init) {
        await plugin.init(ctx);
      }
      rewardService = (plugin as { rewardService?: RewardService }).rewardService as RewardService;
      expect(rewardService).toBeDefined();
    });

    describe('getRewardInfo', () => {
      it('应返回存储的奖励信息', async () => {
        const mockRewards = [
          { name: 'Alipay', value: 'alipay://test' },
          { name: 'WeChat', value: 'wechat://test' },
        ];
        (ctx.data.get as any).mockResolvedValueOnce(mockRewards);

        const result = await rewardService.getRewardInfo();

        expect(ctx.data.get).toHaveBeenCalledWith('extra_rewards');
        expect(result).toEqual(mockRewards);
      });

      it('应在没有数据时返回空数组', async () => {
        (ctx.data.get as any).mockResolvedValueOnce(null);

        const result = await rewardService.getRewardInfo();

        expect(result).toEqual([]);
      });
    });

    describe('addOrUpdateRewardInfo', () => {
      it('应添加新的奖励信息', async () => {
        const existingRewards = [{ name: 'Alipay', value: 'alipay://old' }];
        const newReward = { name: 'WeChat', value: 'wechat://new' };
        const expectedRewards = [
          { name: 'Alipay', value: 'alipay://old' },
          { name: 'WeChat', value: 'wechat://new' },
        ];

        (ctx.data.get as any).mockResolvedValueOnce(existingRewards);
        await rewardService.addOrUpdateRewardInfo(newReward as any);

        expect(ctx.data.set).toHaveBeenCalledWith('extra_rewards', expectedRewards);
      });

      it('应更新已有的奖励信息', async () => {
        const existingRewards = [
          { name: 'Alipay', value: 'alipay://old' },
          { name: 'WeChat', value: 'wechat://old' },
        ];
        const updatedReward = { name: 'WeChat', value: 'wechat://updated' };
        const expectedRewards = [
          { name: 'Alipay', value: 'alipay://old' },
          { name: 'WeChat', value: 'wechat://updated' },
        ];

        (ctx.data.get as any).mockResolvedValueOnce(existingRewards);
        await rewardService.addOrUpdateRewardInfo(updatedReward as any);

        expect(ctx.data.set).toHaveBeenCalledWith('extra_rewards', expectedRewards);
      });

      it('应处理空的初始奖励列表', async () => {
        (ctx.data.get as any).mockResolvedValueOnce([]);
        const newReward = { name: 'Alipay', value: 'alipay://new' };

        await rewardService.addOrUpdateRewardInfo(newReward as any);

        expect(ctx.data.set).toHaveBeenCalledWith('extra_rewards', [newReward]);
      });
    });

    describe('deleteRewardInfo', () => {
      it('应删除指定的奖励信息', async () => {
        const existingRewards = [
          { name: 'Alipay', value: 'alipay://old' },
          { name: 'WeChat', value: 'wechat://old' },
        ];
        (ctx.data.get as any).mockResolvedValueOnce(existingRewards);

        await rewardService.deleteRewardInfo('WeChat');

        expect(ctx.data.set).toHaveBeenCalledWith('extra_rewards', [
          { name: 'Alipay', value: 'alipay://old' },
        ]);
      });
    });
  });
});
