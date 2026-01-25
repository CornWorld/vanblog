import { describe, it, expect } from 'vitest';
import { CreateTagSchema, UpdateTagSchema, TagListResponseSchema } from './tag.dto';

describe('Tag DTOs', () => {
  describe('CreateTagSchema', () => {
    it('should validate create request with required fields', () => {
      const createRequest = {
        name: 'TypeScript',
        slug: 'typescript',
      };

      const result = CreateTagSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('TypeScript');
        expect(result.data.slug).toBe('typescript');
      }
    });

    it('should reject missing name', () => {
      const createRequest = {
        slug: 'typescript',
      };

      const result = CreateTagSchema.safeParse(createRequest);
      expect(result.success).toBe(false);
    });

    it('should allow missing slug', () => {
      const createRequest = {
        name: 'JavaScript',
      };

      const result = CreateTagSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in name', () => {
      const createRequest = {
        name: 'Vue.js & React - 前端框架',
        slug: 'vue-react-frontend',
      };

      const result = CreateTagSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toContain('Vue.js');
      }
    });

    it('should handle unicode characters', () => {
      const createRequest = {
        name: '🚀 性能优化 Performance',
        slug: 'performance-optimization',
      };

      const result = CreateTagSchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should strip id field', () => {
      const createRequest = {
        id: 999,
        name: 'Python',
        slug: 'python',
      } as any;

      const result = CreateTagSchema.safeParse(createRequest);
      if (result.success) {
        expect(result.data).not.toHaveProperty('id');
      }
    });

    it('should strip createdAt field', () => {
      const createRequest = {
        name: 'Go',
        slug: 'go',
        createdAt: new Date(),
      } as any;

      const result = CreateTagSchema.safeParse(createRequest);
      if (result.success) {
        expect(result.data).not.toHaveProperty('createdAt');
      }
    });
  });

  describe('UpdateTagSchema', () => {
    it('should allow updating name', () => {
      const updateRequest = {
        name: 'Updated Tag',
      };

      const result = UpdateTagSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating slug', () => {
      const updateRequest = {
        slug: 'updated-slug',
      };

      const result = UpdateTagSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const updateRequest = {};

      const result = UpdateTagSchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should strip id from update', () => {
      const updateRequest = {
        id: 999,
        name: 'Updated',
      } as any;

      const result = UpdateTagSchema.safeParse(updateRequest);
      if (result.success) {
        expect(result.data).not.toHaveProperty('id');
      }
    });
  });

  describe('TagListResponseSchema', () => {
    it('should validate empty list', () => {
      const response = {
        items: [],
        total: 0,
      };

      const result = TagListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should reject missing items', () => {
      const response = {
        total: 10,
      };

      const result = TagListResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should reject missing total', () => {
      const response = {
        items: [],
      };

      const result = TagListResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle various slug formats', () => {
      const slugTests = ['simple', 'with-dashes', 'with_underscores', 'MixedCase'];

      slugTests.forEach((slug) => {
        const result = CreateTagSchema.safeParse({
          name: 'Test Tag',
          slug,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should handle reasonably long tag names', () => {
      const createRequest = {
        name: 'A'.repeat(100),
        slug: 'long-tag-name',
      };

      const result = CreateTagSchema.safeParse(createRequest);
      if (result.success) {
        expect(result.data.name).toHaveLength(100);
      }
    });
  });
});
