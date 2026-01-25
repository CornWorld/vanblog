import { describe, it, expect } from 'vitest';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryListResponseSchema,
} from './category.dto';

describe('Category DTOs', () => {
  describe('CreateCategorySchema', () => {
    it('should validate create request with required fields', () => {
      const createRequest = {
        name: 'Technology',
        slug: 'technology',
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Technology');
        expect(result.data.slug).toBe('technology');
      }
    });

    it('should validate create request with description', () => {
      const createRequest = {
        name: 'Technology',
        slug: 'technology',
        description: 'All tech articles',
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('All tech articles');
      }
    });

    it('should accept private flag', () => {
      const createRequest = {
        name: 'Private Category',
        slug: 'private',
        private: true,
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should accept password for private categories', () => {
      const createRequest = {
        name: 'Private Category',
        slug: 'private',
        private: true,
        password: 'secret123',
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should reject missing name', () => {
      const createRequest = {
        slug: 'technology',
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(false);
    });

    it('should allow missing slug (optional field)', () => {
      const createRequest = {
        name: 'Technology',
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      // slug is optional in the schema
      expect(result.success).toBe(true);
    });

    it('should handle special characters in name', () => {
      const createRequest = {
        name: 'Tech & Science (2024) - 技术',
        slug: 'tech-science-2024',
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toContain('Tech');
        expect(result.data.name).toContain('技术');
      }
    });

    it('should handle null description', () => {
      const createRequest = {
        name: 'Tech',
        slug: 'tech',
        description: null,
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should handle very long description', () => {
      const longDesc = 'A'.repeat(1000);
      const createRequest = {
        name: 'Tech',
        slug: 'tech',
        description: longDesc,
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toHaveLength(1000);
      }
    });

    it('should strip id field from request', () => {
      const createRequest = {
        id: 999,
        name: 'Technology',
        slug: 'technology',
      } as any;

      const result = CreateCategorySchema.safeParse(createRequest);
      if (result.success) {
        expect(result.data).not.toHaveProperty('id');
      }
    });

    it('should not include timestamps in response', () => {
      const createRequest = {
        name: 'Tech',
        slug: 'tech',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = CreateCategorySchema.safeParse(createRequest);
      if (result.success) {
        expect(result.data).not.toHaveProperty('createdAt');
        expect(result.data).not.toHaveProperty('updatedAt');
      }
    });
  });

  describe('UpdateCategorySchema', () => {
    it('should allow updating name alone', () => {
      const updateRequest = {
        name: 'Updated Technology',
      };

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating slug alone', () => {
      const updateRequest = {
        slug: 'updated-tech',
      };

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating description alone', () => {
      const updateRequest = {
        description: 'Updated description',
      };

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow updating multiple fields', () => {
      const updateRequest = {
        name: 'Updated',
        slug: 'updated',
        description: 'New desc',
        private: true,
        password: 'newpass',
      };

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow empty update', () => {
      const updateRequest = {};

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow null description in update', () => {
      const updateRequest = {
        description: null,
      };

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should allow private flag update', () => {
      const updateRequest = {
        private: true,
      };

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });

    it('should strip id from update', () => {
      const updateRequest = {
        id: 999,
        name: 'Updated',
      } as any;

      const result = UpdateCategorySchema.safeParse(updateRequest);
      if (result.success) {
        expect(result.data).not.toHaveProperty('id');
      }
    });

    it('should strip timestamps from update', () => {
      const updateRequest = {
        name: 'Updated',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const result = UpdateCategorySchema.safeParse(updateRequest);
      if (result.success) {
        expect(result.data).not.toHaveProperty('createdAt');
        expect(result.data).not.toHaveProperty('updatedAt');
      }
    });
  });

  describe('CategoryListResponseSchema', () => {
    it('should validate empty list', () => {
      const response = {
        items: [],
        total: 0,
      };

      const result = CategoryListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(0);
        expect(result.data.total).toBe(0);
      }
    });

    it('should reject missing items', () => {
      const response = {
        total: 10,
      };

      const result = CategoryListResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should reject missing total', () => {
      const response = {
        items: [],
      };

      const result = CategoryListResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle unicode in category name', () => {
      const createRequest = {
        name: '日本語 中文 한국어 🚀',
        slug: 'multilang',
      };

      const result = CreateCategorySchema.safeParse(createRequest);
      expect(result.success).toBe(true);
    });

    it('should handle slug with numbers and special chars', () => {
      const slugTests = ['slug-123', 'my_slug', 'UPPERCASE', 'mixed-Case_123'];

      slugTests.forEach((slug) => {
        const result = CreateCategorySchema.safeParse({
          name: 'Test',
          slug,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should handle all fields in update', () => {
      const updateRequest = {
        name: 'Updated',
        slug: 'updated',
        description: 'Desc',
        private: false,
        password: null,
      };

      const result = UpdateCategorySchema.safeParse(updateRequest);
      expect(result.success).toBe(true);
    });
  });
});
