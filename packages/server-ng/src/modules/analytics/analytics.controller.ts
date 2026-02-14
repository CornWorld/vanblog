import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  Headers,
  Ip,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AnalyticsCacheService } from '../../shared/cache/analytics-cache.service';
import { DerivedViewCacheService } from '../../shared/cache/derived-view-cache.service';
import { DerivedView } from '../../shared/decorators/derived-view.decorator';
import { Perm } from '../auth/permissions.decorator';

import {
  AnalyticsOverviewDto,
  PageRankingDto,
  ReferrerStatsDto,
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from './dto/analytics-response.dto';
import { QueryAnalyticsSchema } from './dto/query-analytics.dto';
import { RecordAnalyticsSchema } from './dto/record-analytics.dto';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService, ArticleStats } from './services/article-stats.service';
import { EchartsFormatterService, EchartsOption } from './services/echarts-formatter.service';
import { PublicAnalyticsService } from './services/public-analytics.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

/**
 * 分析数据控制器
 *
 * 提供网站分析数据的记录、查询和统计功能，包括页面访问、用户行为、
 * 设备统计、浏览器统计等多维度的数据分析服务。
 */
@ApiTags('Analytics')
@Controller({ version: '2' })
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly articleStatsService: ArticleStatsService,
    private readonly publicAnalyticsService: PublicAnalyticsService,
    private readonly thirdPartyAnalyticsService: ThirdPartyAnalyticsService,
    private readonly echartsFormatterService: EchartsFormatterService,
    private readonly analyticsCacheService: AnalyticsCacheService,
    private readonly derivedViewCacheService: DerivedViewCacheService,
  ) {}

  /**
   * 记录分析数据
   *
   * 公开接口，用于记录用户行为分析数据，包括页面访问、点击事件等。
   * 支持限流保护，防止恶意请求。同时会将数据发送到第三方分析服务。
   *
   * @param dto 分析数据传输对象
   * @param ip 客户端IP地址（可选，自动获取）
   * @param userAgent 用户代理字符串（可选，自动获取）
   */
  /**
   * 记录分析数据
   *
   * 记录用户的访问行为数据，包括页面访问、事件触发等。
   * 支持防刷限制，10秒内最多记录10次。
   *
   * @param dto 分析数据记录
   * @param ip 客户端IP地址
   * @param userAgent 用户代理字符串
   */
  @Post('analytics/record')
  @Throttle({ default: { limit: 10, ttl: 10000 } })
  @ApiOperation({ summary: '记录分析数据' })
  @ApiResponse({ status: 201, description: '记录成功' })
  async recordAnalytics(
    @Body() raw: unknown,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    const input = RecordAnalyticsSchema.parse(raw) as {
      type: string;
      path?: string | null;
      referrer?: string | null;
      userAgent?: string | null;
      ip?: string | null;
      data?: unknown;
    };

    const userAgentVal = input.userAgent ?? userAgent ?? null;
    const ipVal = input.ip ?? ip ?? null;

    const recordDto = {
      type: input.type,
      path: input.path ?? null,
      referrer: input.referrer ?? null,
      userAgent: userAgentVal,
      ip: ipVal,
      data: input.data,
    };

    await this.analyticsService.recordAnalytics(recordDto);

    // Invalidate analytics cache to ensure fresh data
    await this.analyticsCacheService.clear();
    await this.derivedViewCacheService.clear();

    // Send to third-party analytics services
    if (input.type === 'pageview' && input.path) {
      const ipArg: string | undefined = ipVal ?? undefined;
      const uaArg: string | undefined = userAgentVal ?? undefined;
      await this.thirdPartyAnalyticsService.trackPageview(input.path, ipArg, uaArg);
    }
  }

  /**
   * 记录文章浏览
   *
   * 公开接口，用于记录特定文章的浏览事件。包含限流保护，
   * 防止同一用户短时间内重复刷新造成的数据污染。
   *
   * @param articleId 文章ID
   * @param ip 客户端IP地址
   * @param userAgent 用户代理字符串（可选）
   */
  /**
   * 记录文章浏览
   *
   * 记录用户对特定文章的浏览行为，用于统计文章热度。
   * 支持防刷限制，10秒内最多记录5次。
   *
   * @param articleId 文章ID
   * @param ip 客户端IP地址
   * @param userAgent 用户代理字符串
   */
  @Post('article/:id/view')
  @Throttle({ default: { limit: 5, ttl: 10000 } })
  @ApiOperation({ summary: '记录文章浏览' })
  @ApiResponse({ status: 201, description: '记录成功' })
  async recordArticleView(
    @Param('id', ParseIntPipe) articleId: number,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.articleStatsService.recordArticleView(articleId, ip, userAgent);
  }

  // 公开的阅读时间记录接口
  /**
   * 记录文章阅读时间
   *
   * 公开接口，用于记录用户在特定文章上的阅读时长。
   * 用于分析用户阅读行为和文章质量评估。
   *
   * @param articleId 文章ID
   * @param duration 阅读时长（秒）
   * @param ip 客户端IP地址
   */
  @Post('article/:id/reading-time')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 1分钟内最多20次请求
  @ApiOperation({ summary: '记录文章阅读时间' })
  @ApiResponse({ status: 201, description: '记录成功' })
  async recordReadingTime(
    @Param('id', ParseIntPipe) articleId: number,
    @Body('duration') duration: number,
    @Ip() ip: string,
  ): Promise<void> {
    await this.articleStatsService.recordReadingTime(articleId, duration, ip);
  }

  // 以下是需要认证的管理接口
  /**
   * 获取数据概览
   *
   * 管理员接口，获取网站分析数据的总体概览，包括访问量、
   * 用户数、页面浏览量等关键指标。支持缓存优化。
   *
   * @returns 分析数据概览
   */
  /**
   * 获取数据概览
   *
   * 获取网站分析数据的总体概览，包括访问量、用户数、页面浏览量等
   * 关键指标。数据缓存2分钟，支持SWR策略。
   *
   * @returns 分析数据概览
   */
  @Get('admin/analytics/overview')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-overview', ttl: 120, swr: true })
  @ApiOperation({ summary: '获取数据概览' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getOverview(): Promise<AnalyticsOverviewDto> {
    return this.analyticsService.getOverview();
  }

  /**
   * 获取页面访问排行
   *
   * 管理员接口，获取网站页面的访问量排行榜，
   * 帮助了解哪些页面最受用户欢迎。
   *
   * @param limit 返回结果数量限制（可选）
   * @returns 页面访问排行数据
   */
  /**
   * 获取页面访问排行
   *
   * 获取网站页面的访问量排行榜，可指定返回的页面数量。
   * 数据缓存3分钟，支持SWR策略。
   *
   * @param limit 返回页面数量限制
   * @returns 页面访问排行列表
   */
  @Get('admin/analytics/page-rankings')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-page-rankings', ttl: 180, swr: true })
  @ApiOperation({ summary: '获取页面访问排行' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPageRankings(@Query('limit') limit?: number): Promise<PageRankingDto[]> {
    return this.analyticsService.getPageRankings(limit);
  }

  /**
   * 获取来源统计
   *
   * 管理员接口，获取网站访问来源的统计数据，
   * 包括搜索引擎、社交媒体、直接访问等来源分析。
   *
   * @param limit 返回结果数量限制（可选）
   * @returns 来源统计数据
   */
  @Get('admin/analytics/referrers')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-referrers', ttl: 180, swr: true })
  @ApiOperation({ summary: '获取来源统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getReferrerStats(@Query('limit') limit?: number): Promise<ReferrerStatsDto[]> {
    return this.analyticsService.getReferrerStats(limit);
  }

  /**
   * 获取图表数据
   *
   * 管理员接口，获取用于生成分析图表的时间序列数据，
   * 支持指定时间范围的访问趋势分析。
   *
   * @param days 查询天数（可选，默认为系统配置）
   * @returns 图表数据
   */
  /**
   * 获取图表数据
   *
   * 获取用于绘制分析图表的时间序列数据，可指定查询的天数范围。
   * 数据缓存4分钟，支持SWR策略。
   *
   * @param days 查询天数范围
   * @returns 图表数据
   */
  @Get('admin/analytics/chart')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-chart', ttl: 240, swr: true })
  @ApiOperation({ summary: '获取图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getChartData(@Query('days') days?: number): Promise<AnalyticsChartDataDto> {
    return this.analyticsService.getChartData(days);
  }

  /**
   * 获取设备统计
   *
   * 管理员接口，获取用户访问设备的统计数据，
   * 包括桌面、移动设备、平板等设备类型分布。
   *
   * @returns 设备统计数据
   */
  @Get('admin/analytics/devices')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-devices', ttl: 360, swr: true })
  @ApiOperation({ summary: '获取设备统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDeviceStats(): Promise<DeviceStatsDto[]> {
    return this.analyticsService.getDeviceStats();
  }

  /**
   * 获取浏览器统计
   *
   * 管理员接口，获取用户使用浏览器的统计数据，
   * 包括Chrome、Firefox、Safari等浏览器类型和版本分布。
   *
   * @returns 浏览器统计数据
   */
  @Get('admin/analytics/browsers')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-browsers', ttl: 360, swr: true })
  @ApiOperation({ summary: '获取浏览器统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getBrowserStats(): Promise<BrowserStatsDto[]> {
    return this.analyticsService.getBrowserStats();
  }

  /**
   * 获取热门文章
   *
   * 管理员接口，获取访问量最高的文章列表，
   * 用于了解最受欢迎的内容和优化内容策略。
   *
   * @param limit 返回结果数量限制（可选）
   * @returns 热门文章统计数据
   */
  /**
   * 获取热门文章
   *
   * 根据访问量、阅读时长等指标获取热门文章排行榜。
   * 数据缓存4分钟，支持SWR策略。
   *
   * @param limit 返回文章数量限制
   * @returns 热门文章列表
   */
  @Get('admin/analytics/articles/top')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-top-articles', ttl: 240, swr: true })
  @ApiOperation({ summary: '获取热门文章' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTopArticles(@Query('limit') limit?: number): Promise<ArticleStats[]> {
    return this.articleStatsService.getTopArticles(limit);
  }

  /**
   * 获取文章统计
   *
   * 管理员接口，获取特定文章的详细统计数据，
   * 包括访问量、阅读时长、用户互动等指标。
   *
   * @param articleId 文章ID
   * @returns 文章统计数据，如果文章不存在则返回null
   */
  @Get('admin/analytics/article/:id')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-article-stats', ttl: 180, swr: true })
  @ApiOperation({ summary: '获取文章统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getArticleStats(
    @Param('id', ParseIntPipe) articleId: number,
  ): Promise<ArticleStats | null> {
    return this.articleStatsService.getArticleStats(articleId);
  }

  /**
   * 导出分析数据
   *
   * 管理员接口，导出指定条件的分析数据，
   * 支持多种查询条件和数据格式导出。
   *
   * @param query 查询条件
   * @returns 导出的分析数据数组
   */
  /**
   * 导出分析数据
   *
   * 根据查询条件导出分析数据，支持多种格式和时间范围。
   * 数据缓存10分钟，不支持SWR策略以确保数据一致性。
   *
   * @param query 查询条件
   * @returns 导出的分析数据
   */
  @Get('admin/analytics/export')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-export', ttl: 600, swr: false })
  @ApiOperation({ summary: '导出分析数据' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async exportAnalyticsData(@Query() raw: unknown): Promise<unknown[]> {
    const query = QueryAnalyticsSchema.parse(raw);
    return this.analyticsService.exportAnalyticsData(query);
  }

  /**
   * 获取Echarts仪表板数据
   *
   * 管理员接口，获取用于Echarts仪表板的综合图表数据，
   * 包括多个维度的可视化配置选项。
   *
   * @param days 查询天数（可选）
   * @returns Echarts配置选项的键值对集合
   */
  /**
   * 获取Echarts仪表板数据
   *
   * 获取用于Echarts仪表板的完整图表配置数据，包含多个图表组件。
   * 数据缓存4分钟，支持SWR策略。
   *
   * @param days 查询天数范围
   * @returns Echarts仪表板配置
   */
  @Get('admin/analytics/echarts/dashboard')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-echarts-dashboard', ttl: 240, swr: true })
  @ApiOperation({ summary: '获取Echarts仪表板数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsDashboard(@Query('days') days?: number): Promise<Record<string, EchartsOption>> {
    const [timeSeries, devices, browsers] = await Promise.all([
      this.analyticsService.getChartData(days),
      this.analyticsService.getDeviceStats(),
      this.analyticsService.getBrowserStats(),
    ]);

    return this.echartsFormatterService.formatDashboard(timeSeries, devices, browsers);
  }

  /**
   * 获取Echarts时间序列图表数据
   *
   * 管理员接口，获取用于时间序列图表的Echarts配置，
   * 展示访问量随时间变化的趋势。
   *
   * @param days 查询天数（可选）
   * @returns Echarts时间序列图表配置
   */
  @Get('admin/analytics/echarts/timeseries')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-echarts-timeseries', ttl: 240, swr: true })
  @ApiOperation({ summary: '获取Echarts时间序列图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsTimeSeries(@Query('days') days?: number): Promise<EchartsOption> {
    const data = await this.analyticsService.getChartData(days);
    return this.echartsFormatterService.formatTimeSeriesChart(data);
  }

  /**
   * 获取Echarts设备分布图表数据
   *
   * 管理员接口，获取用于设备分布图表的Echarts配置，
   * 以饼图或柱状图形式展示不同设备类型的访问分布。
   *
   * @returns Echarts设备分布图表配置
   */
  @Get('admin/analytics/echarts/devices')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-echarts-devices', ttl: 360, swr: true })
  @ApiOperation({ summary: '获取Echarts设备分布图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsDevices(): Promise<EchartsOption> {
    const data = await this.analyticsService.getDeviceStats();
    return this.echartsFormatterService.formatDevicePieChart(data);
  }

  /**
   * 获取Echarts浏览器统计图表数据
   *
   * 管理员接口，获取用于浏览器统计图表的Echarts配置，
   * 以饼图或柱状图形式展示不同浏览器的使用分布。
   *
   * @returns Echarts浏览器统计图表配置
   */
  @Get('admin/analytics/echarts/browsers')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-echarts-browsers', ttl: 360, swr: true })
  @ApiOperation({ summary: '获取Echarts浏览器统计图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsBrowsers(): Promise<EchartsOption> {
    const data = await this.analyticsService.getBrowserStats();
    return this.echartsFormatterService.formatBrowserBarChart(data);
  }

  /**
   * 获取Echarts页面排行图表数据
   *
   * 管理员接口，获取用于页面访问排行图表的Echarts配置，
   * 以柱状图形式展示最受欢迎页面的访问量排行。
   *
   * @param limit 返回结果数量限制（可选）
   * @returns Echarts页面排行图表配置
   */
  @Get('admin/analytics/echarts/page-rankings')
  @Perm('analytics', ['read'])
  @DerivedView({ key: 'analytics-echarts-page-rankings', ttl: 240, swr: true })
  @ApiOperation({ summary: '获取Echarts页面排行图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsPageRankings(@Query('limit') limit?: number): Promise<EchartsOption> {
    const data = await this.analyticsService.getPageRankings(limit);
    return this.echartsFormatterService.formatPageRankingsChart(data);
  }

  /**
   * Get public analytics overview
   *
   * Public endpoint returning basic analytics data (pageviews, visitors).
   */
  @Get('analytics/viewers/public')
  @ApiOperation({ summary: 'Get public viewer stats' })
  @ApiResponse({ status: 200, description: 'Public viewer stats' })
  async getPublicViewer(): Promise<{
    todayPageviews: number;
    yesterdayPageviews: number;
    totalPageviews: number;
    todayVisitors: number;
    yesterdayVisitors: number;
    totalVisitors: number;
  }> {
    const overview = await this.publicAnalyticsService.getPublicOverview();
    return {
      todayPageviews: overview.todayPageviews,
      yesterdayPageviews: overview.yesterdayPageviews,
      totalPageviews: overview.totalPageviews,
      todayVisitors: overview.todayVisitors,
      yesterdayVisitors: overview.yesterdayVisitors,
      totalVisitors: overview.totalVisitors,
    };
  }

  /**
   * Get article viewer stats
   *
   * Public endpoint returning viewer stats for a specific article.
   */
  @Get('analytics/viewers/article/:id')
  @ApiOperation({ summary: 'Get article viewer stats' })
  @ApiResponse({ status: 200, description: 'Article viewer stats' })
  async getArticleViewer(@Param('id', ParseIntPipe) id: number): Promise<{
    articleId: number;
    title: string;
    views: number;
    uniqueVisitors: number;
    avgReadTime: number;
  } | null> {
    const data = await this.publicAnalyticsService.getPublicArticleStats(id);
    if (!data) {
      return null;
    }
    return {
      articleId: data.articleId,
      title: data.title,
      views: data.views,
      uniqueVisitors: data.uniqueVisitors,
      avgReadTime: data.avgReadTime,
    };
  }

  /**
   * Get analytics overview (standard NestJS route)
   *
   * Admin endpoint for analytics overview data.
   */
  @Get('analytics/overview')
  @Perm('analytics', ['read'])
  @ApiOperation({ summary: 'Get analytics overview' })
  @ApiResponse({ status: 200, description: 'Analytics overview data' })
  async getAnalyticsOverviewStd(@Query('tab') _tab?: string): Promise<AnalyticsOverviewDto> {
    return this.analyticsService.getOverview();
  }

  /**
   * Get analytics logs (standard NestJS route)
   *
   * Admin endpoint for analytics logs with pagination.
   */
  @Get('analytics/logs')
  @Perm('analytics', ['read'])
  @ApiOperation({ summary: 'Get analytics logs' })
  @ApiResponse({ status: 200, description: 'Analytics logs' })
  async getAnalyticsLogs(
    @Query('event') event: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ): Promise<{ items: unknown[]; total: number }> {
    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 10;
    return this.analyticsService.getAnalyticsLogs(event, pageNum, sizeNum);
  }
}
