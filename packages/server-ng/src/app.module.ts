import { Module, DynamicModule, NestModule, MiddlewareConsumer, type Type } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config';
import { PerformanceInterceptor } from './core/interceptors/performance.interceptor';
import { LoggerModule } from './core/logger/logger.module';
import { V1DeprecationMiddleware } from './core/middlewares/v1-deprecation.middleware';
import { DatabaseModule } from './database';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ArticleModule } from './modules/article/article.module';
import { AuthModule } from './modules/auth/auth.module';
import { BackupModule } from './modules/backup/backup.module';
import { CategoryModule } from './modules/category/category.module';
import { DemoModule } from './modules/demo/demo.module';
import { DraftModule } from './modules/draft/draft.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PermissionModule } from './modules/permission/permission.module';
import { PluginModule } from './modules/plugin/plugin.module';
import { PublicModule } from './modules/public/public.module';
import { RssModule } from './modules/rss/rss.module';
import { SettingModule } from './modules/setting/setting.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { TagModule } from './modules/tag/tag.module';
import { UserModule } from './modules/user/user.module';
import { PerformanceMonitoringMiddleware } from './shared/middleware/performance-monitoring.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(PerformanceMonitoringMiddleware as Type).forRoutes('*');
    consumer.apply(V1DeprecationMiddleware as Type).forRoutes('*'); // Apply to all routes
  }

  static async forRoot(): Promise<DynamicModule> {
    const pluginModule = await PluginModule.forRoot();

    return {
      module: AppModule,
      imports: [
        ConfigModule,
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
        PermissionModule.forRoot(),
        HealthModule,
        UserModule,
        AuthModule,
        ArticleModule,
        CategoryModule,
        TagModule,
        DraftModule,
        MediaModule,
        MetricsModule,
        PublicModule,
        SettingModule,
        AnalyticsModule,
        RssModule,
        SitemapModule,
        BackupModule,
        AdminModule,

        DemoModule,
        pluginModule,
      ],
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: APP_INTERCEPTOR,
          useClass: PerformanceInterceptor,
        },
      ],
    };
  }
}
