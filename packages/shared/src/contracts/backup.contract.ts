import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createBackupContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    create: {
      method: 'POST',
      path: '/v2/backup',
      body: z.any(),
      responses: { 201: z.any() },
    },
    list: {
      method: 'GET',
      path: '/v2/backup',
      query: z.any(),
      responses: { 200: z.any() },
    },
    download: {
      method: 'GET',
      path: '/v2/backup/:filename/download',
      pathParams: z.object({ filename: z.string() }),
      responses: { 200: z.any() },
    },
    delete: {
      method: 'DELETE',
      path: '/v2/backup/:filename',
      pathParams: z.object({ filename: z.string() }),
      responses: { 200: z.void() },
    },
    restore: {
      method: 'POST',
      path: '/v2/backup/:filename/restore',
      pathParams: z.object({ filename: z.string() }),
      body: z.any(),
      responses: { 202: z.object({ taskId: z.string() }) },
    },
    progress: {
      method: 'GET',
      path: '/v2/backup/restore/:taskId/progress',
      pathParams: z.object({ taskId: z.string() }),
      responses: { 200: z.any() },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const backupContract = createBackupContract(c);
