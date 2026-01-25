import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createSitemapContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    generate: {
      method: 'POST',
      path: '/v2/sitemap/generate',
      body: z.object({}).optional(),
      responses: { 200: z.object({ message: z.string() }) },
    },
    status: {
      method: 'GET',
      path: '/v2/sitemap/status',
      responses: { 200: z.object({ enabled: z.boolean(), sitemapUrl: z.string() }) },
    },
    urls: {
      method: 'GET',
      path: '/v2/sitemap/urls',
      responses: { 200: z.object({ urls: z.array(z.string()) }) },
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const sitemapContract = createSitemapContract(c);
