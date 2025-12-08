import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const OptionsQuerySchema = z.object({}).optional();
const OptionsResponseSchema = z.any();

export const createOptionsContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getOptions: {
      method: 'GET',
      path: '/v2/public/options',
      query: OptionsQuerySchema,
      responses: { 200: OptionsResponseSchema },
    },
  });
