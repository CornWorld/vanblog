import { Injectable, Inject } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { UAParser } from 'ua-parser-js';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import { analytics } from '../../../database/schema';
import { AnalyticsCacheService } from '../../../shared/cache/analytics-cache.service';
import { safeParseJson, dataSchemas } from '../../../shared/zod';
import {
  AnalyticsOverviewDto,
  PageRankingDto,
  ReferrerStatsDto,
  TimeSeriesDataDto,
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from '../dto/analytics-response.dto';
import { QueryAnalyticsDto } from '../dto/query-analytics.dto';
import { RecordAnalyticsDto } from '../dto/record-analytics.dto';
import { AnalyticsType } from '../entities/analytics.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: LibSQLDatabase,
    private readonly cacheService: AnalyticsCacheService,
  ) {}

  async recordAnalytics(dto: RecordAnalyticsDto): Promise<void> {
    await this.db.insert(analytics).values({
      type: dto.type,
      path: dto.path,
      referrer: dto.referrer,
      userAgent: dto.userAgent,
      ip: dto.ip,
      data: dto.data !== undefined && dto.data !== null ? JSON.stringify(dto.data) : null,
    });
  }

  async getOverview(): Promise<AnalyticsOverviewDto> {
    const data = await this.cacheService.getOverview();
    return {
      todayPageviews: data.todayViews,
      yesterdayPageviews: data.yesterdayViews,
      totalPageviews: data.totalViews,
      todayVisitors: data.todayUniqueVisitors,
      yesterdayVisitors: data.yesterdayUniqueVisitors,
      totalVisitors: data.totalUniqueVisitors,
    };
  }

  async getPageRankings(limit = 10): Promise<PageRankingDto[]> {
    const data = await this.cacheService.getPageRankings();
    return data.slice(0, limit).map((row) => ({
      path: row.path ?? '',
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
    }));
  }

  async getReferrerStats(limit = 10): Promise<ReferrerStatsDto[]> {
    const data = await this.cacheService.getReferrerStats();
    return data.slice(0, limit).map((row) => ({
      referrer: row.referrer ?? '',
      count: row.views,
    }));
  }

  async getChartData(days = 7): Promise<AnalyticsChartDataDto> {
    const data = await this.cacheService.getChartData();

    // Build a lookup map by date (YYYY-MM-DD)
    const byDate = new Map<string, { views: number; uniqueVisitors: number }>();
    for (const item of data) {
      byDate.set(item.date, { views: item.views, uniqueVisitors: item.uniqueVisitors });
    }

    // Construct exactly `days` points, including zeros for missing dates
    const pageviewsData: TimeSeriesDataDto[] = [];
    const visitorsData: TimeSeriesDataDto[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dateKey = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const label = dayjs(dateKey).format('MM-DD');
      const daily = byDate.get(dateKey) ?? { views: 0, uniqueVisitors: 0 };

      pageviewsData.push({ time: label, value: daily.views });
      visitorsData.push({ time: label, value: daily.uniqueVisitors });
    }

    return {
      pageviews: pageviewsData,
      visitors: visitorsData,
    };
  }

  async getDeviceStats(): Promise<DeviceStatsDto[]> {
    const result = await this.db
      .select({
        userAgent: analytics.userAgent,
        count: sql<number>`count(*)`,
      })
      .from(analytics)
      .where(eq(analytics.type, AnalyticsType.PAGEVIEW))
      .groupBy(analytics.userAgent);

    const deviceMap = new Map<string, number>();
    let total = 0;

    result.forEach((row) => {
      if (typeof row.userAgent === 'string' && row.userAgent.length > 0) {
        const parser = new UAParser(row.userAgent);
        const device = parser.getDevice();
        const deviceType = device.type ?? 'desktop';

        deviceMap.set(deviceType, (deviceMap.get(deviceType) ?? 0) + row.count);
        total += row.count;
      }
    });

    return Array.from(deviceMap.entries()).map(([device, count]) => ({
      device,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }

  async getBrowserStats(): Promise<BrowserStatsDto[]> {
    const result = await this.db
      .select({
        userAgent: analytics.userAgent,
        count: sql<number>`count(*)`,
      })
      .from(analytics)
      .where(eq(analytics.type, AnalyticsType.PAGEVIEW))
      .groupBy(analytics.userAgent);

    const browserMap = new Map<string, number>();
    let total = 0;

    result.forEach((row) => {
      if (typeof row.userAgent === 'string' && row.userAgent.length > 0) {
        const parser = new UAParser(row.userAgent);
        const browser = parser.getBrowser();
        const browserName = browser.name ?? 'Unknown';

        browserMap.set(browserName, (browserMap.get(browserName) ?? 0) + row.count);
        total += row.count;
      }
    });

    return Array.from(browserMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([browser, count]) => ({
        browser,
        count,
        percentage: Math.round((count / total) * 100),
      }));
  }

  async exportAnalyticsData(query: QueryAnalyticsDto): Promise<unknown[]> {
    const conditions = [];

    if (query.type !== undefined) {
      conditions.push(eq(analytics.type, query.type));
    }

    if (query.startDate !== undefined) {
      conditions.push(gte(analytics.createdAt, query.startDate));
    }

    if (query.endDate !== undefined) {
      conditions.push(lte(analytics.createdAt, query.endDate));
    }

    if (typeof query.path === 'string' && query.path.length > 0) {
      conditions.push(eq(analytics.path, query.path));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await this.db
      .select()
      .from(analytics)
      .where(whereClause)
      .orderBy(desc(analytics.createdAt));

    return result.map((row) => {
      const parsed = safeParseJson(row.data, dataSchemas.genericObject);
      return {
        ...row,
        data: parsed,
      };
    });
  }
}
