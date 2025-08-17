import { Module } from '@nestjs/common';

import { SettingModule } from '../../src/modules/setting/setting.module';

import { RewardController } from './reward.controller';
import { RewardService } from './reward.service';

@Module({
  imports: [SettingModule],
  controllers: [RewardController],
  providers: [RewardService],
})
export class RewardsPluginModule {}

// Export as default for plugin system
export default RewardsPluginModule;
