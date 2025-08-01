import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { analytics } from '../../../database/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { RecordAnalyticsDto } from '../dto/record-analytics.dto';
import { QueryAnalyticsDto } from '../dto/query-analytics.dto';
import {
  AnalyticsOverviewDto,
  PageRankingDto,
  ReferrerStatsDto,
  TimeSeriesDataDto,
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from '../dto/analytics-response.dto';
import { AnalyticsType } from '../entities/analytics.entity';
import { UAParser } from 'ua-parser-js';
import { safeParseJson, dataSchemas } from '../../../shared/zod';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: LibSQLDatabase,
  ) {}

  async recordAnalytics(dto: RecordAnalyticsDto): Promise<void> {
    await this.db.insert(analytics).values({
      type: dto.type,
      path: dto.path,
      referrer: dto.referer,
      userAgent: dto.userAgent,
      ip: dto.ip,
      data: dto.metadata ? JSON.stringify(dto.metadata) : null,
    });
  }

  async getOverview(): Promise<AnalyticsOverviewDto> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    const [todayPageviews, yesterdayPageviews, totalPageviews] = await Promise.all([
      this.getPageviewCount(todayStart, now),
      this.getPageviewCount(yesterdayStart, yesterdayEnd),
      this.getPageviewCount(),
    ]);

    const [todayVisitors, yesterdayVisitors, totalVisitors] = await Promise.all([
      this.getUniqueVisitorCount(todayStart, now),
      this.getUniqueVisitorCount(yesterdayStart, yesterdayEnd),
      this.getUniqueVisitorCount(),
    ]);

    return {
      todayPageviews,
      yesterdayPageviews,
      totalPageviews,
      todayVisitors,
      yesterdayVisitors,
      totalVisitors,
    };
  }

  async getPageRankings(limit = 10): Promise<PageRankingDto[]> {
    const result = await this.db
      .select({
        path: analytics.path,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .where(and(eq(analytics.type, AnalyticsType.PAGEVIEW), sql`${analytics.path} is not null`))
      .groupBy(analytics.path)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return result.map((row) => ({
      path: row.path ?? '',
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
    }));
  }

  async getReferrerStats(limit = 10): Promise<ReferrerStatsDto[]> {
    const result = await this.db
      .select({
        referrer: analytics.referrer,
        count: sql<number>`count(*)`,
      })
      .from(analytics)
      .where(
        and(
          eq(analytics.type, AnalyticsType.PAGEVIEW),
          sql`${analytics.referrer} is not null`,
          sql`${analytics.referrer} != ''`,
        ),
      )
      .groupBy(analytics.referrer)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return result.map((row) => ({
      referrer: row.referrer ?? '',
      count: row.count,
    }));
  }

  async getChartData(days = 7): Promise<AnalyticsChartDataDto> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const pageviewsData: TimeSeriesDataDto[] = [];
    const visitorsData: TimeSeriesDataDto[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [pageviews, visitors] = await Promise.all([
        this.getPageviewCount(dayStart, dayEnd),
        this.getUniqueVisitorCount(dayStart, dayEnd),
      ]);

      const timeStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`;

      pageviewsData.push({ time: timeStr, value: pageviews });
      visitorsData.push({ time: timeStr, value: visitors });
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
      if (row.userAgent) {
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
      if (row.userAgent) {
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

    if (query.type) {
      conditions.push(eq(analytics.type, query.type));
    }

    if (query.startDate) {
      conditions.push(gte(analytics.createdAt, new Date(query.startDate)));
    }

    if (query.endDate) {
      conditions.push(lte(analytics.createdAt, new Date(query.endDate)));
    }

    if (query.path) {
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

  private async getPageviewCount(startDate?: Date, endDate?: Date): Promise<number> {
    const conditions = [eq(analytics.type, AnalyticsType.PAGEVIEW)];

    if (startDate) {
      conditions.push(gte(analytics.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(analytics.createdAt, endDate));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(analytics)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  private async getUniqueVisitorCount(startDate?: Date, endDate?: Date): Promise<number> {
    const conditions = [eq(analytics.type, AnalyticsType.PAGEVIEW)];

    if (startDate) {
      conditions.push(gte(analytics.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(analytics.createdAt, endDate));
    }

    const result = await this.db
      .select({ count: sql<number>`count(distinct ${analytics.ip})` })
      .from(analytics)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }
}
