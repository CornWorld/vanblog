import { Injectable } from '@nestjs/common';

import {
  PublicAnalyticsOverviewDto,
  PublicArticleStatsDto,
  PublicPageRankingDto,
} from '../dto/public-analytics-response.dto';

import { AnalyticsService } from './analytics.service';
import { ArticleStatsService } from './article-stats.service';

/**
 * 公开访客统计服务
 *
 * 提供脱敏后的访客统计数据，确保不暴露敏感信息如 IP 地址、
 * 详细的用户行为数据等。所有数据都经过适当的缓存和限流处理。
 */
@Injectable()
export class PublicAnalyticsService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly articleStatsService: ArticleStatsService,
  ) {}

  /**
   * 获取公开的统计概览
   *
   * 返回脱敏后的网站访问统计概览，包括今日、昨日和总计的
   * 页面访问量和访客数。数据经过缓存优化。
   *
   * @returns 公开统计概览数据
   */
  async getPublicOverview(): Promise<PublicAnalyticsOverviewDto> {
    const overview = await this.analyticsService.getOverview();

    // Return plain object to avoid serialization issues
    const dto = {
      todayPageviews: overview.todayPageviews,
      yesterdayPageviews: overview.yesterdayPageviews,
      totalPageviews: overview.totalPageviews,
      todayVisitors: overview.todayVisitors,
      yesterdayVisitors: overview.yesterdayVisitors,
      totalVisitors: overview.totalVisitors,
    };

    return dto;
  }

  /**
   * 获取公开的文章统计
   *
   * 返回指定文章的脱敏统计数据，包括访问量、独立访客数和
   * 平均阅读时长。不包含敏感的用户行为详情。
   *
   * @param articleId 文章ID
   * @returns 公开文章统计数据，如果文章不存在则返回null
   */
  async getPublicArticleStats(articleId: number): Promise<PublicArticleStatsDto | null> {
    const stats = await this.articleStatsService.getArticleStats(articleId);

    if (!stats) {
      return null;
    }

    // Return plain object to match overview behavior
    return {
      articleId: stats.articleId,
      title: stats.title,
      views: stats.views,
      uniqueVisitors: stats.uniqueVisitors,
      avgReadTime: stats.avgReadTime,
    } as PublicArticleStatsDto;
  }

  /**
   * 获取公开的热门页面排行
   *
   * 返回脱敏后的页面访问排行数据，移除了可能包含敏感信息的
   * 查询参数和用户标识符。
   *
   * @param limit 返回结果数量限制
   * @returns 公开页面排行数据
   */
  async getPublicPageRankings(limit = 10): Promise<PublicPageRankingDto[]> {
    const rankings = await this.analyticsService.getPageRankings(limit);

    return rankings.map((ranking) => ({
      path: this.sanitizePath(ranking.path),
      views: ranking.views,
    }));
  }

  /**
   * 路径脱敏处理
   *
   * 移除路径中可能包含的敏感信息，如查询参数、用户标识符等。
   *
   * @param path 原始路径
   * @returns 脱敏后的路径
   */
  private sanitizePath(path: string): string {
    try {
      // 移除查询参数
      const url = new URL(path, 'http://localhost');
      return url.pathname;
    } catch {
      // 如果不是有效的URL，直接返回路径部分
      return path.split('?')[0] ?? path;
    }
  }
}
