import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database';
import { AnalyticsCacheService } from '../../shared/cache/analytics-cache.service';
import { CacheModule } from '../../shared/cache/cache.module';
import { PermissionModule } from '../permission/permission.module';

import { AnalyticsController, PublicAnalyticsRecordController } from './analytics.controller';
import { PublicAnalyticsController } from './public-analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';
import { EchartsFormatterService } from './services/echarts-formatter.service';
import { PublicAnalyticsService } from './services/public-analytics.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    PermissionModule.forFeature(['analytics:read', 'analytics:export']),
  ],
  controllers: [AnalyticsController, PublicAnalyticsController, PublicAnalyticsRecordController],
  providers: [
    AnalyticsService,
    AnalyticsCacheService,
    ArticleStatsService,
    PublicAnalyticsService,
    ThirdPartyAnalyticsService,
    EchartsFormatterService,
  ],
  exports: [
    AnalyticsService,
    AnalyticsCacheService,
    ArticleStatsService,
    PublicAnalyticsService,
    ThirdPartyAnalyticsService,
    EchartsFormatterService,
  ],
})
export class AnalyticsModule {}
