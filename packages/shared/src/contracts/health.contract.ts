import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { dateStr } from '../date-codecs.js';

export const HealthResponseSchema = z.object({ timestamp: dateStr });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const createHealthContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getHealth: {
      method: 'GET',
      path: '/health',
      responses: { 200: HealthResponseSchema },
      summary: 'Health status',
    },
  });
