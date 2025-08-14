import { Module, OnModuleInit } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { PermissionModule } from '../permission/permission.module';
import { PermissionService } from '../permission/permission.service';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [SharedModule, PermissionModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule implements OnModuleInit {
  constructor(private readonly permissionService: PermissionService) {}

  onModuleInit(): void {
    // 注册分类模块的权限
    this.permissionService.registerModulePermissions('category', [
      'category:create',
      'category:read',
      'category:update',
      'category:delete',
    ]);

    // 为权限组注册权限
    this.permissionService.registerPermissionGroup('editor', [
      'category:create',
      'category:read',
      'category:update',
      'category:delete',
    ]);

    this.permissionService.registerPermissionGroup('author', ['category:read']);
    this.permissionService.registerPermissionGroup('viewer', ['category:read']);
  }
}
