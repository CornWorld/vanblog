import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { dateStr } from '../date-codecs.js';

export const LoginLogResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  success: z.boolean(),
  message: z.string().nullable(),
  createdAt: dateStr,
});
export type LoginLogResponse = z.infer<typeof LoginLogResponseSchema>;

export const createLoginLogContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getLoginLogs: {
      method: 'GET',
      path: '/auth/logs',
      query: z.object({
        username: z.string().optional(),
        // TODO(Phase-3): server-ng currently parses success as boolean; align parsing to accept 'true'|'false' string or update contract accordingly
        success: z.enum(['true', 'false']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      responses: { 200: z.array(LoginLogResponseSchema) },
      summary: 'Get login logs',
    },
    getRecentFailedAttemptsByUsername: {
      method: 'GET',
      path: '/auth/logs/failed-attempts/by-username',
      query: z.object({
        username: z.string(),
        cutoffMinutes: z.number().optional(),
      }),
      responses: { 200: z.object({ count: z.number() }) },
      summary: 'Get recent failed attempts by username',
    },
    getRecentFailedAttemptsByIp: {
      method: 'GET',
      path: '/auth/logs/failed-attempts/by-ip',
      query: z.object({
        ip: z.string(),
        cutoffMinutes: z.number().optional(),
      }),
      responses: { 200: z.object({ count: z.number() }) },
      summary: 'Get recent failed attempts by IP',
    },
  });
