import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { AnalyticsType } from '../entities/analytics.entity';

export class RecordAnalyticsDto {
  @ApiProperty({ enum: AnalyticsType, description: '分析类型' })
  @IsEnum(AnalyticsType)
  type!: AnalyticsType;

  @ApiPropertyOptional({ description: '页面路径' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: '来源页面' })
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiPropertyOptional({ description: '用户代理字符串' })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({ description: '客户端 IP' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ description: '额外数据' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
