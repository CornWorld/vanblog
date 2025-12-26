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
      this.logger.error('Failed to update overview cache', error as Error);
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
      this.logger.error('Failed to update page rankings cache', error as Error);
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
      this.logger.error('Failed to update referrer stats cache', error as Error);
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
      this.logger.error('Failed to update chart data cache', error as Error);
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
   * 计算概览数据 - 单次查询获取所有统计
   */
  private async calculateOverview(): Promise<OverviewData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 使用单个查询获取所有统计数据
    const dayjsInstance = dayjs(today);
    const todayStr = dayjsInstance.format('YYYY-MM-DD');
    const yesterdayStr = dayjs(yesterday).format('YYYY-MM-DD');

    const results = await this.db
      .select({
        totalViews: sql<number>`count(*)`,
        totalUniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
        todayViews: sql<number>`count(case when date(${analytics.createdAt}) = ${todayStr} then 1 end)`,
        todayUniqueVisitors: sql<number>`count(distinct case when date(${analytics.createdAt}) = ${todayStr} then ${analytics.ip} end)`,
        yesterdayViews: sql<number>`count(case when date(${analytics.createdAt}) = ${yesterdayStr} then 1 end)`,
        yesterdayUniqueVisitors: sql<number>`count(distinct case when date(${analytics.createdAt}) = ${yesterdayStr} then ${analytics.ip} end)`,
      })
      .from(analytics);

    const result: OverviewData | undefined = results[0];

    if (!result) {
      throw new Error('Failed to calculate overview: no result returned from database');
    }

    return result;
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

    return results as PageRankingData[];
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

    return results as ReferrerData[];
  }

  /**
   * 计算图表数据 - 优化为单次查询
   */
  private async calculateChartData(): Promise<ChartData[]> {
    const dayjsInstance = dayjs();
    const thirtyDaysAgo = dayjsInstance.subtract(30, 'day').format('YYYY-MM-DD');

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

    return results as ChartData[];
  }
}
