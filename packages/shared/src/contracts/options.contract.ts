import { initContract } from '@ts-rest/core';
import { z } from 'zod';

// TODO: 需要从 server-ng DTOs 迁移 OptionsQuerySchema 和 OptionsResponseSchema 到 shared/schemas
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
