import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { RewardInfoSchema } from './reward.dto';

const c = initContract();

export const rewardContract = c.router({
  list: {
    method: 'GET',
    path: '/api/admin/reward',
    responses: { 200: z.array(RewardInfoSchema) },
  },
  upsert: {
    method: 'POST',
    path: '/api/admin/reward',
    body: RewardInfoSchema,
    responses: { 200: z.array(RewardInfoSchema) },
  },
  delete: {
    method: 'DELETE',
    path: '/api/admin/reward/:name',
    pathParams: z.object({ name: z.string() }),
    responses: { 200: z.array(RewardInfoSchema) },
  },
});
