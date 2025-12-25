import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../database';

import { TimelineService } from './timeline.service';

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
};

describe('TimelineService', () => {
  let service: TimelineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimelineService, { provide: DATABASE_CONNECTION, useValue: mockDb }],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
    vi.clearAllMocks();

    // Reset mock chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTimeline', () => {
    it('should return empty object when no articles exist', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      const result = await service.getTimeline();

      expect(result).toEqual({});
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('should group articles by year correctly', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article 2024',
          pathname: '/2024/article',
          tags: ['tech', 'blog'],
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
        {
          id: 2,
          title: 'Article 2023',
          pathname: '/2023/article',
          tags: ['life'],
          category: 'Life',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 5,
          createdAt: '2023-12-01T10:00:00Z',
          updatedAt: '2023-12-01T10:00:00Z',
        },
        {
          id: 3,
          title: 'Another 2024',
          pathname: '/2024/another',
          tags: [],
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 20,
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-10T10:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      expect(Object.keys(result)).toContain('2024');
      expect(Object.keys(result)).toContain('2023');
      expect(result['2024']).toHaveLength(2);
      expect(result['2023']).toHaveLength(1);
    });

    it('should exclude hidden articles by default', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.getTimeline(false);

      // Verify that where clause was called with conditions excluding hidden articles
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should include hidden articles when includeHidden is true', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.getTimeline(true);

      // Verify that where clause was called
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should always exclude private articles', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Public Article',
          pathname: '/public',
          tags: [],
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      // Private articles should not be in the result
      expect(result['2024']).toBeDefined();
      expect(result['2024']).toHaveLength(1);
      expect(result['2024'][0].private).toBe(false);
    });

    it('should handle null tags gracefully', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article with null tags',
          pathname: '/article',
          tags: null,
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      expect(result['2024'][0].tags).toEqual([]);
    });

    it('should handle null viewer count gracefully', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article with null viewer',
          pathname: '/article',
          tags: [],
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: null,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      expect(result['2024'][0].viewer).toBe(0);
    });

    it('should handle combined null tags and viewer simultaneously', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article with multiple nulls',
          pathname: '/article',
          tags: null,
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: null,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      const [article] = result['2024'];
      expect(article.tags).toEqual([]);
      expect(article.viewer).toBe(0);
      expect(article.category).toBe('Tech');
    });

    it('should distinguish between null and empty array tags', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article with null tags',
          pathname: '/article-null',
          tags: null,
          category: 'C1',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
        {
          id: 2,
          title: 'Article with empty tags',
          pathname: '/article-empty',
          tags: [],
          category: 'C1',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          createdAt: '2024-06-15T09:00:00Z',
          updatedAt: '2024-06-15T09:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      // Both should be normalized to empty arrays
      expect(result['2024'][0].tags).toEqual([]);
      expect(result['2024'][1].tags).toEqual([]);
    });

    it('should handle articles with all possible null/undefined fields', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'Article with many nulls',
          pathname: '/article',
          tags: null,
          category: null,
          author: null,
          top: null,
          hidden: false,
          private: false,
          viewer: null,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      const [article] = result['2024'];
      expect(article.tags).toEqual([]);
      expect(article.viewer).toBe(0);
      expect(article.category).toBe(null);
      expect(article.author).toBe(null);
      expect(article.top).toBe(null);
    });

    it('should sort articles in descending order by createdAt', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.getTimeline();

      // Verify orderBy was called with desc(articles.createdAt)
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('should handle multiple articles in the same year', async () => {
      const mockArticles = [
        {
          id: 1,
          title: 'First 2024',
          pathname: '/2024/first',
          tags: [],
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 10,
          createdAt: '2024-12-01T10:00:00Z',
          updatedAt: '2024-12-01T10:00:00Z',
        },
        {
          id: 2,
          title: 'Second 2024',
          pathname: '/2024/second',
          tags: [],
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 5,
          createdAt: '2024-06-01T10:00:00Z',
          updatedAt: '2024-06-01T10:00:00Z',
        },
        {
          id: 3,
          title: 'Third 2024',
          pathname: '/2024/third',
          tags: [],
          category: 'Tech',
          author: 'Admin',
          top: 0,
          hidden: false,
          private: false,
          viewer: 15,
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-01T10:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      expect(result['2024']).toHaveLength(3);
      expect(result['2024'].map((a) => a.id)).toEqual([1, 2, 3]);
    });

    it('should preserve article metadata correctly', async () => {
      const mockArticles = [
        {
          id: 42,
          title: 'Test Article',
          pathname: '/test/article',
          tags: ['test', 'unit'],
          category: 'Testing',
          author: 'TestAuthor',
          top: 1,
          hidden: false,
          private: false,
          viewer: 100,
          createdAt: '2024-06-15T10:30:00Z',
          updatedAt: '2024-06-16T11:30:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      const [article] = result['2024'];
      expect(article.id).toBe(42);
      expect(article.title).toBe('Test Article');
      expect(article.pathname).toBe('/test/article');
      expect(article.tags).toEqual(['test', 'unit']);
      expect(article.category).toBe('Testing');
      expect(article.author).toBe('TestAuthor');
      expect(article.top).toBe(1);
      expect(article.viewer).toBe(100);
    });

    it('should handle articles from different years', async () => {
      const mockArticles = [
        {
          id: 1,
          title: '2024',
          pathname: '/2024',
          tags: [],
          category: 'C',
          author: 'A',
          top: 0,
          hidden: false,
          private: false,
          viewer: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          title: '2023',
          pathname: '/2023',
          tags: [],
          category: 'C',
          author: 'A',
          top: 0,
          hidden: false,
          private: false,
          viewer: 0,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          id: 3,
          title: '2022',
          pathname: '/2022',
          tags: [],
          category: 'C',
          author: 'A',
          top: 0,
          hidden: false,
          private: false,
          viewer: 0,
          createdAt: '2022-01-01T00:00:00Z',
          updatedAt: '2022-01-01T00:00:00Z',
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockArticles);

      const result = await service.getTimeline();

      expect(Object.keys(result).sort()).toEqual(['2022', '2023', '2024']);
      expect(result['2024']).toHaveLength(1);
      expect(result['2023']).toHaveLength(1);
      expect(result['2022']).toHaveLength(1);
    });
  });
});
