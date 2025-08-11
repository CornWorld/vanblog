import { Module, Global } from '@nestjs/common';

import { MarkdownService } from './services/markdown.service';
import { StatisticsService } from './services/statistics.service';

@Global()
@Module({
  providers: [StatisticsService, MarkdownService],
  exports: [StatisticsService, MarkdownService],
})
export class SharedModule {}
