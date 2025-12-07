import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createMetricsContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    metrics: { method: 'GET', path: '/v2/metrics', responses: { 200: z.string() } },
    health: {
      method: 'GET',
      path: '/v2/metrics/health',
      responses: {
        200: z.object({
          status: z.enum(['healthy', 'warning', 'critical']),
          message: z.string(),
          errorRate: z.number(),
        }),
      },
    },
    performance: { method: 'GET', path: '/v2/metrics/performance', responses: { 200: z.any() } },
  });
