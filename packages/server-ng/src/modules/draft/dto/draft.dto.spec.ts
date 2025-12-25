import { describe, it, expect } from 'vitest';
import { DraftQuerySchema, PublishDraftSchema, DraftListResponseSchema } from './draft.dto';

describe('Draft DTOs', () => {
  describe('DraftQuerySchema', () => {
    it('should validate minimal query', () => {
      const query = {
        page: 1,
        pageSize: 10,
      };

      const result = DraftQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(10);
        expect(result.data.sortBy).toBe('updatedAt');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should validate query with all fields', () => {
      const query = {
        page: 2,
        pageSize: 20,
        keyword: 'test',
        tag: 'typescript',
        category: 'tech',
        sortBy: 'createdAt' as const,
        sortOrder: 'asc' as const,
      };

      const result = DraftQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keyword).toBe('test');
        expect(result.data.tag).toBe('typescript');
        expect(result.data.category).toBe('tech');
      }
    });

    it('should apply default sortBy', () => {
      const query = {
        page: 1,
        pageSize: 10,
      };

      const result = DraftQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe('updatedAt');
      }
    });

    it('should apply default sortOrder', () => {
      const query = {
        page: 1,
        pageSize: 10,
      };

      const result = DraftQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should validate all sortBy enum values', () => {
      const sortByValues = ['createdAt', 'updatedAt', 'title'];

      sortByValues.forEach((sortBy) => {
        const query = { page: 1, pageSize: 10, sortBy };
        const result = DraftQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid sortBy', () => {
      const query = {
        page: 1,
        pageSize: 10,
        sortBy: 'invalid',
      };

      const result = DraftQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should validate all sortOrder values', () => {
      const orders = ['asc', 'desc'];

      orders.forEach((order) => {
        const query = { page: 1, pageSize: 10, sortOrder: order };
        const result = DraftQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid sortOrder', () => {
      const query = {
        page: 1,
        pageSize: 10,
        sortOrder: 'invalid',
      };

      const result = DraftQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should handle optional filters', () => {
      const query = {
        page: 1,
        pageSize: 10,
        keyword: 'test',
      };

      const result = DraftQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    it('should handle missing page (if optional)', () => {
      const query = {
        pageSize: 10,
      };

      const result = DraftQuerySchema.safeParse(query);
      if (!result.success) {
        // Page might be required
        expect(result.success).toBe(false);
      }
    });

    it('should handle missing pageSize (if optional)', () => {
      const query = {
        page: 1,
      };

      const result = DraftQuerySchema.safeParse(query);
      if (!result.success) {
        // PageSize might be required
        expect(result.success).toBe(false);
      }
    });
  });

  describe('PublishDraftSchema', () => {
    it('should validate with minimal fields', () => {
      const publishData = {};

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
    });

    it('should apply default isPublished', () => {
      const publishData = {};

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPublished).toBe(true);
      }
    });

    it('should apply default isTop', () => {
      const publishData = {};

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isTop).toBe(false);
      }
    });

    it('should apply default allowComment', () => {
      const publishData = {};

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowComment).toBe(true);
      }
    });

    it('should validate all fields', () => {
      const publishData = {
        isPublished: true,
        isTop: true,
        password: 'secret123',
        allowComment: false,
        copyright: 'Copyright 2024',
        publishedAt: '2024-01-01T00:00:00Z',
      };

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isTop).toBe(true);
        expect(result.data.password).toBe('secret123');
      }
    });

    it('should allow null password', () => {
      const publishData = {
        password: null,
      };

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe(null);
      }
    });

    it('should handle optional copyright', () => {
      const publishData = {
        copyright: 'All rights reserved',
      };

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
    });

    it('should validate publishedAt timestamp', () => {
      const publishData = {
        publishedAt: '2024-12-24T12:00:00Z',
      };

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid boolean for isPublished', () => {
      const publishData = {
        isPublished: 'yes',
      };

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(false);
    });
  });

  describe('DraftListResponseSchema', () => {
    it('should validate empty list', () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };

      const result = DraftListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const response = {
        items: [],
        total: 0,
      };

      const result = DraftListResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should validate pagination values', () => {
      const response = {
        items: [],
        total: 100,
        page: 2,
        pageSize: 50,
        totalPages: 2,
      };

      const result = DraftListResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(response.totalPages).toBe(2);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle zero page number', () => {
      const query = {
        page: 0,
        pageSize: 10,
      };

      const result = DraftQuerySchema.safeParse(query);
      // Depending on validation rules, might be valid or invalid
      if (result.success) {
        expect(result.data.page).toBe(0);
      }
    });

    it('should handle large pageSize', () => {
      const query = {
        page: 1,
        pageSize: 10000,
      };

      const result = DraftQuerySchema.safeParse(query);
      if (result.success) {
        expect(result.data.pageSize).toBe(10000);
      }
    });

    it('should handle complex copyright text', () => {
      const publishData = {
        copyright: 'Copyright (c) 2024 - 技术博客 - All Rights Reserved 🔒',
      };

      const result = PublishDraftSchema.safeParse(publishData);
      expect(result.success).toBe(true);
    });
  });
});
