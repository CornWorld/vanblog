import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NavigationItemDto {
  @ApiProperty({ description: '导航名称' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '导航路径' })
  @IsString()
  path!: string;

  @ApiProperty({ description: '导航图标', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ description: '是否外部链接', required: false })
  @IsOptional()
  @IsBoolean()
  external?: boolean;

  @ApiProperty({ description: '子导航项', type: [NavigationItemDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NavigationItemDto)
  children?: NavigationItemDto[];
}

export class UpdateNavigationDto {
  @ApiProperty({ description: '导航项列表', type: [NavigationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NavigationItemDto)
  items!: NavigationItemDto[];
}
