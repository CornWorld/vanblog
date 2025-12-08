import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const InitCmsRequestSchema = z.any();
const InitCmsResponseSchema = z.any();

export const createPublicInitContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    init: {
      method: 'POST',
      path: '/v2/public/init',
      body: InitCmsRequestSchema,
      responses: { 200: InitCmsResponseSchema },
    },
  });
