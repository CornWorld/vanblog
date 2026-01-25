import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { DeleteResponse } from '../runtime/schema.js';

// Plugin info schema
export const PluginInfo = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const createPluginsContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    list: {
      method: 'GET',
      path: '/v2/admin/plugins',
      responses: { 200: z.array(PluginInfo) },
    },
    getOne: {
      method: 'GET',
      path: '/v2/admin/plugins/:name',
      pathParams: z.object({ name: z.string() }),
      responses: { 200: PluginInfo.nullable() },
    },
    reload: {
      method: 'POST',
      path: '/v2/admin/plugins/reload',
      body: z.object({}).optional(),
      responses: { 200: z.object({ message: z.string() }) },
    },
    unload: {
      method: 'DELETE',
      path: '/v2/admin/plugins/:name',
      pathParams: z.object({ name: z.string() }),
      responses: { 200: DeleteResponse },
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
