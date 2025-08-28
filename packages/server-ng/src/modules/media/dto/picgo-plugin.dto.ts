import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const InstallPicGoPluginSchema = z.object({
  plugins: z.array(z.string().min(1)).min(1).describe('Plugin names to install'),
});

export const UninstallPicGoPluginSchema = z.object({
  plugins: z.array(z.string().min(1)).min(1).describe('Plugin names to uninstall'),
});

export const PicGoPluginInfoSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  installed: z.boolean(),
  enabled: z.boolean().optional(),
});

export const PicGoPluginListResponseSchema = z.object({
  plugins: z.array(PicGoPluginInfoSchema),
  total: z.number(),
});

export const PicGoPluginOperationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  installedPlugins: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

// 新增：插件执行日志
export const PicGoPluginLogEntrySchema = z.object({
  timestamp: z.number().int(),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
});

export const PicGoPluginLogsResponseSchema = z.object({
  logs: z.array(PicGoPluginLogEntrySchema),
  total: z.number(),
});

export type PicGoPluginInfo = z.infer<typeof PicGoPluginInfoSchema>;
export type PicGoPluginLogEntry = z.infer<typeof PicGoPluginLogEntrySchema>;

export class InstallPicGoPluginDto extends createZodDto(InstallPicGoPluginSchema) {}
export class UninstallPicGoPluginDto extends createZodDto(UninstallPicGoPluginSchema) {}
export class PicGoPluginInfoDto extends createZodDto(PicGoPluginInfoSchema) {}
export class PicGoPluginListResponseDto extends createZodDto(PicGoPluginListResponseSchema) {}
export class PicGoPluginOperationResponseDto extends createZodDto(
  PicGoPluginOperationResponseSchema,
) {}
export class PicGoPluginLogEntryDto extends createZodDto(PicGoPluginLogEntrySchema) {}
export class PicGoPluginLogsResponseDto extends createZodDto(PicGoPluginLogsResponseSchema) {}
