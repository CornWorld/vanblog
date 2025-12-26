import { categories, tags, articles } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Database } from '../../database';

import { StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let db: Database;

  beforeEach(() => {
    const allCategories = [
      { id: 1, name: 'CatA', slug: 'cata' },
      { id: 2, name: 'CatB', slug: 'catb' },
    ];

    const allTags = [
      { id: 1, name: 'TagA', slug: 'taga' },
      { id: 2, name: 'TagB', slug: 'tagb' },
    ];

    // Queues for category/tag stats (returned sequentially)
    const categoryStatsQueue = [
      {
        articleCount: 3,
        publishedCount: 2,
        privateCount: 1,
        totalViews: 30,
      },
      {
        articleCount: 5,
        publishedCount: 4,
        privateCount: 1,
        totalViews: 80,
      },
    ];

    const tagStatsQueue = [
      { articleCount: 4, totalViews: 40 },
      { articleCount: 6, totalViews: 60 },
    ];

    const overallArticleStatsRow = {
      totalArticles: 10,
      publishedArticles: 6,
      privateArticles: 3,
      hiddenArticles: 1,
      totalViews: 150,
    };

    const select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
      const from = vi.fn().mockImplementation((table: unknown) => {
        // Selecting all categories
        if (table === categories) {
          return allCategories;
        }
        // Selecting all tags
        if (table === tags) {
          return allTags;
        }
        // Article statistics selection branches
        if (table === articles) {
          // Check if this is a call for overall article statistics
          const isOverallStats =
            typeof fields === 'object' &&
            'totalArticles' in fields &&
            'publishedArticles' in fields;
          if (isOverallStats) {
            return [overallArticleStatsRow];
          }

          // Check if this is a call for category statistics
          const isCategoryStats =
            typeof fields === 'object' && 'publishedCount' in fields && 'privateCount' in fields;
          if (isCategoryStats) {
            return {
              where: vi.fn().mockImplementation((_cond: unknown) => [categoryStatsQueue.shift()]),
            } as unknown;
          }

          // Check if this is a call for tag statistics
          const isTagStats =
            typeof fields === 'object' && 'articleCount' in fields && !('publishedCount' in fields);
          if (isTagStats) {
            return {
              where: vi.fn().mockImplementation((_cond: unknown) => [tagStatsQueue.shift()]),
            } as unknown;
          }

          // Check if this is a call for total published word count
          const isWordCount = typeof fields === 'object' && 'total' in fields;
          if (isWordCount) {
            return {
              where: vi.fn().mockResolvedValue([{ total: 1234 }]),
            } as unknown;
          }
          return [];
        }
        return [];
      });
      return { from };
    });

    db = { select } as unknown as Database;
    service = new StatisticsService(db);
  });

  it('should compute overall statistics correctly', async () => {
    const res = await service.getOverallStatistics();

    expect(res.totalCategories).toBe(2);
    expect(res.totalTags).toBe(2);

    expect(res.totalArticles).toBe(10);
    expect(res.publishedArticles).toBe(6);
    expect(res.privateArticles).toBe(3);
    expect(res.hiddenArticles).toBe(1);
    expect(res.totalViews).toBe(150);

    // category details
    expect(res.categories).toHaveLength(2);
    expect(res.categories[0]).toMatchObject({
      id: 1,
      name: 'CatA',
      slug: 'cata',
      articleCount: 3,
      publishedCount: 2,
      privateCount: 1,
      totalViews: 30,
    });
    expect(res.categories[1]).toMatchObject({
      id: 2,
      name: 'CatB',
      slug: 'catb',
      articleCount: 5,
      publishedCount: 4,
      privateCount: 1,
      totalViews: 80,
    });

    // tag details
    expect(res.tags).toHaveLength(2);
    expect(res.tags[0]).toMatchObject({
      id: 1,
      name: 'TagA',
      slug: 'taga',
      articleCount: 4,
      totalViews: 40,
    });
    expect(res.tags[1]).toMatchObject({
      id: 2,
      name: 'TagB',
      slug: 'tagb',
      articleCount: 6,
      totalViews: 60,
    });
  });

  it('should handle categories with null slugs', async () => {
    const allCategoriesWithNullSlug = [{ id: 1, name: 'CatA', slug: null }];

    const categoryStatsQueue = [
      {
        articleCount: 3,
        publishedCount: 2,
        privateCount: 1,
        totalViews: 30,
      },
    ];

    const select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
      const from = vi.fn().mockImplementation((table: unknown) => {
        if (table === categories && (fields == null || Object.keys(fields).length === 0)) {
          return allCategoriesWithNullSlug;
        }
        if (table === articles) {
          if (fields && 'publishedCount' in fields) {
            return {
              where: vi.fn().mockImplementation(() => [categoryStatsQueue.shift()]),
            } as unknown;
          }
          if (fields && 'totalArticles' in fields) {
            return [
              {
                totalArticles: 3,
                publishedArticles: 2,
                privateArticles: 1,
                hiddenArticles: 0,
                totalViews: 30,
              },
            ];
          }
        }
        if (table === tags) {
          return [];
        }
        return [];
      });
      return { from };
    });

    const testDb = { select } as unknown as Database;
    const testService = new StatisticsService(testDb);

    const res = await testService.getOverallStatistics();

    expect(res.categories[0].slug).toBeUndefined();
  });

  it('should handle tags with null slugs', async () => {
    const allTagsWithNullSlug = [{ id: 1, name: 'TagA', slug: null }];

    const tagStatsQueue = [{ articleCount: 4, totalViews: 40 }];

    const select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
      const from = vi.fn().mockImplementation((table: unknown) => {
        if (table === tags && (fields == null || Object.keys(fields).length === 0)) {
          return allTagsWithNullSlug;
        }
        if (table === articles) {
          if (fields && 'articleCount' in fields && !('publishedCount' in fields)) {
            return {
              where: vi.fn().mockImplementation(() => [tagStatsQueue.shift()]),
            } as unknown;
          }
          if (fields && 'totalArticles' in fields) {
            return [
              {
                totalArticles: 4,
                publishedArticles: 3,
                privateArticles: 1,
                hiddenArticles: 0,
                totalViews: 40,
              },
            ];
          }
        }
        if (table === categories) {
          return [];
        }
        return [];
      });
      return { from };
    });

    const testDb = { select } as unknown as Database;
    const testService = new StatisticsService(testDb);

    const res = await testService.getOverallStatistics();

    expect(res.tags[0].slug).toBeUndefined();
  });

  it('should return 0 when total published word count is null/empty', async () => {
    // Override the select mock for the word-count query to return null
    const originalSelect = (db as unknown as Database & Record<string, ReturnType<typeof vi.fn>>)
      .select as ReturnType<typeof vi.fn>;
    (db as unknown as Database & Record<string, ReturnType<typeof vi.fn>>).select = vi
      .fn()
      .mockImplementation((fields?: Record<string, unknown>) => {
        const from = vi.fn().mockImplementation((table: unknown) => {
          if (table === articles && fields && 'total' in fields) {
            return { where: vi.fn().mockResolvedValue([{ total: null }]) } as unknown;
          }
          return [];
        });
        return { from };
      });

    const total = await service.getTotalPublishedWordCount();
    expect(total).toBe(0);

    // restore
    (db as any).select = originalSelect;
  });

  it('should handle negative or invalid word counts', async () => {
    const select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
      const from = vi.fn().mockImplementation((table: unknown) => {
        if (table === articles && fields && 'total' in fields) {
          return { where: vi.fn().mockResolvedValue([{ total: -100 }]) } as unknown;
        }
        return [];
      });
      return { from };
    });

    const testDb = { select } as unknown as Database;
    const testService = new StatisticsService(testDb);

    const total = await testService.getTotalPublishedWordCount();
    expect(total).toBe(0);
  });

  it('should handle NaN word counts', async () => {
    const select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
      const from = vi.fn().mockImplementation((table: unknown) => {
        if (table === articles && fields && 'total' in fields) {
          return { where: vi.fn().mockResolvedValue([{ total: NaN }]) } as unknown;
        }
        return [];
      });
      return { from };
    });

    const testDb = { select } as unknown as Database;
    const testService = new StatisticsService(testDb);

    const total = await testService.getTotalPublishedWordCount();
    expect(total).toBe(0);
  });

  it('should handle Infinity word counts', async () => {
    const select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
      const from = vi.fn().mockImplementation((table: unknown) => {
        if (table === articles && fields && 'total' in fields) {
          return { where: vi.fn().mockResolvedValue([{ total: Infinity }]) } as unknown;
        }
        return [];
      });
      return { from };
    });

    const testDb = { select } as unknown as Database;
    const testService = new StatisticsService(testDb);

    const total = await testService.getTotalPublishedWordCount();
    expect(total).toBe(0);
  });

  it('should compute total published word count properly', async () => {
    const total = await service.getTotalPublishedWordCount();
    expect(total).toBe(1234);
  });

  it('should handle empty result set for word count', async () => {
    const select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
      const from = vi.fn().mockImplementation((table: unknown) => {
        if (table === articles && fields && 'total' in fields) {
          return { where: vi.fn().mockResolvedValue([]) } as unknown;
        }
        return [];
      });
      return { from };
    });

    const testDb = { select } as unknown as Database;
    const testService = new StatisticsService(testDb);

    const total = await testService.getTotalPublishedWordCount();
    expect(total).toBe(0);
  });
});
