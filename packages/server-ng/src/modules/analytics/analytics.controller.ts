import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
  Headers,
  Ip,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

import {
  AnalyticsOverviewDto,
  PageRankingDto,
  ReferrerStatsDto,
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from './dto/analytics-response.dto';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import { RecordAnalyticsDto, RecordAnalyticsSchema } from './dto/record-analytics.dto';
import { AnalyticsType } from './entities/analytics.entity';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService, ArticleStats } from './services/article-stats.service';
import { EchartsFormatterService, EchartsOption } from './services/echarts-formatter.service';
import { ThirdPartyAnalyticsService } from './services/third-party-analytics.service';

@ApiTags('数据分析')
@Controller({ version: '2' })
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly articleStatsService: ArticleStatsService,
    private readonly thirdPartyAnalyticsService: ThirdPartyAnalyticsService,
    private readonly echartsFormatterService: EchartsFormatterService,
  ) {}

  // 公开的记录接口，前端可以调用
  @Post('analytics/record')
  @Throttle({ medium: { limit: 10, ttl: 10000 } }) // 10秒内最多10次请求
  @UsePipes(new ZodValidationPipe(RecordAnalyticsSchema))
  @ApiOperation({ summary: '记录分析数据' })
  @ApiResponse({ status: 201, description: '记录成功' })
  async recordAnalytics(
    @Body() dto: RecordAnalyticsDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    // 如果没有提供 IP 或 User-Agent，使用请求中的信息

    const recordDto = {
      type: dto.type,
      path: dto.path,
      referrer: dto.referrer,
      userAgent: dto.userAgent ?? userAgent ?? null,
      ip: dto.ip ?? ip ?? null,
      data: dto.data,
    } as RecordAnalyticsDto;

    await this.analyticsService.recordAnalytics(recordDto);

    // Send to third-party analytics services
    if (dto.type === AnalyticsType.PAGEVIEW && dto.path) {
      await this.thirdPartyAnalyticsService.trackPageview(
        dto.path,
        recordDto.ip ?? undefined,
        recordDto.userAgent ?? undefined,
      );
    }
  }

  // 公开的文章浏览记录接口
  @Post('article/:id/view')
  @Throttle({ medium: { limit: 5, ttl: 10000 } }) // 10秒内最多5次请求
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
  @Post('article/:id/reading-time')
  @Throttle({ long: { limit: 20, ttl: 60000 } }) // 1分钟内最多20次请求
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
  @Get('admin/analytics/overview')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取数据概览' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getOverview(): Promise<AnalyticsOverviewDto> {
    return this.analyticsService.getOverview();
  }

  @Get('admin/analytics/page-rankings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取页面访问排行' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPageRankings(@Query('limit') limit?: number): Promise<PageRankingDto[]> {
    return this.analyticsService.getPageRankings(limit);
  }

  @Get('admin/analytics/referrers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取来源统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getReferrerStats(@Query('limit') limit?: number): Promise<ReferrerStatsDto[]> {
    return this.analyticsService.getReferrerStats(limit);
  }

  @Get('admin/analytics/chart')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getChartData(@Query('days') days?: number): Promise<AnalyticsChartDataDto> {
    return this.analyticsService.getChartData(days);
  }

  @Get('admin/analytics/devices')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取设备统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getDeviceStats(): Promise<DeviceStatsDto[]> {
    return this.analyticsService.getDeviceStats();
  }

  @Get('admin/analytics/browsers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取浏览器统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getBrowserStats(): Promise<BrowserStatsDto[]> {
    return this.analyticsService.getBrowserStats();
  }

  @Get('admin/analytics/articles/top')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取热门文章' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTopArticles(@Query('limit') limit?: number): Promise<ArticleStats[]> {
    return this.articleStatsService.getTopArticles(limit);
  }

  @Get('admin/analytics/article/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取文章统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getArticleStats(
    @Param('id', ParseIntPipe) articleId: number,
  ): Promise<ArticleStats | null> {
    return this.articleStatsService.getArticleStats(articleId);
  }

  @Get('admin/analytics/export')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '导出分析数据' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async exportAnalyticsData(@Query() query: QueryAnalyticsDto): Promise<unknown[]> {
    return this.analyticsService.exportAnalyticsData(query);
  }

  @Get('admin/analytics/echarts/dashboard')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
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

  @Get('admin/analytics/echarts/timeseries')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取Echarts时间序列图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsTimeSeries(@Query('days') days?: number): Promise<EchartsOption> {
    const data = await this.analyticsService.getChartData(days);
    return this.echartsFormatterService.formatTimeSeriesChart(data);
  }

  @Get('admin/analytics/echarts/devices')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取Echarts设备分布图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsDevices(): Promise<EchartsOption> {
    const data = await this.analyticsService.getDeviceStats();
    return this.echartsFormatterService.formatDevicePieChart(data);
  }

  @Get('admin/analytics/echarts/browsers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取Echarts浏览器统计图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsBrowsers(): Promise<EchartsOption> {
    const data = await this.analyticsService.getBrowserStats();
    return this.echartsFormatterService.formatBrowserBarChart(data);
  }

  @Get('admin/analytics/echarts/page-rankings')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics', 'read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取Echarts页面排行图表数据' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getEchartsPageRankings(@Query('limit') limit?: number): Promise<EchartsOption> {
    const data = await this.analyticsService.getPageRankings(limit);
    return this.echartsFormatterService.formatPageRankingsChart(data);
  }
}
