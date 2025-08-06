import { createZodDto } from 'nestjs-zod';
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
  startDate: z.date().optional().describe('Start date for filtering'),
  endDate: z.date().optional().describe('End date for filtering'),
});

export class LoginLogDto extends createZodDto(LoginLogSchema) {}
export class LoginLogResponseDto extends createZodDto(LoginLogResponseSchema) {}
export class LoginLogQueryDto extends createZodDto(LoginLogQuerySchema) {}
