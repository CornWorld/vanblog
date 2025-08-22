import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database';
import { ArticleModule } from '../article/article.module';
import { CategoryModule } from '../category/category.module';
import { PermissionModule } from '../permission/permission.module';
import { PluginModule } from '../plugin/plugin.module';
import { TagModule } from '../tag/tag.module';

import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

@Module({
  imports: [
    DatabaseModule,
    PluginModule,
    PermissionModule.forFeature(['sitemap:generate', 'sitemap:read']),
    forwardRef(() => ArticleModule),
    forwardRef(() => CategoryModule),
    forwardRef(() => TagModule),
  ],
  controllers: [SitemapController],
  providers: [SitemapService],
  exports: [SitemapService],
})
export class SitemapModule {}
