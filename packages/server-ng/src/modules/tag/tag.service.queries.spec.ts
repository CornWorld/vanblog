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
 * Migration: Mock.db() → withTestTransaction (2026-01-05)
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { describe, beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import { sql } from 'drizzle-orm';

import { tags, articles } from '@vanblog/shared/drizzle';
import { DATABASE_CONNECTION } from '../../database';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import {
  setupWorkerDatabase,
  cleanupWorkerDatabase,
  getWorkerIdFromEnv,
} from '@test/utils/db-worker-setup';
import { Given } from '@test/given';

import { TagService } from './tag.service';
import { HookService } from '../plugin/services/hook.service';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';

import type { LibSQLDatabase } from 'drizzle-orm/libsql';

describe('TagService - Complex Queries', () => {
  let db: LibSQLDatabase<Record<string, unknown>>;
  let dbPath: string;
  let module: TestingModule;

  beforeAll(async () => {
    // Setup test database
    const workerId = getWorkerIdFromEnv();
    const setup = setupWorkerDatabase(workerId);
    db = setup.db;
    dbPath = setup.dbPath;

    // Disable foreign key constraints for testing
    await db.run('PRAGMA foreign_keys = OFF;');

    // Drop existing tables from migrations to recreate without foreign keys
    await db.run('DROP TABLE IF EXISTS articles');
    await db.run('DROP TABLE IF EXISTS tags');

    // Create tables
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        pathname TEXT UNIQUE,
        tags TEXT,
        category TEXT,
        author TEXT NOT NULL,
        top INTEGER DEFAULT 0,
        hidden INTEGER DEFAULT 0,
        private INTEGER DEFAULT 0,
        password TEXT,
        viewer INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at TEXT NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    // Create test module with mocked external services
    module = await Test.createTestingModule({
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

  afterAll(() => {
    cleanupWorkerDatabase(dbPath);
  });

  beforeEach(async () => {
    // Clean tables before each test
    await db.delete(articles);
    await db.delete(tags);
  });

  describe('getArticlesByTagName', () => {
    it('should return articles for a tag by name', async () => {
      await withTestTransaction(db, async (tx) => {
        // Create tag
        await Given.tag(db as any, { name: 'Technology', slug: 'tech' });

        // Create article with tag
        await Given.article(db as any, {
          title: 'Article 1',
          content: 'Content 1',
          pathname: '/article-1',
          tags: ['Technology', 'Programming'],
          category: 'Tech',
        });

        // Create service with transaction database
        const txService = new TagService(
          tx,
          module.get(StatisticsService),
          module.get(QueryOptimizerService),
          module.get(HookService),
        );

        // Execute query
        const result = await txService.getArticlesByTagName('Technology', {
          page: 1,
          pageSize: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        // Verify results
        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.items[0].title).toBe('Article 1');
        expect(result.items[0].tags).toContain('Technology');
      });
    });

    it('should throw NotFoundException when tag name not found', async () => {
      await withTestTransaction(db, async (tx) => {
        // Don't create any tag - query should fail
        const txService = new TagService(
          tx,
          module.get(StatisticsService),
          module.get(QueryOptimizerService),
          module.get(HookService),
        );

        await expect(
          txService.getArticlesByTagName('NonExistent', {
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('getArticlesByTagId', () => {
    it('should return articles for a tag', async () => {
      await withTestTransaction(db, async (tx) => {
        // Create tag
        const tag = await Given.tag(db as any, { name: 'Technology', slug: 'tech' });

        // Create article with tag
        await Given.article(db as any, {
          title: 'Article 1',
          content: 'Content 1',
          pathname: '/article-1',
          tags: ['Technology'],
          category: 'Tech',
        });

        // Create service with transaction database
        const txService = new TagService(
          tx,
          module.get(StatisticsService),
          module.get(QueryOptimizerService),
          module.get(HookService),
        );

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
        const tag = await Given.tag(db as any, {
          name: 'Technology',
          slug: 'tech',
        });

        // Create 25 articles with this tag using Given
        await Given.articles(25, {
          category: 'Tech',
          tags: ['Technology'],
        });

        // Create service with transaction database
        const txService = new TagService(
          tx,
          module.get(StatisticsService),
          module.get(QueryOptimizerService),
          module.get(HookService),
        );

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
        // Create tag
        const tag = await Given.tag(db as any, {
          name: 'Technology',
          slug: 'tech',
        });

        // Create hidden article using Given
        await Given.article(db as any, {
          title: 'Hidden Article',
          content: 'Content 1',
          tags: ['Technology'],
          category: 'Tech',
          hidden: true,
        });

        // Create service with transaction database
        const txService = new TagService(
          tx,
          module.get(StatisticsService),
          module.get(QueryOptimizerService),
          module.get(HookService),
        );

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
        const txService = new TagService(
          tx,
          module.get(StatisticsService),
          module.get(QueryOptimizerService),
          module.get(HookService),
        );

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
        const txService = new TagService(
          tx,
          module.get(StatisticsService),
          module.get(QueryOptimizerService),
          module.get(HookService),
        );

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
