import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createSettingRegistryContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getKeys: {
      method: 'GET',
      path: '/v2/admin/config/keys',
      responses: { 200: z.array(z.string()) },
    },
    getByKey: {
      method: 'GET',
      path: '/v2/admin/config/:key',
      pathParams: z.object({ key: z.string() }),
      responses: { 200: z.object({ key: z.string(), value: z.any() }) },
    },
    updateByKey: {
      method: 'PUT',
      path: '/v2/admin/config/:key',
      pathParams: z.object({ key: z.string() }),
      body: z.object({ value: z.any() }),
      responses: { 200: z.object({ key: z.string(), value: z.any() }) },
    },
    deleteByKey: {
      method: 'DELETE',
      path: '/v2/admin/config/:key',
      pathParams: z.object({ key: z.string() }),
      responses: { 200: z.object({ message: z.string() }) },
    },
  });
