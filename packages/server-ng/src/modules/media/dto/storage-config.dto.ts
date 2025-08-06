import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// 存储提供商枚举
export enum StorageProvider {
  LOCAL = 'local',
  PICGO = 'picgo',
}

// Picgo 配置 Schema
export const PicgoConfigSchema = z.object({
  uploader: z.string().describe('PicGo uploader name'),
  config: z.record(z.string(), z.unknown()).describe('PicGo configuration object'),
});

// 存储配置 Schema
export const UpdateStorageConfigSchema = z.object({
  provider: z.enum(StorageProvider).describe('Storage provider type'),
  enabled: z.boolean().describe('Whether storage is enabled').optional(),
  localPath: z.string().describe('Local storage path').optional(),
  baseUrl: z.string().describe('Base URL for storage').optional(),
  picgoConfig: PicgoConfigSchema.describe('PicGo configuration').optional(),
});

// 存储配置响应 Schema
export const StorageConfigResponseSchema = z.object({
  provider: z.enum(StorageProvider).describe('Storage provider type'),
  enabled: z.boolean().describe('Whether storage is enabled'),
  localPath: z.string().describe('Local storage path').optional(),
  baseUrl: z.string().describe('Base URL for storage').optional(),
  picgoConfig: PicgoConfigSchema.describe('PicGo configuration').optional(),
});

export class UpdateStorageConfigDto extends createZodDto(UpdateStorageConfigSchema) {}
export class StorageConfigResponseDto extends createZodDto(StorageConfigResponseSchema) {}
