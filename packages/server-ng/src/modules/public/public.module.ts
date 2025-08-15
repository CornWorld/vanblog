import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module';
import { ArticleModule } from '../article/article.module';
import { CategoryModule } from '../category/category.module';
import { SettingModule } from '../setting/setting.module';
import { TagModule } from '../tag/tag.module';

@Module({
  imports: [ArticleModule, CategoryModule, TagModule, AnalyticsModule, SettingModule],
})
export class PublicModule {}
