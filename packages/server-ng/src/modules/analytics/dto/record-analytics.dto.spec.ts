import { describe, it, expect } from 'vitest';

import { RecordAnalyticsSchema } from './record-analytics.dto';

describe('RecordAnalyticsSchema (Zod)', () => {
  // 正例：pageview 含 articleId
  it('should pass when type=pageview and data.articleId is number', () => {
    const input = {
      type: 'pageview',
      path: '/blog/123',
      referrer: null,
      userAgent: 'UA',
      ip: '127.0.0.1',
      data: { articleId: 123 },
    };
    const result = RecordAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  // 反例：pageview 缺少 articleId
  it('should fail when type=pageview and data.articleId is missing', () => {
    const input = {
      type: 'pageview',
      path: '/blog/123',
      data: {},
    };
    const result = RecordAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      // 校验错误路径应包含 data.articleId
      const hasArticleIdIssue = result.error.issues.some(
        (i) => i.path.join('.') === 'data.articleId',
      );
      expect(hasArticleIdIssue).toBe(true);
    }
  });

  // 反例：pageview articleId 类型错误
  it('should fail when type=pageview and data.articleId is not number', () => {
    const input = {
      type: 'pageview',
      path: '/blog/123',
      data: { articleId: '123' },
    } as any;
    const result = RecordAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // 正例：event=reading_time 含 duration
  it("should pass when type=event and data.event='reading_time' with duration:number", () => {
    const input = {
      type: 'event',
      path: '/blog/123',
      data: { event: 'reading_time', duration: 30, articleId: 123 },
    };
    const result = RecordAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  // 反例：event=reading_time 缺少 duration
  it("should fail when type=event and data.event='reading_time' without duration", () => {
    const input = {
      type: 'event',
      path: '/blog/123',
      data: { event: 'reading_time', articleId: 123 },
    };
    const result = RecordAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const hasDurationIssue = result.error.issues.some(
        (i) => i.path.join('.') === 'data.duration',
      );
      expect(hasDurationIssue).toBe(true);
    }
  });

  // 正例：其他 event 不需要 duration
  it("should pass when type=event and data.event!='reading_time' without duration", () => {
    const input = {
      type: 'event',
      path: '/blog/123',
      data: { event: 'click', label: 'btn' },
    };
    const result = RecordAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
