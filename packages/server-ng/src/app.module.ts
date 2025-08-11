import { Module, DynamicModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config';
import { LoggerModule } from './core/logger/logger.module';
import { DatabaseModule } from './database';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ArticleModule } from './modules/article/article.module';
import { AuthModule } from './modules/auth/auth.module';
import { BeianModule } from './modules/beian/beian.module';
import { CategoryModule } from './modules/category/category.module';
import { CommentModule } from './modules/comment/comment.module';
import { DemoModule } from './modules/demo/demo.module';
import { DraftModule } from './modules/draft/draft.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { PermissionModule } from './modules/permission/permission.module';
import { PluginModule } from './modules/plugin/plugin.module';
import { RewardModule } from './modules/reward/reward.module';
import { RssModule } from './modules/rss/rss.module';
import { SettingModule } from './modules/setting/setting.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { SocialLinksModule } from './modules/social-links/social-links.module';
import { TagModule } from './modules/tag/tag.module';
import { UserModule } from './modules/user/user.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const pluginModule = await PluginModule.forRoot();

    return {
      module: AppModule,
      imports: [
        ConfigModule,
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        DatabaseModule,
        LoggerModule,
        HealthModule,
        UserModule,
        AuthModule,
        ArticleModule,
        CategoryModule,
        TagModule,
        DraftModule,
        MediaModule,
        SettingModule,
        AnalyticsModule,
        BeianModule,
        SocialLinksModule,
        RewardModule,
        RssModule,
        SitemapModule,
        CommentModule,

        DemoModule,
        PermissionModule,
        WebhookModule,
        pluginModule,
      ],
      controllers: [AppController],
      providers: [AppService],
    };
  }
}
