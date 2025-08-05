import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './core/logger/logger.module';
import { DatabaseModule } from './database';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { ArticleModule } from './modules/article/article.module';
import { CategoryModule } from './modules/category/category.module';
import { TagModule } from './modules/tag/tag.module';
import { DraftModule } from './modules/draft/draft.module';
import { MediaModule } from './modules/media/media.module';
import { SettingModule } from './modules/setting/setting.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BeianModule } from './modules/beian/beian.module';
import { SocialLinksModule } from './modules/social-links/social-links.module';
import { RewardModule } from './modules/reward/reward.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { DemoModule } from './modules/demo/demo.module';
import { PermissionModule } from './modules/permission/permission.module';
import { PluginModule } from './modules/plugin/plugin.module';

@Module({
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
    PipelineModule,
    DemoModule,
    PermissionModule,
    PluginModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
