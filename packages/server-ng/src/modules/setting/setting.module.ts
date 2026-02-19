import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database';
import { PermissionModule } from '../permission/permission.module';

import { CaddyController } from './caddy.controller';
import { CustomPagesAdminController } from './custom-pages.controller';
import { CustomPagesService } from './services/custom-pages.service';
import { SettingCoreService } from './services/setting-core.service';
import { SettingRegistryService } from './services/setting-registry.service';
import { SettingCoreController } from './setting-core.controller';
import { SettingRegistryController } from './setting-registry.controller';

@Module({
  imports: [
    DatabaseModule,
    PermissionModule.forFeature(['setting:read', 'setting:update', 'setting:manage']),
  ],
  controllers: [
    SettingCoreController,
    SettingRegistryController,
    CaddyController,
    CustomPagesAdminController,
  ],
  providers: [SettingCoreService, SettingRegistryService, CustomPagesService],
  exports: [SettingCoreService, SettingRegistryService, CustomPagesService],
})
export class SettingModule {}
