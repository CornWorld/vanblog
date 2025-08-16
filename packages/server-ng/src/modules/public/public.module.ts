import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ArticleModule } from '../article/article.module';
import { CategoryModule } from '../category/category.module';
import { CommentModule } from '../comment/comment.module';
import { RewardModule } from '../reward/reward.module';
import { SettingModule } from '../setting/setting.module';
import { SocialLinksModule } from '../social-links/social-links.module';
import { TagModule } from '../tag/tag.module';

import { CustomPageController } from './custom-page.controller';
import { CustomPageService } from './custom-page.service';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  imports: [
    ArticleModule,
    CategoryModule,
    TagModule,
    AnalyticsModule,
    SettingModule,
    SharedModule,
    CommentModule,
    RewardModule,
    SocialLinksModule,
  ],
  controllers: [CustomPageController, MetaController],
  providers: [CustomPageService, MetaService],
})
export class PublicModule {}
