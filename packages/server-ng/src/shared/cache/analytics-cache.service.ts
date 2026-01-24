import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { dayjs } from '@vanblog/shared';
import { analytics } from '@vanblog/shared/drizzle';
import { sql, desc } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';

import { CacheService } from './cache.service';

// 类型定义
interface OverviewData {
  totalViews: number;
  totalUniqueVisitors: number;
  todayViews: number;
  todayUniqueVisitors: number;
  yesterdayViews: number;
  yesterdayUniqueVisitors: number;
}

interface PageRankingData {
  path: string | null;
  views: number;
  uniqueVisitors: number;
}

interface ReferrerData {
  referrer: string | null;
  views: number;
  uniqueVisitors: number;
}

interface ChartData {
  date: string;
  views: number;
  uniqueVisitors: number;
}

/**
 * Linus 式分析缓存服务 - 异步计算，缓存结果
 *
 * 核心原则：
 * 1. 统计数据异步计算，避免实时查询
 * 2. 定时任务更新缓存，消除用户等待
 * 3. 简单的缓存键设计，易于管理
 */
@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly cache: CacheService,
  ) {}

  /**
   * 每 5 分钟更新概览数据
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateOverviewCache(): Promise<void> {
    try {
      const overview = await this.calculateOverview();
      await this.cache.set('analytics:overview', overview, 300); // 5 分钟缓存
      this.logger.debug('Overview cache updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to update overview cache', errorStack ?? errorMessage);
    }
  }

  /**
   * 每 10 分钟更新页面排名
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updatePageRankingsCache(): Promise<void> {
    try {
      const rankings = await this.calculatePageRankings();
      await this.cache.set('analytics:page-rankings', rankings, 600); // 10 分钟缓存
      this.logger.debug('Page rankings cache updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to update page rankings cache', errorStack ?? errorMessage);
    }
  }

  /**
   * 每 15 分钟更新引用来源统计
   */
  @Cron(CronExpression.EVERY_5_MINUTES) // 使用可用的常量
  async updateReferrerStatsCache(): Promise<void> {
    try {
      const stats = await this.calculateReferrerStats();
      await this.cache.set('analytics:referrer-stats', stats, 900); // 15 分钟缓存
      this.logger.debug('Referrer stats cache updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to update referrer stats cache', errorStack ?? errorMessage);
    }
  }

  /**
   * 每小时更新图表数据
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateChartDataCache(): Promise<void> {
    try {
      const chartData = await this.calculateChartData();
      await this.cache.set('analytics:chart-data', chartData, 3600); // 1 小时缓存
      this.logger.debug('Chart data cache updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to update chart data cache', errorStack ?? errorMessage);
    }
  }

  /**
   * 获取缓存的概览数据
   */
  async getOverview(): Promise<OverviewData> {
    return this.cache.wrap('analytics:overview', async () => this.calculateOverview(), 300);
  }

  /**
   * 获取缓存的页面排名
   */
  async getPageRankings(): Promise<PageRankingData[]> {
    return this.cache.wrap(
      'analytics:page-rankings',
      async () => this.calculatePageRankings(),
      600,
    );
  }

  /**
   * 获取缓存的引用来源统计
   */
  async getReferrerStats(): Promise<ReferrerData[]> {
    return this.cache.wrap(
      'analytics:referrer-stats',
      async () => this.calculateReferrerStats(),
      900,
    );
  }

  /**
   * 获取缓存的图表数据
   */
  async getChartData(): Promise<ChartData[]> {
    return this.cache.wrap('analytics:chart-data', async () => this.calculateChartData(), 3600);
  }

  /**
   * 计算概览数据 - 使用多个简单查询确保正确性
   */
  private async calculateOverview(): Promise<OverviewData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = dayjs(today).format('YYYY-MM-DD');
    const yesterdayStr = dayjs(yesterday).format('YYYY-MM-DD');

    // 分别查询各个统计值，使用更简单的SQL确保兼容性
    const [totalResult] = await this.db
      .select({
        totalViews: sql<number>`count(*)`,
        totalUniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics);

    const todayCondition = sql`date(${analytics.createdAt}) = ${todayStr}`;
    const [todayResult] = await this.db
      .select({
        todayViews: sql<number>`count(*)`,
        todayUniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .where(todayCondition);

    const yesterdayCondition = sql`date(${analytics.createdAt}) = ${yesterdayStr}`;
    const [yesterdayResult] = await this.db
      .select({
        yesterdayViews: sql<number>`count(*)`,
        yesterdayUniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .where(yesterdayCondition);

    return {
      totalViews: totalResult.totalViews,
      totalUniqueVisitors: totalResult.totalUniqueVisitors,
      todayViews: todayResult.todayViews,
      todayUniqueVisitors: todayResult.todayUniqueVisitors,
      yesterdayViews: yesterdayResult.yesterdayViews,
      yesterdayUniqueVisitors: yesterdayResult.yesterdayUniqueVisitors,
    };
  }

  /**
   * 计算页面排名
   */
  private async calculatePageRankings(): Promise<PageRankingData[]> {
    const results = await this.db
      .select({
        path: analytics.path,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .groupBy(analytics.path)
      .orderBy(desc(sql<number>`count(*)`));

    return results.map((row) => ({
      path: row.path,
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
    }));
  }

  /**
   * 计算引用来源统计
   */
  private async calculateReferrerStats(): Promise<ReferrerData[]> {
    const results = await this.db
      .select({
        referrer: analytics.referrer,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .where(sql`${analytics.referrer} is not null and ${analytics.referrer} != ''`)
      .groupBy(analytics.referrer)
      .orderBy(desc(sql<number>`count(*)`));

    return results.map((row) => ({
      referrer: row.referrer,
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
    }));
  }

  /**
   * 计算图表数据 - 优化为单次查询
   */
  private async calculateChartData(): Promise<ChartData[]> {
    const thirtyDaysAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

    const results = await this.db
      .select({
        date: sql<string>`date(${analytics.createdAt})`,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .where(sql`date(${analytics.createdAt}) >= ${thirtyDaysAgo}`)
      .groupBy(sql<string>`date(${analytics.createdAt})`)
      .orderBy(sql<string>`date(${analytics.createdAt})`);

    return results.map((row) => ({
      date: row.date,
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
    }));
  }
}
