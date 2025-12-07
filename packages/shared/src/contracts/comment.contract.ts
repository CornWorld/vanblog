import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createCommentContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getWaline: { method: 'GET', path: '/v2/comment/waline', responses: { 200: z.any() } },
    updateWaline: {
      method: 'POST',
      path: '/v2/comment/waline',
      body: z.any(),
      responses: { 200: z.any() },
    },
    restartWaline: {
      method: 'POST',
      path: '/v2/comment/waline/restart',
      body: z.object({}).optional(),
      responses: { 200: z.object({ message: z.string() }) },
    },
    statusWaline: { method: 'GET', path: '/v2/comment/waline/status', responses: { 200: z.any() } },
  });

// Legacy export for backward compatibility
const c = initContract();
export const commentContract = createCommentContract(c);
