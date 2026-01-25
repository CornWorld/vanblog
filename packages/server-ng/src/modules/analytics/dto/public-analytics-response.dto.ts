import { ApiProperty } from '@nestjs/swagger';

/**
 * 公开访客统计概览 DTO
 *
 * 脱敏后的统计概览数据，移除了敏感信息，
 * 仅包含基础的访问量和访客数统计。
 */
export class PublicAnalyticsOverviewDto {
  @ApiProperty({ description: '今日访问量' })
  todayPageviews!: number;

  @ApiProperty({ description: '昨日访问量' })
  yesterdayPageviews!: number;

  @ApiProperty({ description: '总访问量' })
  totalPageviews!: number;

  @ApiProperty({ description: '今日访客数' })
  todayVisitors!: number;

  @ApiProperty({ description: '昨日访客数' })
  yesterdayVisitors!: number;

  @ApiProperty({ description: '总访客数' })
  totalVisitors!: number;
}

/**
 * 公开文章统计 DTO
 *
 * 脱敏后的单篇文章统计数据，移除了敏感信息，
 * 仅包含基础的访问量和阅读时长统计。
 */
export class PublicArticleStatsDto {
  @ApiProperty({ description: '文章ID' })
  articleId!: number;

  @ApiProperty({ description: '文章标题' })
  title!: string;

  @ApiProperty({ description: '总访问量' })
  views!: number;

  @ApiProperty({ description: '独立访客数' })
  uniqueVisitors!: number;

  @ApiProperty({ description: '平均阅读时长（秒）' })
  avgReadTime!: number;
}

/**
 * 公开页面排行 DTO
 *
 * 脱敏后的页面访问排行数据，移除了敏感路径信息。
 */
export class PublicPageRankingDto {
  @ApiProperty({ description: '页面路径（脱敏）' })
  path!: string;

  @ApiProperty({ description: '访问次数' })
  views!: number;
}
