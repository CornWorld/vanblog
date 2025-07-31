import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';
import { EchartsFormatterService } from './services/echarts-formatter.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ArticleStatsService,
    ThirdPartyAnalyticsService,
    EchartsFormatterService,
  ],
  exports: [
    AnalyticsService,
    ArticleStatsService,
    ThirdPartyAnalyticsService,
    EchartsFormatterService,
  ],
})
export class AnalyticsModule {}
