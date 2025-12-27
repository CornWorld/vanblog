/**
 * TagService - Boundary Conditions and Edge Cases Tests
 *
 * Tests edge cases, boundary conditions, and special character handling.
 * Includes tests for empty/null values, very long strings, special characters,
 * SQL injection protection, and duplicate handling.
 *
 * Related tests:
 * - tag.service.spec.ts - Core CRUD operations
 * - tag.service.associations.spec.ts - Association queries
 * - tag.service.queries.spec.ts - Complex article queries
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

import { MockUtils } from '../../../test/mock-utils';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { TagService } from './tag.service';

describe('TagService - Boundary Conditions', () => {
  let service: TagService;
  let module: TestingModule;
  let mockHookService: Partial<HookService>;
  let databaseMockBuilder: MockUtils['database'];
  let mockDb: any;

  beforeEach(async () => {
    databaseMockBuilder = new MockUtils.database();
    mockDb = databaseMockBuilder.build();

    mockHookService = MockUtils.services.createHookServiceMock();

    module = await Test.createTestingModule({
      imports: [],
      providers: [
        TagService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: StatisticsService,
          useValue: {
            getOverallStatistics: vi.fn().mockResolvedValue({
              totalCategories: 0,
              totalTags: 0,
              totalArticles: 0,
              publishedArticles: 0,
              privateArticles: 0,
              hiddenArticles: 0,
              totalViews: 0,
              categories: [],
              tags: [],
            }),
          },
        },
        {
          provide: QueryOptimizerService,
          useValue: {
            withPerformanceMonitoring: vi.fn().mockImplementation((_name, fn) => fn()),
            batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
            batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
            buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
            logSlowQuery: vi.fn(),
          },
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty and Null Values', () => {
    it('should handle empty string tag name', async () => {
      const createDto = {
        name: '', // Empty string
        slug: 'test-slug',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should handle null tag name', async () => {
      const createDto = {
        name: null as any, // null
        slug: 'test-slug',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should handle undefined tag name', async () => {
      const createDto = {
        name: undefined as any, // undefined
        slug: 'test-slug',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should handle empty string slug', async () => {
      const createDto = {
        name: 'Test Tag',
        slug: '', // Empty string
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test Tag',
          slug: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });
  });

  describe('Very Long Strings', () => {
    it('should handle tag name exceeding 1000 characters', async () => {
      const longName = 'a'.repeat(1001);
      const createDto = {
        name: longName,
        slug: 'test-slug',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: longName,
          slug: 'test-slug',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toBe(longName);
      expect(result.name.length).toBe(1001);
    });

    it('should handle tag slug exceeding 1000 characters', async () => {
      const longSlug = 'a'.repeat(1001);
      const createDto = {
        name: 'Test',
        slug: longSlug,
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test',
          slug: longSlug,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.slug).toBe(longSlug);
      expect(result.slug?.length).toBe(1001);
    });
  });

  describe('Special Characters', () => {
    it('should handle tag with SQL injection attempt in name', async () => {
      const sqlInjectionAttempt = "'; DROP TABLE tags; --";
      const createDto = {
        name: sqlInjectionAttempt,
        slug: 'test',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: sqlInjectionAttempt,
          slug: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toBe(sqlInjectionAttempt);
    });

    it('should handle tag with special characters', async () => {
      const specialCharsName = '测试 Tag <>&"\'';
      const createDto = {
        name: specialCharsName,
        slug: 'test-special',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: specialCharsName,
          slug: 'test-special',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toContain('测试');
      expect(result.name).toContain('&');
    });

    it('should handle tag name with only whitespace', async () => {
      const whitespaceOnly = '   \t\n  ';
      const createDto = {
        name: whitespaceOnly,
        slug: 'test',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: whitespaceOnly,
          slug: 'test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toBe(whitespaceOnly);
    });

    it('should handle update with name containing emoji', async () => {
      const emojiName = 'Tag with emoji 😀🎉🚀';
      const updateDto = {
        name: emojiName,
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: emojiName,
          slug: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.update(1, updateDto);

      expect(result.name).toBe(emojiName);
      expect(result.name).toContain('😀');
    });
  });

  describe('Duplicate Tags and Edge Cases', () => {
    it('should handle findOrCreateTags with very long tag names', async () => {
      const longTagName = 'a'.repeat(1001);

      // First query: get all existing tags
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([]),
      });

      // Second query: get tags by names
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: longTagName,
              slug: longTagName.toLowerCase(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        }),
      });

      const result = await service.findOrCreateTags([longTagName]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(longTagName);
    });

    it('should handle findOrCreateTags with duplicate names', async () => {
      const existingTags = [
        {
          id: 1,
          name: 'DuplicateTag',
          slug: 'duplicate-tag',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // First query: get all existing tags
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue(existingTags),
      });

      // Second query: get tags by names (should deduplicate)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(existingTags),
        }),
      });

      const result = await service.findOrCreateTags(['DuplicateTag', 'DuplicateTag']);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('DuplicateTag');
    });

    it('should handle tags with case-sensitive names', async () => {
      // First query: get all existing tags
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([]),
      });

      // Second query: get tags by names
      const tags = [
        {
          id: 1,
          name: 'Python',
          slug: 'python',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: 'python',
          slug: 'python-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(tags),
        }),
      });

      const result = await service.findOrCreateTags(['Python', 'python']);

      expect(result).toHaveLength(2);
    });
  });
});
