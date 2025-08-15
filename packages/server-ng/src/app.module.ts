import { Module, DynamicModule, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config';
import { LoggerModule } from './core/logger/logger.module';
import { V1DeprecationMiddleware } from './core/middleware/v1-deprecation.middleware';
import { DatabaseModule } from './database';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ArticleModule } from './modules/article/article.module';
import { AuthModule } from './modules/auth/auth.module';
import { BackupModule } from './modules/backup/backup.module';
import { BeianModule } from './modules/beian/beian.module';
import { CategoryModule } from './modules/category/category.module';
import { CommentModule } from './modules/comment/comment.module';
import { DemoModule } from './modules/demo/demo.module';
import { DraftModule } from './modules/draft/draft.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { PermissionModule } from './modules/permission/permission.module';
import { PluginModule } from './modules/plugin/plugin.module';
import { PublicModule } from './modules/public/public.module';
import { RewardModule } from './modules/reward/reward.module';
import { RssModule } from './modules/rss/rss.module';
import { SettingModule } from './modules/setting/setting.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { SocialLinksModule } from './modules/social-links/social-links.module';
import { TagModule } from './modules/tag/tag.module';
import { UserModule } from './modules/user/user.module';
import { PerformanceMonitoringMiddleware } from './shared/middleware/performance-monitoring.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PerformanceMonitoringMiddleware, V1DeprecationMiddleware).forRoutes('*'); // Apply to all routes
  }

  static forRoot(): DynamicModule {
    const pluginModule = PluginModule.forRoot();

    return {
      module: AppModule,
      imports: [
        ConfigModule,
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        ThrottlerModule.forRoot([
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: 3, // 3 requests per second
          },
          {
            name: 'medium',
            ttl: 10000, // 10 seconds
            limit: 20, // 20 requests per 10 seconds
          },
          {
            name: 'long',
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests per minute
          },
        ]),
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
        PublicModule,
        SettingModule,
        AnalyticsModule,
        BeianModule,
        SocialLinksModule,
        RewardModule,
        RssModule,
        SitemapModule,
        CommentModule,
        BackupModule,

        DemoModule,
        PermissionModule.forRoot(),
        pluginModule,
      ],
      controllers: [AppController],
      providers: [AppService],
    };
  }
}
