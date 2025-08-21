// 插件：增强 /public/bootstrap 的 rewards 字段，支持通过配置追加并去重
// 同时提供完整的 reward 管理 API

import { Logger } from '@nestjs/common';

import { withPluginPrefix } from '../../src/modules/plugin/utils/prefix.util';

import { RewardService } from './reward.service';

import type { RewardInfo } from './reward.schema';
import type {
  ActionCallback,
  FilterCallback,
} from '../../src/modules/plugin/interfaces/hook.interface';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';

// /public/bootstrap 响应的最小子集类型
interface PublicBootstrapResponseLike {
  rewards: RewardInfo[];
  [key: string]: unknown;
}

const isValidReward = (r: unknown): r is RewardInfo => {
  if (r == null || typeof r !== 'object') return false;
  const obj = r as Record<string, unknown>;
  return typeof obj.name === 'string' && typeof obj.value === 'string';
};

// 插件 Logger 实例
const logger = new Logger(withPluginPrefix('rewards-plugin'));

// 创建服务实例
const rewardService = new RewardService();

const plugin: Plugin = {
  id: 'rewards-plugin',
  name: 'Rewards Plugin',
  version: '1.0.0',
  description: '通过插件配置向 /public/bootstrap 注入/合并 rewards，支持去重，并提供完整的管理 API',

  // 暴露奖励服务实例
  rewardService,

  async init(context: PluginContext): Promise<void> {
    // 预热：记录初始化时间与默认配置
    logger.log('插件正在初始化...');

    // 初始化奖励数据
    await context.data.set('extra_rewards', []);
    await context.data.set('boot_count', 0);

    // 设置服务上下文
    rewardService.setContext(context);
    await rewardService.onModuleInit();

    // 将服务实例暴露给插件对象
    plugin.rewardService = rewardService;

    // 从配置中读取额外的 rewards
    const extraRewards = context.config.get<RewardInfo[]>('extra_rewards', []);
    if (extraRewards.length > 0) {
      logger.log(`加载了 ${extraRewards.length} 个额外奖励配置`);
    }

    logger.log('奖励插件初始化成功');
  },

  async destroy(context: PluginContext): Promise<void> {
    const bootCount = (await context.data.get('boot_count')) as number | null | undefined;
    logger.log(`插件销毁，共启动 ${bootCount ?? 0} 次`);
    await context.data.clear();
    // 清理服务实例
    // rewardService 实例会在插件卸载时自动清理
  },

  // 暴露服务方法
  async getRewards(): Promise<RewardInfo[]> {
    return rewardService.getRewardInfo();
  },

  async addOrUpdateReward(reward: RewardInfo): Promise<void> {
    await rewardService.addOrUpdateRewardInfo(reward);
  },

  async deleteReward(id: string): Promise<void> {
    await rewardService.deleteRewardInfo(id);
  },

  hooks: {
    'bootstrap|beforeGenerate': {
      type: 'action',
      priority: 10,
      handler: (async (_value: unknown, context: PluginContext) => {
        const current = (await context.data.get('boot_count')) as number | null | undefined;
        const next = (typeof current === 'number' ? current : 0) + 1;
        await context.data.set('boot_count', next);
        logger.log(`beforeGenerate: 第 ${next} 次`);
      }) as ActionCallback,
    },

    'bootstrap|transformResponse': {
      type: 'filter',
      priority: 10,
      handler: (async (value: unknown, context: PluginContext) => {
        const resp = (value as PublicBootstrapResponseLike | null | undefined) ?? {
          rewards: [],
        };
        const baseRewards = Array.isArray(resp.rewards) ? resp.rewards.filter(isValidReward) : [];

        let extras = (await context.data.get('extra_rewards')) as unknown[] | null | undefined;
        if (!Array.isArray(extras)) {
          // 无缓存时从配置中心读取并回填缓存
          extras = context.config.get<RewardInfo[]>('extra_rewards', []).filter(isValidReward);
          await context.data.set('extra_rewards', extras);
        }
        const validExtras = extras.filter(isValidReward);

        // 合并逻辑：同名项由 extras 覆盖 base；保持去重
        const map = new Map<string, RewardInfo>();
        for (const r of baseRewards) {
          map.set(r.name, r);
        }
        for (const r of validExtras) {
          map.set(r.name, r); // 覆盖
        }

        return {
          ...resp,
          rewards: Array.from(map.values()),
        } as PublicBootstrapResponseLike;
      }) as FilterCallback,
    },

    'bootstrap|afterGenerate': {
      type: 'action',
      priority: 10,
      handler: ((_context: PluginContext, value: unknown) => {
        const resp = (value ?? {}) as PublicBootstrapResponseLike;
        const count = Array.isArray(resp.rewards) ? resp.rewards.length : 0;
        logger.log(`afterGenerate: rewards=${count}`);
      }) as ActionCallback,
    },
  },
};

export default plugin;
