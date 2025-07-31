import { IsString, IsOptional, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBeianInfoDto {
  @ApiPropertyOptional({ description: 'ICP备案号' })
  @IsString()
  @IsOptional()
  icp?: string;

  @ApiPropertyOptional({ description: 'ICP备案链接' })
  @IsUrl()
  @IsOptional()
  icpUrl?: string;

  @ApiPropertyOptional({ description: '公安备案号' })
  @IsString()
  @IsOptional()
  gaBeianNumber?: string;

  @ApiPropertyOptional({ description: '公安备案链接' })
  @IsUrl()
  @IsOptional()
  gaBeianUrl?: string;

  @ApiPropertyOptional({ description: '公安备案图标链接' })
  @IsUrl()
  @IsOptional()
  gaBeianLogoUrl?: string;
}
