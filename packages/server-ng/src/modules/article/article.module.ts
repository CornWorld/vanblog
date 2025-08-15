import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PermissionModule } from '../permission/permission.module';
import { PluginModule } from '../plugin/plugin.module';

import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  imports: [
    DatabaseModule,
    AnalyticsModule,
    PluginModule,
    PermissionModule.forFeature([
      'article:create',
      'article:read',
      'article:update',
      'article:delete',
      'article:publish',
    ]),
  ],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule {}
