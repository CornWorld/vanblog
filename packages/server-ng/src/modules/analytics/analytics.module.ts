import { Module, OnModuleInit } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AnalyticsCacheService } from '../../shared/cache/analytics-cache.service';
import { CacheModule } from '../../shared/cache/cache.module';
import { PermissionModule } from '../permission/permission.module';
import { PermissionService } from '../permission/permission.service';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';
import { EchartsFormatterService } from './services/echarts-formatter.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

@Module({
  imports: [DatabaseModule, CacheModule, PermissionModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsCacheService,
    ArticleStatsService,
    ThirdPartyAnalyticsService,
    EchartsFormatterService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsCacheService,
    ArticleStatsService,
    ThirdPartyAnalyticsService,
    EchartsFormatterService,
  ],
})
export class AnalyticsModule implements OnModuleInit {
  constructor(private readonly permissionService: PermissionService) {}

  onModuleInit(): void {
    // 注册分析模块的权限
    this.permissionService.registerModulePermissions('analytics', [
      'analytics:read',
      'analytics:export',
    ]);

    // 为权限组注册权限
    this.permissionService.registerPermissionGroup('editor', ['analytics:read']);
    this.permissionService.registerPermissionGroup('viewer', ['analytics:read']);
  }
}
