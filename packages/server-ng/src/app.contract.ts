import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const appContract = c.router({
  hello: {
    method: 'GET',
    path: '/',
    responses: { 200: z.string() },
  },
});
