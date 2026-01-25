import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createPublicCustomPageContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getAll: {
      method: 'GET',
      path: '/v2/public/customPage/all',
      responses: {
        200: z.object({
          statusCode: z.number(),
          data: z.array(z.object({ name: z.string(), path: z.string() })),
        }),
      },
    },
    getOne: {
      method: 'GET',
      path: '/v2/public/customPage',
      query: z.object({ path: z.string() }),
      responses: {
        200: z.object({
          statusCode: z.number(),
          data: z.object({ name: z.string(), path: z.string(), html: z.string() }),
        }),
      },
    },
  });
