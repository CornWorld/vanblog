import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AnalyticsCacheService } from '../../shared/cache/analytics-cache.service';
import { CacheModule } from '../../shared/cache/cache.module';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';
import { EchartsFormatterService } from './services/echarts-formatter.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

@Module({
  imports: [DatabaseModule, CacheModule],
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
export class AnalyticsModule {}
