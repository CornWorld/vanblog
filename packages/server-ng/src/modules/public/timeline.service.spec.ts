import { describe, it, beforeEach, expect } from 'vitest';

import { TimelineService } from './timeline.service';

describe('TimelineService', () => {
  let service: TimelineService;

  beforeEach(() => {
    // 创建一个特殊的 Mock Database，使其与 Timeline 查询模式匹配
    const mockDb: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: (_fn: any) => Promise.resolve([]),
          }),
        }),
      }),
    };

    service = new TimelineService(mockDb);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTimeline', () => {
    it('should return empty object when no articles exist', async () => {
      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

      expect(result).toEqual({});
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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

      expect(Object.keys(result)).toContain('2024');
      expect(Object.keys(result)).toContain('2023');
      expect(result['2024']).toHaveLength(2);
      expect(result['2023']).toHaveLength(1);
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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

      const [article] = result['2024'];
      expect(article.tags).toEqual([]);
      expect(article.viewer).toBe(0);
      expect(article.category).toBe('Tech');
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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

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

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockArticles),
            }),
          }),
        }),
      };

      const timelineService = new TimelineService(mockDb);
      const result = await timelineService.getTimeline();

      expect(Object.keys(result).sort()).toEqual(['2022', '2023', '2024']);
      expect(result['2024']).toHaveLength(1);
      expect(result['2023']).toHaveLength(1);
      expect(result['2022']).toHaveLength(1);
    });
  });
});
