import { Module } from '@nestjs/common';
import { SettingService } from './services/setting.service';
import { SettingController } from './setting.controller';

@Module({
  controllers: [SettingController],
  providers: [SettingService],
})
export class SettingModule {}
