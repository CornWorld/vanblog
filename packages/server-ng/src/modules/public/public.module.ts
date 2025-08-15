import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ArticleModule } from '../article/article.module';
import { CategoryModule } from '../category/category.module';
import { SettingModule } from '../setting/setting.module';
import { TagModule } from '../tag/tag.module';

import { CustomPageController } from './custom-page.controller';
import { CustomPageService } from './custom-page.service';

@Module({
  imports: [ArticleModule, CategoryModule, TagModule, AnalyticsModule, SettingModule, SharedModule],
  controllers: [CustomPageController],
  providers: [CustomPageService],
})
export class PublicModule {}
