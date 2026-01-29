/**
 * TagService - Complex Article Queries Tests
 *
 * Tests complex article queries by tag name or ID with pagination.
 * Uses real database + transaction rollback for isolation.
 *
 * Related tests:
 * - tag.service.spec.ts - Core CRUD operations
 * - tag.service.associations.spec.ts - Association queries
 * - tag.service.boundaries.spec.ts - Boundary conditions
 *
 * Migration: setupWorkerDatabase → global db (2026-01-29)
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, beforeEach, it, expect, vi } from 'vitest';

import { tags } from '@vanblog/shared/drizzle';
import { DATABASE_CONNECTION } from '../../database';
import { db } from '@test/setup.unit';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { Given } from '@test/given';

import { TagService } from './tag.service';
import { HookService } from '../plugin/services/hook.service';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';

describe('TagService - Complex Queries', () => {
  let baseModule: TestingModule;

  beforeEach(async () => {
    // Create test module with mocked external services
    baseModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: HookService,
          useValue: {
            applyFilters: vi.fn().mockImplementation((_hook, data) => Promise.resolve(data)),
            doAction: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: StatisticsService,
          useValue: {
            getOverallStatistics: vi.fn(),
          },
        },
        {
          provide: QueryOptimizerService,
          useValue: {
            withPerformanceMonitoring: vi.fn((_, fn) => Promise.resolve(fn())),
            batchCountArticlesByTags: vi.fn(() => ({})),
          },
        },
      ],
    }).compile();
  });

  // Helper function to create service with transaction database
  const createServiceWithTx = (tx: typeof db): TagService => {
    return new TagService(
      tx,
      baseModule.get(StatisticsService),
      baseModule.get(QueryOptimizerService),
      baseModule.get(HookService),
    );
  };

  describe('getArticlesByTagId', () => {
    it('should return articles for a tag', async () => {
      await withTestTransaction(db, async (tx) => {
        // Create tag
        const tag = await Given.tag(tx as any, { name: 'Technology', slug: 'tech' });

        // Create article with tag
        await Given.article(tx as any, {
          title: 'Article 1',
          content: 'Content 1',
          pathname: '/article-1',
          tags: ['Technology'],
          category: 'Tech',
        });

        // Create service with transaction database
        const txService = createServiceWithTx(tx);

        // Execute query
        const result = await txService.getArticlesByTagId(tag.id, {
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        // Verify results
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
        expect(result.totalPages).toBe(1);
        expect(result.items[0].title).toBe('Article 1');
      });
    });

    it('should handle pagination correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        // Create tag
        const tag = await Given.tag(tx as any, {
          name: 'Technology',
          slug: 'tech',
        });

        // Create 25 articles with this tag using Given
        for (let i = 0; i < 25; i++) {
          await Given.article(tx as any, {
            title: `Article ${i}`,
            content: `Content ${i}`,
            pathname: `/article-${i}`,
            category: 'Tech',
            tags: ['Technology'],
          });
        }

        // Create service with transaction database
        const txService = createServiceWithTx(tx);

        // Query page 2 (items 11-20)
        const result = await txService.getArticlesByTagId(tag.id, {
          page: 2,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        // Verify pagination
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(10);
        expect(result.total).toBe(25);
        expect(result.totalPages).toBe(3);
        expect(result.items).toHaveLength(10);
      });
    });

    it('should handle includeHidden parameter', async () => {
      await withTestTransaction(db, async (tx) => {
        // Create tag
        const tag = await Given.tag(tx as any, {
          name: 'Technology',
          slug: 'tech',
        });

        // Create hidden article using Given
        await Given.article(tx as any, {
          title: 'Hidden Article',
          content: 'Content 1',
          tags: ['Technology'],
          category: 'Tech',
          hidden: true,
        });

        // Create service with transaction database
        const txService = createServiceWithTx(tx);

        // Query with includeHidden=true
        const result = await txService.getArticlesByTagId(tag.id, {
          page: 1,
          pageSize: 10,
          includeHidden: true,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe('Hidden Article');
      });
    });

    it('should throw NotFoundException when tag not found', async () => {
      await withTestTransaction(db, async (tx) => {
        // Don't create any tag - query should fail
        const txService = createServiceWithTx(tx);

        await expect(
          txService.getArticlesByTagId(999, {
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    it('should handle zero total pages correctly', async () => {
      await withTestTransaction(db, async (tx) => {
        // Create tag without articles
        const [tag] = await tx
          .insert(tags)
          .values({
            name: 'EmptyTag',
            slug: 'empty',
          })
          .returning();

        // Create service with transaction database
        const txService = createServiceWithTx(tx);

        // Query articles - should return empty result
        const result = await txService.getArticlesByTagId(tag.id, {
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        expect(result.items).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.totalPages).toBe(0);
      });
    });
  });
});
