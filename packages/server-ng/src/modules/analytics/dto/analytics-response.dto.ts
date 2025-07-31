import { ApiProperty } from '@nestjs/swagger';

export class AnalyticsOverviewDto {
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

export class PageRankingDto {
  @ApiProperty({ description: '页面路径' })
  path!: string;

  @ApiProperty({ description: '访问次数' })
  views!: number;

  @ApiProperty({ description: '独立访客数' })
  uniqueVisitors!: number;
}

export class ReferrerStatsDto {
  @ApiProperty({ description: '来源地址' })
  referrer!: string;

  @ApiProperty({ description: '访问次数' })
  count!: number;
}

export class TimeSeriesDataDto {
  @ApiProperty({ description: '时间' })
  time!: string;

  @ApiProperty({ description: '数值' })
  value!: number;
}

export class AnalyticsChartDataDto {
  @ApiProperty({ description: '页面访问量时间序列', type: [TimeSeriesDataDto] })
  pageviews!: TimeSeriesDataDto[];

  @ApiProperty({ description: '独立访客时间序列', type: [TimeSeriesDataDto] })
  visitors!: TimeSeriesDataDto[];
}

export class DeviceStatsDto {
  @ApiProperty({ description: '设备类型' })
  device!: string;

  @ApiProperty({ description: '访问次数' })
  count!: number;

  @ApiProperty({ description: '百分比' })
  percentage!: number;
}

export class BrowserStatsDto {
  @ApiProperty({ description: '浏览器' })
  browser!: string;

  @ApiProperty({ description: '访问次数' })
  count!: number;

  @ApiProperty({ description: '百分比' })
  percentage!: number;
}
