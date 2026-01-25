import { z } from 'zod';

// 备份创建请求
export const CreateBackupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  includeMedia: z.boolean().default(true),
  includeAnalytics: z.boolean().default(false),
  includeLogs: z.boolean().default(false),
  password: z.string().min(6).optional(),
});

export type CreateBackupDto = z.infer<typeof CreateBackupSchema>;

// 备份恢复请求
export const RestoreBackupSchema = z.object({
  password: z.string().optional(),
  overwriteExisting: z.boolean().default(false),
  restoreMedia: z.boolean().default(true),
  restoreAnalytics: z.boolean().default(false),
  restoreLogs: z.boolean().default(false),
});

export type RestoreBackupDto = z.infer<typeof RestoreBackupSchema>;

// 备份列表查询
export const GetBackupsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
});

export type GetBackupsDto = z.infer<typeof GetBackupsSchema>;

// 备份信息响应
export const BackupInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  filename: z.string(),
  size: z.number(),
  hasPassword: z.boolean(),
  includeMedia: z.boolean(),
  includeAnalytics: z.boolean(),
  includeLogs: z.boolean(),
  createdAt: z.string(),
  tables: z.record(z.string(), z.number()), // table name -> record count
});

export type BackupInfoDto = z.infer<typeof BackupInfoSchema>;

// 备份列表响应
export const BackupListSchema = z.object({
  backups: z.array(BackupInfoSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export type BackupListDto = z.infer<typeof BackupListSchema>;

// 恢复进度响应
export const RestoreProgressSchema = z.object({
  taskId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  currentTable: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type RestoreProgressDto = z.infer<typeof RestoreProgressSchema>;
