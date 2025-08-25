import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ArticleModule } from '../article/article.module';
import { CategoryModule } from '../category/category.module';
import { CommentModule } from '../comment/comment.module';
import { PluginModule } from '../plugin/plugin.module';
import { SettingModule } from '../setting/setting.module';
import { TagModule } from '../tag/tag.module';
import { UserModule } from '../user/user.module';

import { BootstrapController } from './bootstrap.controller';
import { BootstrapService } from './bootstrap.service';
import { CustomPageController } from './custom-page.controller';
import { CustomPageService } from './custom-page.service';
import { InitController } from './init.controller';
import { InitService } from './init.service';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

@Module({
  imports: [
    ArticleModule,
    CategoryModule,
    TagModule,
    AnalyticsModule,
    SettingModule,
    SharedModule,
    CommentModule,
    PluginModule,
    UserModule,
  ],
  controllers: [
    CustomPageController,
    BootstrapController,
    OptionsController,
    TimelineController,
    InitController,
  ],
  providers: [CustomPageService, BootstrapService, OptionsService, TimelineService, InitService],
})
export class PublicModule {}
