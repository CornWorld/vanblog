import { Module, OnModuleInit } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PermissionController],
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionModule implements OnModuleInit {
  constructor(private readonly permissionService: PermissionService) {}

  async onModuleInit(): Promise<void> {
    // 在模块初始化时注册权限节点和权限组
    await this.permissionService.initializePermissions();
  }
}
