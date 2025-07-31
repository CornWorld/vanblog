import { Injectable } from '@nestjs/common';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { RewardInfoDto } from './dto/reward-info.dto';

export interface RewardInfo {
  name: string;
  value: string;
}

@Injectable()
export class RewardService {
  private readonly CONFIG_KEY = 'rewardInfo';

  constructor(private readonly settingRegistry: SettingRegistryService) {}

  registerConfig(): void {
    this.settingRegistry.registerConfig({
      key: this.CONFIG_KEY,
      defaultValue: [],
      description: 'Reward/donation payment methods',
      validator: (value: unknown) => {
        if (!Array.isArray(value)) {
          return false;
        }
        for (const reward of value) {
          if (typeof reward !== 'object' || reward === null) {
            return false;
          }
          const rewardItem = reward as RewardInfo;
          if (typeof rewardItem.name !== 'string' || typeof rewardItem.value !== 'string') {
            return false;
          }
        }
        return true;
      },
    });
  }

  async getRewardInfo(): Promise<RewardInfo[]> {
    return (await this.settingRegistry.getConfig<RewardInfo[]>(this.CONFIG_KEY)) ?? [];
  }

  async addOrUpdateRewardInfo(dto: RewardInfoDto): Promise<RewardInfo[]> {
    const rewards = await this.getRewardInfo();
    const index = rewards.findIndex((r) => r.name === dto.name);

    if (index !== -1) {
      rewards[index] = dto;
    } else {
      rewards.push(dto);
    }

    return this.settingRegistry.updateConfig(this.CONFIG_KEY, rewards);
  }

  async deleteRewardInfo(name: string): Promise<RewardInfo[]> {
    const rewards = await this.getRewardInfo();
    const filtered = rewards.filter((r) => r.name !== name);
    return this.settingRegistry.updateConfig(this.CONFIG_KEY, filtered);
  }
}
