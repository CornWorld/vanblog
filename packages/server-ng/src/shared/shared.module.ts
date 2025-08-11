import { Module, Global } from '@nestjs/common';

import { StatisticsService } from './services/statistics.service';
import { MarkdownService } from './services/markdown.service';

@Global()
@Module({
  providers: [StatisticsService, MarkdownService],
  exports: [StatisticsService, MarkdownService],
})
export class SharedModule {}
