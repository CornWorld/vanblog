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
/**
 * PicGo 插件日志条目
 *
 * @note Uses ISO 8601 timestamps with timezone
 * @reason In-memory circular buffer for debugging, not persisted to database
 * @see PicgoStorageService - in-memory logs with 200 entries max
 */
export const PicGoPluginLogEntrySchema = z.object({
  /** ISO 8601 timestamp with timezone */
  timestamp: z.string(),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
});

export const PicGoPluginLogsResponseSchema = z.object({
  logs: z.array(PicGoPluginLogEntrySchema),
  total: z.number(),
});

export type PicGoPluginInfo = z.infer<typeof PicGoPluginInfoSchema>;
export type PicGoPluginLogEntry = z.infer<typeof PicGoPluginLogEntrySchema>;

export type InstallPicGoPluginDto = z.infer<typeof InstallPicGoPluginSchema>;
export type UninstallPicGoPluginDto = z.infer<typeof UninstallPicGoPluginSchema>;
export type PicGoPluginInfoDto = z.infer<typeof PicGoPluginInfoSchema>;
export type PicGoPluginListResponseDto = z.infer<typeof PicGoPluginListResponseSchema>;
export type PicGoPluginOperationResponseDto = z.infer<typeof PicGoPluginOperationResponseSchema>;
export type PicGoPluginLogEntryDto = z.infer<typeof PicGoPluginLogEntrySchema>;
export type PicGoPluginLogsResponseDto = z.infer<typeof PicGoPluginLogsResponseSchema>;
