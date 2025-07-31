import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { AnalyticsType } from '../entities/analytics.entity';

export class QueryAnalyticsDto {
  @ApiPropertyOptional({ enum: AnalyticsType, description: '分析类型' })
  @IsOptional()
  @IsEnum(AnalyticsType)
  type?: AnalyticsType;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '页面路径' })
  @IsOptional()
  @IsString()
  path?: string;
}
