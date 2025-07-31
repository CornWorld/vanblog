import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomCodeDto {
  @ApiPropertyOptional({ description: 'Custom CSS code' })
  @IsOptional()
  @IsString()
  customCss?: string;

  @ApiPropertyOptional({ description: 'Custom HTML code' })
  @IsOptional()
  @IsString()
  customHtml?: string;

  @ApiPropertyOptional({ description: 'Header injection code' })
  @IsOptional()
  @IsString()
  headerCode?: string;

  @ApiPropertyOptional({ description: 'Footer injection code' })
  @IsOptional()
  @IsString()
  footerCode?: string;
}
