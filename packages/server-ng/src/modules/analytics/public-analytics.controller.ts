import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { DerivedView } from '../../shared/decorators/derived-view.decorator';

import {
  PublicAnalyticsOverviewDto,
  PublicArticleStatsDto,
  PublicPageRankingDto,
} from './dto/public-analytics-response.dto';
import { PublicAnalyticsService } from './services/public-analytics.service';

/**
 * 公开访客统计控制器
 *
 * 提供脱敏后的访客统计数据查询接口，包括网站概览统计、
 * 文章访问统计等。所有接口都经过严格的限流和缓存处理，
 * 确保数据安全和系统性能。
 */
@ApiTags('Public Analytics')
@Controller({ path: 'analytics/public', version: '2' })
@UseGuards(ThrottlerGuard)
export class PublicAnalyticsController {
  constructor(private readonly publicAnalyticsService: PublicAnalyticsService) {}

  /**
   * 获取公开统计概览
   *
   * 返回脱敏后的网站访问统计概览，包括今日、昨日和总计的
   * 页面访问量和访客数。数据缓存5分钟，支持SWR策略。
   *
   * @returns 公开统计概览数据
   */
  @Get('overview')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 每分钟最多30次请求
  @DerivedView({ key: 'public-analytics-overview', ttl: 300, swr: true })
  @ApiOperation({ summary: '获取公开统计概览' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PublicAnalyticsOverviewDto,
  })
  async getPublicOverview(): Promise<PublicAnalyticsOverviewDto> {
    return this.publicAnalyticsService.getPublicOverview();
  }

  /**
   * 获取公开文章统计
   *
   * 返回指定文章的脱敏统计数据，包括访问量、独立访客数和
   * 平均阅读时长。数据缓存3分钟，支持SWR策略。
   *
   * @param articleId 文章ID
   * @returns 公开文章统计数据，如果文章不存在则返回404
   */
  @Get('article/:id')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 每分钟最多60次请求
  @DerivedView({ key: 'public-analytics-article', ttl: 180, swr: true })
  @ApiOperation({ summary: '获取公开文章统计' })
  @ApiParam({ name: 'id', description: '文章ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: PublicArticleStatsDto,
  })
  @ApiResponse({ status: 404, description: '文章不存在' })
  async getPublicArticleStats(
    @Param('id', ParseIntPipe) articleId: number,
  ): Promise<PublicArticleStatsDto | null> {
    return this.publicAnalyticsService.getPublicArticleStats(articleId);
  }

  /**
   * 获取公开热门页面排行
   *
   * 返回脱敏后的页面访问排行数据，移除了可能包含敏感信息的
   * 查询参数和用户标识符。数据缓存10分钟，支持SWR策略。
   *
   * @returns 公开页面排行数据
   */
  @Get('page-rankings')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 每分钟最多20次请求
  @DerivedView({ key: 'public-analytics-page-rankings', ttl: 600, swr: true })
  @ApiOperation({ summary: '获取公开热门页面排行' })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: [PublicPageRankingDto],
  })
  async getPublicPageRankings(): Promise<PublicPageRankingDto[]> {
    return this.publicAnalyticsService.getPublicPageRankings(10);
  }
}
