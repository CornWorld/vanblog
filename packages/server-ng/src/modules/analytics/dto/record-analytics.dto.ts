import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { AnalyticsType } from '../entities/analytics.entity';

export const RecordAnalyticsSchema = z.object({
  type: z.enum([AnalyticsType.PAGEVIEW, AnalyticsType.EVENT, AnalyticsType.API_CALL]),
  path: z.string(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  referer: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export class RecordAnalyticsDto extends createZodDto(RecordAnalyticsSchema) {}

export type RecordAnalyticsType = z.infer<typeof RecordAnalyticsSchema>;
