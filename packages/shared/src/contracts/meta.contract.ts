import { initContract } from '@ts-rest/core';
import { z } from 'zod';

// Version info schema
export const VersionInfo = z.object({
  version: z.string(),
  buildTime: z.string(),
  nodeVersion: z.string().optional(),
  platform: z.string().optional(),
});

// Meta response for public endpoint
export const MetaResponse = z.object({
  buildTime: z.string(),
});

export const createMetaContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getPublicMeta: {
      method: 'GET',
      path: '/public/meta',
      responses: { 200: MetaResponse },
      summary: 'Get public meta',
    },
    getVersionInfo: {
      method: 'GET',
      path: '/v2/meta/version',
      responses: { 200: VersionInfo },
      summary: 'Get version info',
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const metaContract = createMetaContract(c);

export type MetaResponse = z.infer<typeof MetaResponse>;
