import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAnalyticsConfigDto {
  @ApiPropertyOptional({ description: 'Google Analytics ID' })
  @IsString()
  @IsOptional()
  googleAnalyticsId?: string;

  @ApiPropertyOptional({ description: 'Baidu Analytics ID' })
  @IsString()
  @IsOptional()
  baiduAnalyticsId?: string;
}
