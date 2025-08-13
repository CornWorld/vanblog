import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';

import { CompressionMiddleware } from './middleware/compression.middleware';
import { CacheService } from './services/cache.service';
import { CDNService } from './services/cdn.service';
import { ConnectionPoolService } from './services/connection-pool.service';
import { MarkdownService } from './services/markdown.service';
import { MigrationService } from './services/migration.service';
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
    CDNService,
    MigrationService,
    CompressionMiddleware,
  ],
  exports: [
    StatisticsService,
    MarkdownService,
    QueryOptimizerService,
    CacheService,
    ConnectionPoolService,
    CDNService,
    MigrationService,
  ],
})
export class SharedModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CompressionMiddleware).forRoutes('*');
  }
}
