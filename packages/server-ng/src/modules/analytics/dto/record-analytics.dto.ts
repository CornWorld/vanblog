import { insertAnalyticsSchema } from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 为了在控制器层进行更严格的数据校验，这里基于数据库层的 insertAnalyticsSchema
// 做进一步约束：
// - type = 'pageview' 时，data 必须是对象且包含 number 类型的 articleId
// - type = 'event' 且 data.event = 'reading_time' 时，必须包含 number 类型的 duration
// 注意：覆盖原始 schema 的 data 字段，避免在 DTO 层将其转换为字符串，保持原始对象，
// 由 service 负责 JSON.stringify 持久化。
const BaseRecordSchema = insertAnalyticsSchema.omit({ id: true, createdAt: true });

const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null && !Array.isArray(val);

const getField = (obj: Record<string, unknown>, key: string): unknown => obj[key];

export const RecordAnalyticsSchema = BaseRecordSchema.extend({
  // 覆盖原始 data 定义，保持原始值且不做字符串转换
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
