import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { dateStr } from '../date-codecs.js';

export const RssItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  description: z.string().optional(),
  pubDate: dateStr,
  guid: z.string().optional(),
});

export const createRssContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    generateRss: {
      method: 'POST',
      path: '/rss/generate',
      body: z.object({}),
      responses: {
        201: z.object({ message: z.string() }),
      },
      summary: 'Generate RSS feed',
    },
    getRssStatus: {
      method: 'GET',
      path: '/rss/status',
      responses: {
        200: z.object({
          enabled: z.boolean(),
          lastGenerated: dateStr.optional(),
          feedUrls: z.object({
            xml: z.string(),
            json: z.string(),
            atom: z.string(),
          }),
        }),
      },
      summary: 'Get RSS generation status',
    },
    getRssJson: {
      method: 'GET',
      path: '/v2/rss/json',
      responses: {
        200: z.object({ items: z.array(RssItemSchema) }),
      },
      summary: 'Get RSS feed in JSON (string dates only)',
    },
    getRssXml: {
      method: 'GET',
      path: '/v2/rss/xml',
      responses: {
        200: z.string(),
      },
      summary: 'Get RSS feed in XML',
    },
    getRssAtom: {
      method: 'GET',
      path: '/v2/rss/atom',
      responses: {
        200: z.string(),
      },
      summary: 'Get RSS feed in Atom',
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const rssContract = createRssContract(c);

export type RssContract = typeof rssContract;
