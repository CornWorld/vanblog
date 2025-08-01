import { z } from 'zod';
import { AnalyticsType } from '../entities/analytics.entity';

export const RecordAnalyticsSchema = z.object({
  type: z.enum([AnalyticsType.PAGEVIEW, AnalyticsType.EVENT, AnalyticsType.API_CALL]),
  path: z.string(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  referer: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RecordAnalyticsDto = z.infer<typeof RecordAnalyticsSchema>;

export type RecordAnalyticsType = z.infer<typeof RecordAnalyticsSchema>;
