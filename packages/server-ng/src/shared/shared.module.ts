import { Module, Global, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';

import { CacheModule } from './cache/cache.module';
import { CompressionMiddleware } from './middleware/compression.middleware';
import { CDNService } from './services/cdn.service';
import { ConnectionPoolService } from './services/connection-pool.service';
import { MarkdownService } from './services/markdown.service';
import { MigrationService } from './services/migration.service';
import { QueryOptimizerService } from './services/query-optimizer.service';
import { StatisticsService } from './services/statistics.service';

@Global()
@Module({
  imports: [CacheModule],
  providers: [
    StatisticsService,
    MarkdownService,
    QueryOptimizerService,
    ConnectionPoolService,
    CDNService,
    MigrationService,
    CompressionMiddleware,
  ],
  exports: [
    StatisticsService,
    MarkdownService,
    QueryOptimizerService,
    CacheModule,
    ConnectionPoolService,
    CDNService,
    MigrationService,
  ],
})
export class SharedModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CompressionMiddleware).forRoutes({ path: '(.*)', method: RequestMethod.ALL });
  }
}
