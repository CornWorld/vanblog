// 插件：增强 /public/bootstrap 的 rewards 字段，支持通过配置追加并去重
// 同时提供完整的 reward 管理 API

import { Logger } from '@nestjs/common';

import { withPluginPrefix } from '../../src/modules/plugin/utils/prefix.util';

import { RewardInfoArraySchema } from './reward.schema';
import { RewardService } from './reward.service';

import type { RewardInfo } from './reward.schema';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';

// 移除未使用的函数

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

    // 从配置中读取额外的 rewards（不写回存储，由提供者在聚合时合并）
    const extraRewardsFromConfig = context.config.get<RewardInfo[]>('extra_rewards', []);
    if (extraRewardsFromConfig.length > 0) {
      logger.log(`加载了 ${extraRewardsFromConfig.length} 个额外奖励配置`);
    }

    // 注册到插件注册表：提供 rewards 数据
    // 提供者会合并“存储中的奖励”和“配置中的奖励”，并按 name 去重
    context.registry.register(
      'rewards',
      async () => {
        const stored = await rewardService.getRewardInfo();
        const configured = context.config.get<RewardInfo[]>('extra_rewards', []);
        const all = [...stored, ...configured];
        const uniqueByName = new Map<string, RewardInfo>();
        for (const r of all) uniqueByName.set(r.name, r);

        return {
          version: '1.0.0',
          data: Array.from(uniqueByName.values()),
          schema: RewardInfoArraySchema,
        };
      },
      10,
    );

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
};

export default plugin;
