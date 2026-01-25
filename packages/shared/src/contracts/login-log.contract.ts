import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { LoginLog, PaginationQuery } from '../runtime/schema.js';

export const createLoginLogContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getLoginLogs: {
      method: 'GET',
      path: '/auth/logs',
      query: PaginationQuery.extend({
        username: z.string().optional(),
        success: z.coerce.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      responses: { 200: z.array(LoginLog) },
      summary: 'Get login logs',
    },
    getRecentFailedAttemptsByUsername: {
      method: 'GET',
      path: '/auth/logs/failed-attempts/by-username',
      query: z.object({
        username: z.string(),
        cutoffMinutes: z.coerce.number().optional(),
      }),
      responses: { 200: z.object({ count: z.number() }) },
      summary: 'Get recent failed attempts by username',
    },
    getRecentFailedAttemptsByIp: {
      method: 'GET',
      path: '/auth/logs/failed-attempts/by-ip',
      query: z.object({
        ip: z.string(),
        cutoffMinutes: z.coerce.number().optional(),
      }),
      responses: { 200: z.object({ count: z.number() }) },
      summary: 'Get recent failed attempts by IP',
    },
  });
