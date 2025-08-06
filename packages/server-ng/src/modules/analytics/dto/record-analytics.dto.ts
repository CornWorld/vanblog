import { createZodDto } from 'nestjs-zod';

import { insertAnalyticsSchema } from '../../../database';

import type { z } from 'zod';

// 记录分析 Schema - 使用 drizzle-zod 生成的 schema
export const RecordAnalyticsSchema = insertAnalyticsSchema.omit({
  id: true,
  createdAt: true,
});

export class RecordAnalyticsDto extends createZodDto(RecordAnalyticsSchema) {}

export type RecordAnalyticsType = z.infer<typeof RecordAnalyticsSchema>;
