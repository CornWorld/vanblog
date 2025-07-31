import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsObject, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum StorageProvider {
  LOCAL = 'local',
  PICGO = 'picgo',
}

class PicgoConfigDto {
  @ApiPropertyOptional({ description: 'PicGo 配置（JSON 格式）' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'PicGo 插件列表（逗号分隔）' })
  @IsOptional()
  @IsString()
  plugins?: string;
}

export class UpdateStorageConfigDto {
  @ApiProperty({ enum: StorageProvider, description: '存储提供商' })
  @IsEnum(StorageProvider)
  provider!: StorageProvider;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'PicGo 配置' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PicgoConfigDto)
  picgoConfig?: PicgoConfigDto;
}

export class StorageConfigResponseDto {
  @ApiProperty({ enum: StorageProvider })
  provider!: StorageProvider;

  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional()
  picgoConfig?: Partial<PicgoConfigDto>;
}
