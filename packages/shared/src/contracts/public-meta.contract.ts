import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createPublicMetaContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getMeta: { method: 'GET', path: '/v2/public/meta', responses: { 200: z.any() } },
  });
