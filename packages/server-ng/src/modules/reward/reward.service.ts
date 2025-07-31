import { Injectable } from '@nestjs/common';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { RewardInfoDto } from './dto/reward-info.dto';
import { RewardInfoArraySchema, RewardInfo } from './reward.schema';

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
        const result = RewardInfoArraySchema.safeParse(value);
        return result.success;
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
