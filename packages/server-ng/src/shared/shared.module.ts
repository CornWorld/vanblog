import { Module, Global } from '@nestjs/common';

import { MarkdownService } from './services/markdown.service';
import { QueryOptimizerService } from './services/query-optimizer.service';
import { StatisticsService } from './services/statistics.service';

@Global()
@Module({
  providers: [StatisticsService, MarkdownService, QueryOptimizerService],
  exports: [StatisticsService, MarkdownService, QueryOptimizerService],
})
export class SharedModule {}
