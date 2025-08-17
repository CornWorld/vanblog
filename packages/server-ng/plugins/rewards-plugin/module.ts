import { Module, type DynamicModule } from '@nestjs/common';

import { SettingModule } from '../../src/modules/setting/setting.module';

import { RewardController } from './reward.controller';
import { RewardService } from './reward.service';

// Rewards 插件模块，可以被动态加载
@Module({
  imports: [SettingModule],
  controllers: [RewardController],
  providers: [RewardService],
})
class RewardsPluginModule {}

// 导出为默认模块用于动态加载
const pluginModule: DynamicModule = {
  module: RewardsPluginModule,
  imports: [SettingModule],
  controllers: [RewardController],
  providers: [RewardService],
  exports: [],
};

export default pluginModule;
export { pluginModule as RewardsPluginModule };
export { pluginModule as PluginModule };
