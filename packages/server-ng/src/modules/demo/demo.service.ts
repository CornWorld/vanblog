import { Injectable, Logger, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dayjs } from '@vanblog/shared';
import {
  articles,
  drafts,
  categories,
  tags,
  staticFiles,
  siteMeta,
  customPages,
  analytics,
} from '@vanblog/shared/drizzle';

import { DATABASE_CONNECTION, type Database } from '../../database';

export interface DemoSnapshot {
  timestamp: number;
  articles: unknown[];
  drafts: unknown[];
  categories: unknown[];
  tags: unknown[];
  staticFiles: unknown[];
  siteMeta: unknown[];
  customPages: unknown[];
}

/**
 * Demo Service - 提供演示模式下的数据快照和恢复功能
 *
 * 注意：使用 setInterval 替代 @Cron 装饰器，避免 ScheduleModule 的 Reflector 依赖问题
 */
@Injectable()
export class DemoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoService.name);
  private demoSnapshot: DemoSnapshot | null = null;
  private readonly isDemoMode: boolean;
  private restoreInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {
    this.isDemoMode = this.configService.get<boolean>('DEMO_MODE', false);
  }

  /**
   * 模块初始化时设置定时恢复任务（每 6 小时）
   */
  async onModuleInit(): Promise<void> {
    if (this.isDemoMode && process.env.NODE_ENV !== 'test') {
      this.logger.log('Demo mode enabled, creating initial snapshot...');
      await this.createSnapshot();

      // 设置每 6 小时执行一次恢复任务
      const sixHoursMs = 6 * 60 * 60 * 1000;
      this.restoreInterval = setInterval(() => {
        void (async () => {
          this.logger.log('Performing scheduled demo data restoration...');
          await this.restoreFromSnapshot();
        })();
      }, sixHoursMs);

      this.logger.log(
        `Scheduled demo data restoration every 6 hours (interval: ${String(sixHoursMs)}ms)`,
      );
      this.logger.log('Demo mode initialized successfully');
    } else if (this.isDemoMode && process.env.NODE_ENV === 'test') {
      this.logger.log('Demo mode enabled in test environment, skipping initial snapshot');
    }
  }

  /**
   * 模块销毁时清理定时器
   */
  onModuleDestroy(): void {
    if (this.restoreInterval) {
      clearInterval(this.restoreInterval);
      this.restoreInterval = null;
      this.logger.log('Demo service cleanup: cleared restoration interval');
    }
  }

  isDemoModeEnabled(): boolean {
    return this.isDemoMode;
  }

  async createSnapshot(): Promise<void> {
    try {
      const snapshot: DemoSnapshot = {
        timestamp: dayjs().valueOf(),
        articles: await this.db.select().from(articles),
        drafts: await this.db.select().from(drafts),
        categories: await this.db.select().from(categories),
        tags: await this.db.select().from(tags),
        staticFiles: await this.db.select().from(staticFiles),
        siteMeta: await this.db.select().from(siteMeta),
        customPages: await this.db.select().from(customPages),
      };

      this.demoSnapshot = snapshot;
      this.logger.log(`Demo snapshot created with ${String(snapshot.articles.length)} articles`);
    } catch (error) {
      this.logger.error('Failed to create demo snapshot:', error);
      throw error;
    }
  }

  async restoreFromSnapshot(): Promise<void> {
    if (!this.demoSnapshot) {
      this.logger.warn('No demo snapshot available for restoration');
      return;
    }

    try {
      this.logger.log('Starting demo data restoration...');

      // Clear current data (except users and login logs for security)
      await this.db.delete(analytics);
      await this.db.delete(staticFiles);
      await this.db.delete(customPages);
      await this.db.delete(articles);
      await this.db.delete(drafts);
      await this.db.delete(categories);
      await this.db.delete(tags);
      await this.db.delete(siteMeta);

      // Restore data from snapshot
      if (this.demoSnapshot.categories.length > 0) {
        await this.db
          .insert(categories)
          .values(this.demoSnapshot.categories as (typeof categories.$inferInsert)[]);
      }
      if (this.demoSnapshot.tags.length > 0) {
        await this.db.insert(tags).values(this.demoSnapshot.tags as (typeof tags.$inferInsert)[]);
      }
      if (this.demoSnapshot.articles.length > 0) {
        await this.db
          .insert(articles)
          .values(this.demoSnapshot.articles as (typeof articles.$inferInsert)[]);
      }
      if (this.demoSnapshot.drafts.length > 0) {
        await this.db
          .insert(drafts)
          .values(this.demoSnapshot.drafts as (typeof drafts.$inferInsert)[]);
      }
      if (this.demoSnapshot.staticFiles.length > 0) {
        await this.db
          .insert(staticFiles)
          .values(this.demoSnapshot.staticFiles as (typeof staticFiles.$inferInsert)[]);
      }
      if (this.demoSnapshot.siteMeta.length > 0) {
        await this.db
          .insert(siteMeta)
          .values(this.demoSnapshot.siteMeta as (typeof siteMeta.$inferInsert)[]);
      }
      if (this.demoSnapshot.customPages.length > 0) {
        await this.db
          .insert(customPages)
          .values(this.demoSnapshot.customPages as (typeof customPages.$inferInsert)[]);
      }

      this.logger.log('Demo data restoration completed successfully');
    } catch (error) {
      this.logger.error('Failed to restore demo data:', error);
      throw error;
    }
  }

  async manualRestore(): Promise<{ success: boolean; message: string }> {
    if (!this.isDemoMode) {
      return {
        success: false,
        message: 'Demo mode is not enabled',
      };
    }

    try {
      await this.restoreFromSnapshot();
      return {
        success: true,
        message: 'Demo data restored successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to restore demo data: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  getSnapshotInfo():
    | { hasSnapshot: false }
    | { hasSnapshot: true; timestamp: number; articlesCount: number; draftsCount: number } {
    if (!this.demoSnapshot) {
      return { hasSnapshot: false };
    }

    return {
      hasSnapshot: true,
      timestamp: this.demoSnapshot.timestamp,
      articlesCount: this.demoSnapshot.articles.length,
      draftsCount: this.demoSnapshot.drafts.length,
    };
  }
}
