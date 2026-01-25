import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createPublicBootstrapContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getBootstrap: { method: 'GET', path: '/v2/public/bootstrap', responses: { 200: z.any() } },
  });
