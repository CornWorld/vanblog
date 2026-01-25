import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createPublicAnalyticsContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    overview: { method: 'GET', path: '/v2/analytics/public/overview', responses: { 200: z.any() } },
    article: {
      method: 'GET',
      path: '/v2/analytics/public/article/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.any().nullable() },
    },
    pageRankings: {
      method: 'GET',
      path: '/v2/analytics/public/page-rankings',
      responses: { 200: z.array(z.any()) },
    },
  });
