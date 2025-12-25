import { describe, it, expect } from 'vitest';

import { AnalyticsType } from '../entities/analytics.entity';

import { QueryAnalyticsSchema } from './query-analytics.dto';

describe('QueryAnalyticsSchema', () => {
  it('should pass with all valid fields', () => {
    const input = {
      type: AnalyticsType.PAGEVIEW,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      path: '/article/1',
    };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  it('should pass with only type field', () => {
    const input = { type: AnalyticsType.EVENT };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should pass with type and startDate', () => {
    const input = {
      type: AnalyticsType.API_CALL,
      startDate: '2024-01-01',
    };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should pass with type and endDate', () => {
    const input = {
      type: AnalyticsType.PAGEVIEW,
      endDate: '2024-12-31',
    };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should pass with type and path', () => {
    const input = {
      type: AnalyticsType.PAGEVIEW,
      path: '/about',
    };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should pass with empty object (all fields optional)', () => {
    const input = {};
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should pass with only startDate and endDate', () => {
    const input = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should pass with only path', () => {
    const input = { path: '/home' };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should fail with invalid type', () => {
    const input = { type: 'invalid_type' };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should fail with non-string startDate', () => {
    const input = { startDate: 12345 };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should fail with non-string endDate', () => {
    const input = { endDate: true };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should fail with non-string path', () => {
    const input = { path: 123 };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept all valid AnalyticsType enum values', () => {
    const validTypes = [AnalyticsType.PAGEVIEW, AnalyticsType.EVENT, AnalyticsType.API_CALL];

    validTypes.forEach((type) => {
      const result = QueryAnalyticsSchema.safeParse({ type });
      expect(result.success).toBe(true);
    });
  });

  it('should strip unknown fields', () => {
    const input = {
      type: AnalyticsType.PAGEVIEW,
      unknownField: 'should be stripped',
      anotherUnknown: 123,
    };
    const result = QueryAnalyticsSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ type: AnalyticsType.PAGEVIEW });
      expect(result.data).not.toHaveProperty('unknownField');
      expect(result.data).not.toHaveProperty('anotherUnknown');
    }
  });
});
