import { describe, it, expect } from 'vitest';
import { BatchDeleteSchema } from './batch-delete.dto';

describe('BatchDeleteDto', () => {
  describe('BatchDeleteSchema validation', () => {
    it('should accept valid array of IDs', () => {
      const validData = {
        ids: [1, 2, 3, 4, 5],
      };

      const result = BatchDeleteSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ids).toEqual([1, 2, 3, 4, 5]);
      }
    });

    it('should accept single ID', () => {
      const validData = {
        ids: [42],
      };

      const result = BatchDeleteSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ids).toHaveLength(1);
        expect(result.data.ids[0]).toBe(42);
      }
    });

    it('should accept maximum 100 IDs', () => {
      const validData = {
        ids: Array.from({ length: 100 }, (_, i) => i + 1),
      };

      const result = BatchDeleteSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ids).toHaveLength(100);
      }
    });

    it('should accept IDs in any order', () => {
      const validData = {
        ids: [5, 2, 8, 1, 3],
      };

      const result = BatchDeleteSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ids).toEqual([5, 2, 8, 1, 3]);
      }
    });

    it('should accept duplicate IDs', () => {
      const validData = {
        ids: [1, 2, 2, 3, 3, 3],
      };

      const result = BatchDeleteSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ids).toEqual([1, 2, 2, 3, 3, 3]);
      }
    });

    it('should reject empty array', () => {
      const invalidData = {
        ids: [],
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('至少需要选择一个文件');
      }
    });

    it('should reject more than 100 IDs', () => {
      const invalidData = {
        ids: Array.from({ length: 101 }, (_, i) => i + 1),
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('一次最多只能删除100个文件');
      }
    });

    it('should reject missing ids field', () => {
      const invalidData = {};

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-array ids', () => {
      const invalidData = {
        ids: 'not-an-array',
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject null ids', () => {
      const invalidData = {
        ids: null,
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should handle large valid arrays', () => {
      const validData = {
        ids: Array.from({ length: 50 }, (_, i) => i + 100),
      };

      const result = BatchDeleteSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ids).toHaveLength(50);
        expect(result.data.ids[0]).toBe(100);
        expect(result.data.ids[49]).toBe(149);
      }
    });

    it('should accept large ID numbers', () => {
      const validData = {
        ids: [999999, 1000000, 1000001],
      };

      const result = BatchDeleteSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject array with non-numeric values', () => {
      const invalidData = {
        ids: [1, 2, 'three', 4],
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject array with zero values', () => {
      const invalidData = {
        ids: [1, 2, 0, 4],
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject array with negative values', () => {
      const invalidData = {
        ids: [1, 2, -3, 4],
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject array with decimal values', () => {
      const invalidData = {
        ids: [1, 2, 3.5, 4],
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject undefined ids', () => {
      const invalidData = {
        ids: undefined,
      };

      const result = BatchDeleteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
