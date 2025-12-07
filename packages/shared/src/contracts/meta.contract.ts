import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { dateStr } from '../date-codecs.js';
import { VersionInfoSchema } from '../schemas.js';

export const metaResponse = z.object({ buildTime: dateStr });

export const createMetaContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getPublicMeta: {
      method: 'GET',
      path: '/public/meta',
      responses: { 200: metaResponse },
      summary: 'Get public meta',
    },
    getVersionInfo: {
      method: 'GET',
      path: '/v2/meta/version',
      responses: { 200: VersionInfoSchema },
      summary: 'Get version info',
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const metaContract = createMetaContract(c);

export type MetaResponse = z.infer<typeof metaResponse>;
