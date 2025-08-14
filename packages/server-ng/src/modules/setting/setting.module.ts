import { Module, OnModuleInit } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { PermissionModule } from '../permission/permission.module';
import { PermissionService } from '../permission/permission.service';

import { SettingCoreService } from './services/setting-core.service';
import { SettingRegistryService } from './services/setting-registry.service';
import { SettingCoreController } from './setting-core.controller';
import { SettingRegistryController } from './setting-registry.controller';

@Module({
  imports: [DatabaseModule, PermissionModule],
  controllers: [SettingCoreController, SettingRegistryController],
  providers: [SettingCoreService, SettingRegistryService],
  exports: [SettingCoreService, SettingRegistryService],
})
export class SettingModule implements OnModuleInit {
  constructor(private readonly permissionService: PermissionService) {}

  onModuleInit(): void {
    // 注册设置模块的权限
    this.permissionService.register({
      module: 'setting',
      permissions: ['read', 'update', 'manage'],
      roles: {
        admin: ['read', 'update', 'manage'],
        editor: ['read'],
      },
    });
  }
}
