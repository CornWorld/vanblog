import { z } from 'zod';

import { selectLoginLogSchema, insertLoginLogSchema } from '../../../database';

// 登录日志 Schema - 使用 drizzle-zod 生成的 schema
export const LoginLogSchema = insertLoginLogSchema.omit({
  id: true,
  createdAt: true,
});

// 登录日志响应 Schema - 使用 drizzle-zod 生成的 schema
export const LoginLogResponseSchema = selectLoginLogSchema;

export const LoginLogQuerySchema = z.object({
  username: z.string().optional().describe('Filter by username'),
  success: z.boolean().optional().describe('Filter by success status'),
  startDate: z.string().optional().describe('Start date for filtering'),
  endDate: z.string().optional().describe('End date for filtering'),
});

export type LoginLogDto = z.infer<typeof LoginLogSchema>;
export type LoginLogResponseDto = z.infer<typeof LoginLogResponseSchema>;
export type LoginLogQueryDto = z.infer<typeof LoginLogQuerySchema>;
