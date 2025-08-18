import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { ArticleModule } from '../article/article.module';
import { PermissionModule } from '../permission/permission.module';
import { PluginModule } from '../plugin/plugin.module';

import { RssController } from './rss.controller';
import { RssService } from './rss.service';

@Module({
  imports: [
    DatabaseModule,
    PluginModule,
    PermissionModule.forFeature(['rss:generate', 'rss:read']),
    forwardRef(() => ArticleModule),
  ],
  controllers: [RssController],
  providers: [RssService],
  exports: [RssService],
})
export class RssModule {}
