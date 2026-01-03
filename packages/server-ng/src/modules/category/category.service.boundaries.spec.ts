/**
 * CategoryService - Boundary Conditions Tests
 *
 * 测试分类服务的边界条件与特殊情况：
 * - 空值与 null 值处理
 * - 超长字符串（name, slug, description）
 * - 特殊字符（Unicode、Emoji、SQL 注入尝试）
 * - 仅包含空白字符的字符串
 * - 私有分类的边界值（超长密码、空密码）
 *
 * @module CategoryService
 * @group boundaries
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { Mock } from '@test/mock';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

describe('CategoryService - Boundary Conditions', () => {
  let service: CategoryService;
  let mockDb: any;
  let dbMockBuilder: ReturnType<typeof Mock.db>;

  beforeEach(async () => {
    dbMockBuilder = Mock.db();
    mockDb = dbMockBuilder.build();
    const mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        CategoryService,
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
        {
          provide: ConfigService,
          useValue: Mock.config({ 'jwt.secret': 'test-secret-key' }),
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('Empty and Null Values', () => {
    it('should handle empty string category name', async () => {
      const createDto = {
        name: '', // Empty string
        slug: 'test-slug',
        description: 'Test',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should handle null category name', async () => {
      const createDto = {
        name: null as any, // null
        slug: 'test-slug',
        description: 'Test',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should handle undefined category name', async () => {
      const createDto = {
        name: undefined as any, // undefined
        slug: 'test-slug',
        description: 'Test',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow();
    });

    it('should handle empty string slug', async () => {
      const createDto = {
        name: 'Test Category',
        slug: '', // Empty string
        description: 'Test',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test Category',
          slug: '',
          description: 'Test',
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });
  });

  describe('Very Long Strings', () => {
    it('should handle category name exceeding 1000 characters', async () => {
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
          description: null,
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toBe(longName);
      expect(result.name.length).toBe(1001);
    });

    it('should handle category slug exceeding 1000 characters', async () => {
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
          description: null,
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.slug).toBe(longSlug);
      expect(result.slug?.length).toBe(1001);
    });

    it('should handle category description exceeding 5000 characters', async () => {
      const longDesc = 'Lorem ipsum dolor sit amet. '.repeat(200);
      const createDto = {
        name: 'Test',
        description: longDesc,
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test',
          slug: undefined,
          description: longDesc,
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.description).toBe(longDesc);
    });
  });

  describe('Special Characters', () => {
    it('should handle category with SQL injection attempt in name', async () => {
      const sqlInjectionAttempt = "'; DROP TABLE categories; --";
      const createDto = {
        name: sqlInjectionAttempt,
        slug: 'test',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: sqlInjectionAttempt,
          slug: 'test',
          description: null,
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toBe(sqlInjectionAttempt);
    });

    it('should handle category with special characters', async () => {
      const specialCharsName = '测试 Category <>&"\'';
      const createDto = {
        name: specialCharsName,
        slug: 'test-special',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: specialCharsName,
          slug: 'test-special',
          description: null,
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toContain('测试');
      expect(result.name).toContain('&');
    });

    it('should handle category name with only whitespace', async () => {
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
          description: null,
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.name).toBe(whitespaceOnly);
    });

    it('should handle update with name containing emoji', async () => {
      const emojiName = 'Category with emoji 😀🎉🚀';
      const updateDto = {
        name: emojiName,
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: emojiName,
          slug: null,
          description: null,
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.update(1, updateDto);

      expect(result.name).toBe(emojiName);
      expect(result.name).toContain('😀');
    });
  });

  describe('Private Categories', () => {
    it('should handle private category with very long password', async () => {
      const longPassword = 'p'.repeat(1000);
      const createDto = {
        name: 'Private Category',
        private: true,
        password: longPassword,
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Private Category',
          slug: undefined,
          description: null,
          private: true,
          password: `hashed-${longPassword}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result.private).toBe(true);
    });

    it('should handle private category with empty password', async () => {
      const createDto = {
        name: 'Private Category',
        private: true,
        password: '',
      };

      mockDb.returning.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Private Category',
          slug: undefined,
          description: null,
          private: true,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });
  });
});
