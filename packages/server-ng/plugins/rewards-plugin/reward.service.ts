import { Injectable, type OnModuleInit } from '@nestjs/common';
import { z } from 'zod';

import { RewardInfoSchema } from './reward.dto';

import type { RewardInfo } from './reward.schema';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

@Injectable()
export class RewardService implements OnModuleInit {
  private readonly CONFIG_KEY = 'extra_rewards';
  private context?: PluginContext;

  async onModuleInit(): Promise<void> {
    // 插件初始化时不需要注册配置，通过 PluginContext 管理
  }

  setContext(context: PluginContext): void {
    this.context = context;
  }

  async getRewardInfo(): Promise<RewardInfo[]> {
    if (!this.context) {
      throw new Error('Plugin context not initialized');
    }
    const rewards = await this.context.data.get<RewardInfo[]>(this.CONFIG_KEY);
    return rewards ?? [];
  }

  async addOrUpdateRewardInfo(dto: z.infer<typeof RewardInfoSchema>): Promise<RewardInfo[]> {
    const rewards = await this.getRewardInfo();
    const rewardData: RewardInfo = {
      name: dto.name,
      value: dto.value,
    };
    const index = rewards.findIndex((r) => r.name === dto.name);

    if (index !== -1) {
      rewards[index] = rewardData;
    } else {
      rewards.push(rewardData);
    }

    // 由于插件上下文可能不直接支持配置更新，我们可能需要通过其他方式
    // 实现配置更新，比如通过 SettingRegistryService
    await this.updateConfig(rewards);
    return rewards;
  }

  async deleteRewardInfo(name: string): Promise<RewardInfo[]> {
    const rewards = await this.getRewardInfo();
    const filtered = rewards.filter((r) => r.name !== name);
    await this.updateConfig(filtered);
    return filtered;
  }

  private async updateConfig(rewards: RewardInfo[]): Promise<void> {
    if (!this.context) {
      throw new Error('Plugin context not initialized');
    }
    // 这里需要实现配置更新逻辑
    // 由于插件上下文可能不直接支持配置更新，我们可能需要通过其他方式
    // 暂时使用 data 存储作为替代方案
    await this.context.data.set(this.CONFIG_KEY, rewards);
  }
}
