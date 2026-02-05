import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { dateStr } from '../date-codecs.js';
import { TimelineArticleInputSchema } from '../schemas.js';

export const createTimelineContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    getTimeline: {
      method: 'GET',
      path: '/v2/public/timeline',
      query: z
        .object({
          includeHidden: z.enum(['true', 'false']).optional(),
        })
        .optional(),
      responses: {
        200: z.record(z.string(), z.array(TimelineArticleInputSchema.extend({ pubTime: dateStr }))),
      },
      summary: 'Get public timeline grouped by year',
    },
  });

// Legacy export for backward compatibility
const c = initContract();
export const timelineContract = createTimelineContract(c);

export type TimelineContract = typeof timelineContract;
