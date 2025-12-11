import { categories, tags, articles } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { StatisticsService } from './statistics.service';

// 我们不需要真实的 drizzle Database；构造一个轻量 mock，匹配调用模式

describe('StatisticsService', () => {
  let service: StatisticsService;
  let db: Record<string, unknown>;

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
        if (table === categories && (fields == null || Object.keys(fields).length === 0)) {
          return allCategories;
        }
        // Selecting all tags
        if (table === tags && (fields == null || Object.keys(fields).length === 0)) {
          return allTags;
        }
        // Article statistics selection branches
        if (table === articles) {
          // Overall article statistics (no where())
          if (fields && 'totalArticles' in fields && 'publishedArticles' in fields) {
            return [overallArticleStatsRow];
          }
          // Category statistics (with where())
          if (fields && 'publishedCount' in fields && 'privateCount' in fields) {
            return {
              where: vi.fn().mockImplementation((_cond: unknown) => [categoryStatsQueue.shift()]),
            } as unknown;
          }
          // Tag statistics (with where())
          if (fields && 'articleCount' in fields && !('publishedCount' in fields)) {
            return {
              where: vi.fn().mockImplementation((_cond: unknown) => [tagStatsQueue.shift()]),
            } as unknown;
          }
          // Total published word count path: fields has { total: ... } and then .where()
          if (fields && 'total' in fields) {
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

    db = { select } as unknown as Record<string, unknown>;
    service = new StatisticsService(db as any);
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

  it('should return 0 when total published word count is null/empty', async () => {
    // Override the select mock for the word-count query to return null
    const originalSelect = (db as any).select as ReturnType<typeof vi.fn>;
    (db as any).select = vi.fn().mockImplementation((fields?: Record<string, unknown>) => {
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

  it('should compute total published word count properly', async () => {
    const total = await service.getTotalPublishedWordCount();
    expect(total).toBe(1234);
  });
});
