import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateSiteInfoDto {
  @ApiProperty({ description: '站点标题' })
  @IsString()
  title!: string;

  @ApiProperty({ description: '站点描述' })
  @IsString()
  description!: string;

  @ApiProperty({ description: '站点作者' })
  @IsString()
  author!: string;

  @ApiProperty({ description: '站点关键词', type: [String] })
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @ApiProperty({ description: '站点 Logo', required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ description: '站点 Favicon', required: false })
  @IsOptional()
  @IsString()
  favicon?: string;

  @ApiProperty({ description: '建站时间', required: false })
  @IsOptional()
  @IsString()
  since?: string;

  @ApiProperty({ description: 'ICP 备案号', required: false })
  @IsOptional()
  @IsString()
  icp?: string;

  @ApiProperty({ description: 'Google Analytics ID', required: false })
  @IsOptional()
  @IsString()
  googleAnalyticsId?: string;

  @ApiProperty({ description: '百度统计 ID', required: false })
  @IsOptional()
  @IsString()
  baiduAnalyticsId?: string;
}
