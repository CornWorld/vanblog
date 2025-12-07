import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const adminArticleAliasContract = c.router({
  health: {
    method: 'GET',
    path: '/v2/admin/articles-alias/health',
    responses: { 200: z.object({ status: z.literal('ok') }) },
  },
});
