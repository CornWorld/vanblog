import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';

import { SettingCoreService } from './services/setting-core.service';
import { SettingRegistryService } from './services/setting-registry.service';
import { SettingCoreController } from './setting-core.controller';
import { SettingCoreTsRestController } from './setting-core.ts-rest.controller';
import { SettingRegistryController } from './setting-registry.controller';

@Module({
  imports: [
    DatabaseModule,
    PermissionModule.forFeature(['setting:read', 'setting:update', 'setting:manage']),
  ],
  controllers: [SettingCoreController, SettingRegistryController, SettingCoreTsRestController],
  providers: [SettingCoreService, SettingRegistryService],
  exports: [SettingCoreService, SettingRegistryService],
})
export class SettingModule {}
