import { z } from 'zod';
import { commonSchemas } from '../../../shared/zod';

export const LoginLogSchema = z.object({
  username: commonSchemas.nonEmptyString.describe('Username attempting to login'),
  ip: z.string().optional().describe('IP address of the login attempt'),
  userAgent: z.string().optional().describe('User agent string'),
  success: z.boolean().describe('Whether the login was successful'),
  message: z.string().optional().describe('Additional message about the login attempt'),
});

export const LoginLogResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  success: z.boolean(),
  message: z.string().optional(),
  createdAt: z.date(),
});

export const LoginLogQuerySchema = z.object({
  username: z.string().optional().describe('Filter by username'),
  success: z.boolean().optional().describe('Filter by success status'),
  startDate: z.date().optional().describe('Start date for filtering'),
  endDate: z.date().optional().describe('End date for filtering'),
});

export type LoginLogDto = z.infer<typeof LoginLogSchema>;
export type LoginLogResponseDto = z.infer<typeof LoginLogResponseSchema>;
export type LoginLogQueryDto = z.infer<typeof LoginLogQuerySchema>;
