import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsHexColor } from 'class-validator';

export class UpdateThemeDto {
  @ApiProperty({ description: '主题主色调' })
  @IsHexColor()
  primaryColor!: string;

  @ApiProperty({ description: '是否启用暗色模式' })
  @IsBoolean()
  darkMode!: boolean;

  @ApiProperty({ description: '自定义 CSS', required: false })
  @IsOptional()
  @IsString()
  customCss?: string;

  @ApiProperty({ description: '自定义 HTML', required: false })
  @IsOptional()
  @IsString()
  customHtml?: string;

  @ApiProperty({ description: 'Header 代码注入', required: false })
  @IsOptional()
  @IsString()
  headerCode?: string;

  @ApiProperty({ description: 'Footer 代码注入', required: false })
  @IsOptional()
  @IsString()
  footerCode?: string;
}
