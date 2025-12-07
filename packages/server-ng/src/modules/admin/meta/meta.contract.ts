import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const adminMetaContract = c.router({
  version: {
    method: 'GET',
    path: '/v2/admin/meta/version',
    responses: {
      200: z.object({
        version: z.string(),
        latestVersion: z.string(),
        hasUpdate: z.boolean(),
        updateInfo: z
          .object({ version: z.string(), description: z.string(), url: z.string() })
          .optional(),
      }),
    },
  },
});
