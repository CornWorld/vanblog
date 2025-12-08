import { insertAnalyticsSchema } from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 基于 drizzle schema 扩展的 API 请求验证 schema
// ts-rest contract 使用此 schema 进行运行时验证
const BaseRecordSchema = insertAnalyticsSchema.omit({ id: true, createdAt: true });

const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null && !Array.isArray(val);

const getField = (obj: Record<string, unknown>, key: string): unknown => obj[key];

export const RecordAnalyticsSchema = BaseRecordSchema.extend({
  data: z.unknown().optional(),
}).superRefine((val, ctx) => {
  const { type, data } = val as { type: string; data?: unknown };

  // pageview 必须带 articleId
  if (type === 'pageview') {
    if (!isPlainObject(data) || typeof getField(data, 'articleId') !== 'number') {
      ctx.addIssue({
        code: 'custom',
        message: 'pageview 必须包含 data.articleId:number',
        path: ['data', 'articleId'],
      });
    }
  }

  // reading_time 事件必须带 duration
  if (type === 'event') {
    if (isPlainObject(data) && getField(data, 'event') === 'reading_time') {
      if (typeof getField(data, 'duration') !== 'number') {
        ctx.addIssue({
          code: 'custom',
          message: 'reading_time 事件必须包含 data.duration:number',
          path: ['data', 'duration'],
        });
      }
    }
  }
});

export type RecordAnalyticsDto = z.infer<typeof RecordAnalyticsSchema>;
export type RecordAnalyticsType = z.infer<typeof RecordAnalyticsSchema>;
