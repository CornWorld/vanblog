import { Module } from '@nestjs/common';
import { SettingCoreService } from './services/setting-core.service';
import { SettingRegistryService } from './services/setting-registry.service';
import { SettingCoreController } from './setting-core.controller';
import { SettingRegistryController } from './setting-registry.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SettingCoreController, SettingRegistryController],
  providers: [SettingCoreService, SettingRegistryService],
  exports: [SettingCoreService, SettingRegistryService],
})
export class SettingModule {}
