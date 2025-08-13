import { Module, Global } from '@nestjs/common';

import { CacheService } from './services/cache.service';
import { ConnectionPoolService } from './services/connection-pool.service';
import { MarkdownService } from './services/markdown.service';
import { QueryOptimizerService } from './services/query-optimizer.service';
import { StatisticsService } from './services/statistics.service';

@Global()
@Module({
  providers: [
    StatisticsService,
    MarkdownService,
    QueryOptimizerService,
    CacheService,
    ConnectionPoolService,
  ],
  exports: [
    StatisticsService,
    MarkdownService,
    QueryOptimizerService,
    CacheService,
    ConnectionPoolService,
  ],
})
export class SharedModule {}
