import { Module, OnModuleInit } from '@nestjs/common';
import { RewardController } from './reward.controller';
import { RewardService } from './reward.service';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [SettingModule],
  controllers: [RewardController],
  providers: [RewardService],
  exports: [RewardService],
})
export class RewardModule implements OnModuleInit {
  constructor(private readonly rewardService: RewardService) {}

  onModuleInit(): void {
    this.rewardService.registerConfig();
  }
}
