import { z } from 'zod';
import { AnalyticsType } from '../entities/analytics.entity';

export const QueryAnalyticsSchema = z.object({
  type: z.enum([AnalyticsType.PAGEVIEW, AnalyticsType.EVENT, AnalyticsType.API_CALL]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  path: z.string().optional(),
});

export type QueryAnalyticsDto = z.infer<typeof QueryAnalyticsSchema>;

export type QueryAnalyticsType = z.infer<typeof QueryAnalyticsSchema>;
