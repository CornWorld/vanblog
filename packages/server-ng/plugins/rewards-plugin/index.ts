// 插件：增强 /public/bootstrap 的 rewards 字段，支持通过配置追加并去重
// 同时提供完整的 reward 管理 API

import { Logger } from '@nestjs/common';

import { withPluginPrefix } from '../../src/modules/plugin/utils/prefix.util';

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

    // 从配置中读取额外的 rewards
    const extraRewards = context.config.get<RewardInfo[]>('extra_rewards', []);
    if (extraRewards.length > 0) {
      logger.log(`加载了 ${extraRewards.length} 个额外奖励配置`);
    }

    // TODO: 注册到插件注册表
    // 需要扩展 PluginContext 接口以支持服务访问
    logger.log('插件注册表集成待实现');

    logger.log('奖励插件初始化成功');
  },

  async destroy(context: PluginContext): Promise<void> {
    const bootCount = (await context.data.get('boot_count')) as number | null | undefined;
    logger.log(`插件销毁，共启动 ${bootCount ?? 0} 次`);

    // TODO: 从插件注册表中注销
    // 需要扩展 PluginContext 接口以支持服务访问

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

  // 移除钩子系统，改用插件注册表模式
  // 所有数据通过 init 方法中的注册表注册提供
};

export default plugin;
