import { Module, OnModuleInit } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PermissionModule } from '../permission/permission.module';
import { PermissionService } from '../permission/permission.service';
import { PluginModule } from '../plugin/plugin.module';

import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  imports: [DatabaseModule, AnalyticsModule, PluginModule, PermissionModule],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule implements OnModuleInit {
  constructor(private readonly permissionService: PermissionService) {}

  onModuleInit(): void {
    // 注册文章模块的权限
    this.permissionService.registerModulePermissions('article', [
      'article:create',
      'article:read',
      'article:update',
      'article:delete',
      'article:publish',
    ]);

    // 为权限组注册权限
    this.permissionService.registerPermissionGroup('editor', [
      'article:create',
      'article:read',
      'article:update',
      'article:delete',
      'article:publish',
    ]);

    this.permissionService.registerPermissionGroup('author', [
      'article:create',
      'article:read',
      'article:update',
    ]);

    this.permissionService.registerPermissionGroup('viewer', ['article:read']);
  }
}
