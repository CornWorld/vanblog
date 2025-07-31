import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BeianInfoDto {
  @ApiPropertyOptional({ description: 'ICP beian number' })
  @IsString()
  @IsOptional()
  icp?: string;

  @ApiPropertyOptional({ description: 'Gov beian number' })
  @IsString()
  @IsOptional()
  gov?: string;

  @ApiPropertyOptional({ description: 'Gov beian URL' })
  @IsString()
  @IsOptional()
  govUrl?: string;

  @ApiPropertyOptional({ description: 'Whether to show beian information' })
  @IsBoolean()
  @IsOptional()
  showBeian?: boolean;
}
