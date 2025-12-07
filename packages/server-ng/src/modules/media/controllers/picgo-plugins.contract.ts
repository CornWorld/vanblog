import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const picgoPluginsContract = c.router({
  list: {
    method: 'GET',
    path: '/v2/admin/media/picgo/plugins',
    responses: {
      200: z.object({
        plugins: z.array(
          z.object({
            name: z.string().optional(),
            version: z.string().optional(),
            description: z.string().optional(),
            loaded: z.boolean().optional(),
          }),
        ),
        total: z.number(),
      }),
    },
  },
  logs: {
    method: 'GET',
    path: '/v2/admin/media/picgo/plugins/logs',
    responses: {
      200: z.object({
        logs: z.array(
          z.object({
            timestamp: z.number(),
            level: z.enum(['error', 'info', 'warn']),
            message: z.string(),
          }),
        ),
        total: z.number(),
      }),
    },
  },
  install: {
    method: 'POST',
    path: '/v2/admin/media/picgo/plugins/install',
    body: z.object({ plugins: z.array(z.string()) }),
    responses: {
      200: z.object({
        success: z.boolean(),
        message: z.string(),
        installedPlugins: z.array(z.string()).optional(),
        errors: z.array(z.string()).optional(),
      }),
    },
  },
  uninstall: {
    method: 'POST',
    path: '/v2/admin/media/picgo/plugins/uninstall',
    body: z.object({ plugins: z.array(z.string()) }),
    responses: {
      200: z.object({
        success: z.boolean(),
        message: z.string(),
        errors: z.array(z.string()).optional(),
      }),
    },
  },
});
