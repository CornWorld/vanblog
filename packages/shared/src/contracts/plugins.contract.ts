import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createPluginsContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    list: { method: 'GET', path: '/v2/admin/plugins', responses: { 200: z.any() } },
    getOne: {
      method: 'GET',
      path: '/v2/admin/plugins/:name',
      pathParams: z.object({ name: z.string() }),
      responses: { 200: z.any().nullable() },
    },
    reload: {
      method: 'POST',
      path: '/v2/admin/plugins/reload',
      body: z.object({}).optional(),
      responses: { 200: z.any() },
    },
    unload: {
      method: 'DELETE',
      path: '/v2/admin/plugins/:name',
      pathParams: z.object({ name: z.string() }),
      responses: { 200: z.any() },
    },
    failed: {
      method: 'GET',
      path: '/v2/admin/plugins/failed',
      responses: { 200: z.array(z.string()) },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const pluginsContract = createPluginsContract(c);
