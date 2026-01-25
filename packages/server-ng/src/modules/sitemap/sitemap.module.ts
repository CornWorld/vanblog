import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database';
import { ArticleModule } from '../article/article.module';
import { CategoryModule } from '../category/category.module';
import { PermissionModule } from '../permission/permission.module';
import { PluginModule } from '../plugin/plugin.module';
import {
  SITEMAP_EXTRA_STATIC_PATHS_KEY,
  SitemapExtraStaticPathsSchema,
} from '../setting/registry-keys';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { SettingModule } from '../setting/setting.module';
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
    SettingModule,
  ],
  controllers: [SitemapController],
  providers: [
    SitemapService,
    {
      provide: 'SITEMAP_EXTRA_STATIC_PATHS_REGISTRATION',
      inject: [SettingRegistryService],
      useFactory: (registry: SettingRegistryService) => {
        registry.registerConfig({
          key: SITEMAP_EXTRA_STATIC_PATHS_KEY,
          defaultValue: [],
          validator: (value: unknown) => SitemapExtraStaticPathsSchema.safeParse(value).success,
          description: 'Extra static paths to include in sitemap (string or string[])',
        });
        return true;
      },
    },
  ],
  exports: [SitemapService],
})
export class SitemapModule {}
