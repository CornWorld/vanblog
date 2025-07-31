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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './services/analytics.service';
import { ArticleStatsService, ArticleStats } from './services/article-stats.service';
import { RecordAnalyticsDto } from './dto/record-analytics.dto';
import { QueryAnalyticsDto } from './dto/query-analytics.dto';
import {
  AnalyticsOverviewDto,
  PageRankingDto,
  ReferrerStatsDto,
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from './dto/analytics-response.dto';

@ApiTags('数据分析')
@Controller('api/v2')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly articleStatsService: ArticleStatsService,
  ) {}

  // 公开的记录接口，前端可以调用
  @Post('analytics/record')
  @ApiOperation({ summary: '记录分析数据' })
  @ApiResponse({ status: 201, description: '记录成功' })
  async recordAnalytics(
    @Body() dto: RecordAnalyticsDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    // 如果没有提供 IP 或 User-Agent，使用请求中的信息
    const recordDto: RecordAnalyticsDto = {
      type: dto.type,
      path: dto.path,
      referrer: dto.referrer,
      userAgent: dto.userAgent ?? userAgent,
      ip: dto.ip ?? ip,
      data: dto.data,
    };

    await this.analyticsService.recordAnalytics(recordDto);
  }

  // 公开的文章浏览记录接口
  @Post('article/:id/view')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取数据概览' })
  @ApiResponse({ status: 200, description: '获取成功', type: AnalyticsOverviewDto })
  async getOverview(): Promise<AnalyticsOverviewDto> {
    return this.analyticsService.getOverview();
  }

  @Get('admin/analytics/page-rankings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取页面访问排行' })
  @ApiResponse({ status: 200, description: '获取成功', type: [PageRankingDto] })
  async getPageRankings(@Query('limit') limit?: number): Promise<PageRankingDto[]> {
    return this.analyticsService.getPageRankings(limit);
  }

  @Get('admin/analytics/referrers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取来源统计' })
  @ApiResponse({ status: 200, description: '获取成功', type: [ReferrerStatsDto] })
  async getReferrerStats(@Query('limit') limit?: number): Promise<ReferrerStatsDto[]> {
    return this.analyticsService.getReferrerStats(limit);
  }

  @Get('admin/analytics/chart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取图表数据' })
  @ApiResponse({ status: 200, description: '获取成功', type: AnalyticsChartDataDto })
  async getChartData(@Query('days') days?: number): Promise<AnalyticsChartDataDto> {
    return this.analyticsService.getChartData(days);
  }

  @Get('admin/analytics/devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取设备统计' })
  @ApiResponse({ status: 200, description: '获取成功', type: [DeviceStatsDto] })
  async getDeviceStats(): Promise<DeviceStatsDto[]> {
    return this.analyticsService.getDeviceStats();
  }

  @Get('admin/analytics/browsers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取浏览器统计' })
  @ApiResponse({ status: 200, description: '获取成功', type: [BrowserStatsDto] })
  async getBrowserStats(): Promise<BrowserStatsDto[]> {
    return this.analyticsService.getBrowserStats();
  }

  @Get('admin/analytics/articles/top')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取热门文章' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTopArticles(@Query('limit') limit?: number): Promise<ArticleStats[]> {
    return this.articleStatsService.getTopArticles(limit);
  }

  @Get('admin/analytics/article/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取文章统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getArticleStats(
    @Param('id', ParseIntPipe) articleId: number,
  ): Promise<ArticleStats | null> {
    return this.articleStatsService.getArticleStats(articleId);
  }

  @Get('admin/analytics/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '导出分析数据' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async exportAnalyticsData(@Query() query: QueryAnalyticsDto): Promise<unknown[]> {
    return this.analyticsService.exportAnalyticsData(query);
  }
}
