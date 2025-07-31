import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListStaticFilesDto {
  @ApiProperty({ description: '文件名搜索关键词', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: 'MIME 类型筛选', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ description: '存储提供商筛选', required: false })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ description: '页码', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页数量', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
