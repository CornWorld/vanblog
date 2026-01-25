import { describe, it, expect } from 'vitest';
import {
  ArticleQuerySchema,
  ArticleSearchSchema,
  ArticleSearchResultSchema,
  ArticleSearchResponseSchema,
} from './article.dto';

describe('Article DTOs', () => {
  // Skip testing auto-generated Drizzle schemas (ArticleSchema, CreateArticleSchema, UpdateArticleSchema, ArticleListResponseSchema)
  // Those are tested via integration tests and are auto-generated from Drizzle tables

  describe('ArticleQuerySchema', () => {
    it('should validate query with all fields', () => {
      const validQuery = {
        page: 1,
        pageSize: 10,
        keyword: 'test',
        tag: 'tech',
        category: 'programming',
        isPublished: true,
        isTop: false,
        includeHidden: false,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      const result = ArticleQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validQuery);
      }
    });

    it('should use default values for sortBy and sortOrder', () => {
      const minimalQuery = {
        page: 1,
        pageSize: 10,
      };

      const result = ArticleQuerySchema.safeParse(minimalQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.sortOrder).toBe('desc');
        expect(result.data.includeHidden).toBe(false);
      }
    });

    it('should validate all sortBy enum values', () => {
      const sortByValues = ['createdAt', 'updatedAt', 'publishedAt', 'viewCount', 'likeCount'];

      sortByValues.forEach((sortBy) => {
        const query = { page: 1, pageSize: 10, sortBy };
        const result = ArticleQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid sortBy values', () => {
      const query = {
        page: 1,
        pageSize: 10,
        sortBy: 'invalid',
      };

      const result = ArticleQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    it('should validate sortOrder enum values', () => {
      const ascQuery = { page: 1, pageSize: 10, sortOrder: 'asc' as const };
      const descQuery = { page: 1, pageSize: 10, sortOrder: 'desc' as const };

      expect(ArticleQuerySchema.safeParse(ascQuery).success).toBe(true);
      expect(ArticleQuerySchema.safeParse(descQuery).success).toBe(true);
    });

    it('should reject invalid sortOrder values', () => {
      const query = {
        page: 1,
        pageSize: 10,
        sortOrder: 'invalid',
      };

      const result = ArticleQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  describe('ArticleSearchSchema', () => {
    it('should validate search with all fields', () => {
      const validSearch = {
        keyword: 'test search',
        page: 1,
        pageSize: 20,
        query: 'advanced query',
        titleOnly: true,
        contentOnly: false,
        category: 'tech',
        tags: ['javascript', 'typescript'],
        includeHidden: false,
        includePrivate: false,
        sortBy: 'relevance',
        sortOrder: 'desc',
      };

      const result = ArticleSearchSchema.safeParse(validSearch);
      expect(result.success).toBe(true);
    });

    it('should require keyword field', () => {
      const missingKeyword = {
        page: 1,
        pageSize: 10,
      };

      const result = ArticleSearchSchema.safeParse(missingKeyword);
      expect(result.success).toBe(false);
    });

    it('should reject empty keyword', () => {
      const emptyKeyword = {
        keyword: '',
        page: 1,
        pageSize: 10,
      };

      const result = ArticleSearchSchema.safeParse(emptyKeyword);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('不能为空');
      }
    });

    it('should validate minimal search data', () => {
      const minimalSearch = {
        keyword: 'test',
        page: 1,
        pageSize: 10,
      };

      const result = ArticleSearchSchema.safeParse(minimalSearch);
      expect(result.success).toBe(true);
    });

    it('should validate tags array', () => {
      const searchWithTags = {
        keyword: 'test',
        page: 1,
        pageSize: 10,
        tags: ['tag1', 'tag2', 'tag3'],
      };

      const result = ArticleSearchSchema.safeParse(searchWithTags);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toHaveLength(3);
      }
    });
  });

  describe('ArticleSearchResultSchema', () => {
    it('should validate complete search result', () => {
      const validResult = {
        id: 1,
        title: 'Article Title',
        summary: 'Article summary',
        cover: 'https://example.com/cover.jpg',
        tags: ['tag1', 'tag2'],
        categories: ['category1'],
        publishedAt: '2024-01-01T00:00:00.000Z',
        highlight: {
          title: '<em>highlighted</em> title',
          content: 'Content with <em>highlight</em>',
        },
      };

      const result = ArticleSearchResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should validate minimal search result', () => {
      const minimalResult = {
        id: 1,
        title: 'Title',
        tags: [],
        categories: [],
      };

      const result = ArticleSearchResultSchema.safeParse(minimalResult);
      expect(result.success).toBe(true);
    });

    it('should allow optional fields to be undefined', () => {
      const resultWithOptionals = {
        id: 1,
        title: 'Title',
        tags: [],
        categories: [],
        summary: undefined,
        cover: undefined,
        publishedAt: undefined,
        highlight: undefined,
      };

      const result = ArticleSearchResultSchema.safeParse(resultWithOptionals);
      expect(result.success).toBe(true);
    });

    it('should validate highlight structure', () => {
      const resultWithHighlight = {
        id: 1,
        title: 'Title',
        tags: [],
        categories: [],
        highlight: {
          title: 'highlighted title',
          content: 'highlighted content',
        },
      };

      const result = ArticleSearchResultSchema.safeParse(resultWithHighlight);
      expect(result.success).toBe(true);
    });
  });

  describe('ArticleSearchResponseSchema', () => {
    it('should validate complete search response', () => {
      const validResponse = {
        items: [
          {
            id: 1,
            title: 'Result 1',
            tags: ['tag1'],
            categories: ['cat1'],
          },
          {
            id: 2,
            title: 'Result 2',
            tags: ['tag2'],
            categories: ['cat2'],
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };

      const result = ArticleSearchResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate empty search response', () => {
      const emptyResponse = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };

      const result = ArticleSearchResponseSchema.safeParse(emptyResponse);
      expect(result.success).toBe(true);
    });

    it('should calculate correct pagination', () => {
      const response = {
        items: [],
        total: 45,
        page: 2,
        pageSize: 10,
        totalPages: 5,
      };

      const result = ArticleSearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalPages).toBe(5);
      }
    });
  });
});
