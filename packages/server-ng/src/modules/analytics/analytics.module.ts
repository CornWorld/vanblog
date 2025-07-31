import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService } from './services/article-stats.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ArticleStatsService],
  exports: [AnalyticsService, ArticleStatsService],
})
export class AnalyticsModule {}
