import { Module, OnModuleInit } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { PermissionModule } from '../permission/permission.module';
import { PermissionService } from '../permission/permission.service';

import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  imports: [SharedModule, PermissionModule],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule implements OnModuleInit {
  constructor(private readonly permissionService: PermissionService) {}

  onModuleInit(): void {
    // 注册标签模块的权限
    this.permissionService.register({
      module: 'tag',
      permissions: ['create', 'read', 'update', 'delete'],
      roles: {
        admin: ['create', 'read', 'update', 'delete'],
        editor: ['create', 'read', 'update', 'delete'],
        author: ['create', 'read'],
        viewer: ['read'],
      },
    });
  }
}
