import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';

import { DATABASE_CONNECTION } from '../../database';
import {
  articles,
  drafts,
  categories,
  tags,
  staticFiles,
  siteMeta,
  customPages,
  analytics,
} from '../../database/schema';

import type { Database } from '../../database/connection';

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

@Injectable()
export class DemoService implements OnModuleInit {
  private readonly logger = new Logger(DemoService.name);
  private demoSnapshot: DemoSnapshot | null = null;
  private readonly isDemoMode: boolean;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {
    this.isDemoMode = this.configService.get<boolean>('DEMO_MODE', false);
  }

  // Scheduled restoration every 6 hours in demo mode
  @Cron('0 */6 * * *')
  async scheduledRestore(): Promise<void> {
    if (this.isDemoMode) {
      this.logger.log('Performing scheduled demo data restoration...');
      await this.restoreFromSnapshot();
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.isDemoMode) {
      this.logger.log('Demo mode enabled, creating initial snapshot...');
      await this.createSnapshot();

      this.logger.log('Demo mode initialized successfully');
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

  getSnapshotInfo(): {
    hasSnapshot: boolean;
    timestamp?: number;
    articlesCount?: number;
    draftsCount?: number;
  } {
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
