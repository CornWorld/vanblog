/**
 * CategoryService - Core CRUD Tests
 *
 * 测试分类服务的核心 CRUD 操作：
 * - findAll（获取所有分类及文章数）
 * - findOne（获取单个分类）
 * - create（创建分类）
 * - update（更新分类）
 * - remove（删除分类，含钩子触发）
 * - findByName（按名称查找）
 * - getStatistics（获取统计信息）
 *
 * @module CategoryService
 * @group core
 */

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';
import { MockUtils } from '../../../test/mock-utils';

import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let mockDb: any;
  let mockHookService: Partial<HookService>;

  beforeEach(async () => {
    const databaseMockBuilder = new MockUtils.database();
    mockDb = databaseMockBuilder.build();
    mockHookService = MockUtils.services.createHookServiceMock();

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
          useValue: MockUtils.services.createConfigServiceMock({ 'jwt.secret': 'test-secret-key' }),
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('findAll', () => {
    it('should return categories with article count', async () => {
      const mockCategories = [
        {
          id: 1,
          name: 'Technology',
          slug: undefined,
          description: 'Tech articles',
          private: false,
          password: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          articleCount: 5,
        },
      ];

      mockDb.groupBy.mockResolvedValueOnce(mockCategories);

      const result = (await service.findAll()) as any;

      expect(result.items).toHaveLength(1);
      expect((result.items as any[])[0].name).toBe('Technology');
      expect((result.items as any[])[0].articleCount).toBe(5);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a single category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: undefined,
        description: 'Tech articles',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockCategory]);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Technology');
    });

    it('should throw NotFoundException when category not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const mockCreatedCategory = {
        id: 1,
        name: 'New Category',
        slug: undefined,
        description: 'New category description',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedCategory]);

      const createDto = {
        name: 'New Category',
        slug: 'new-category',
        description: 'New category description',
      };

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('New Category');
    });
  });

  describe('update', () => {
    it('should update an existing category', async () => {
      const mockUpdatedCategory = {
        id: 1,
        name: 'Updated Category',
        slug: undefined,
        description: 'Updated description',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock update returning
      mockDb.returning.mockResolvedValueOnce([mockUpdatedCategory]);

      const updateDto = {
        name: 'Updated Category',
        description: 'Updated description',
      };

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Category');
      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundException when category not found', async () => {
      // Mock update returning empty array
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Category1',
        slug: null,
        description: null,
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findOne call - first select query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCategory]),
          }),
        }),
      });

      // Mock article count check - second select query - proper Promise chain
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      // Mock delete returning
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.remove(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when category not found', async () => {
      // Mock findOne to throw NotFoundException
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when category contains articles', async () => {
      const mockCategory = {
        id: 1,
        name: 'CategoryWithArticles',
        slug: null,
        description: null,
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findOne call - first select query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCategory]),
          }),
        }),
      });

      // Mock article count check - second select query - proper Promise chain
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      await expect(service.remove(1)).rejects.toThrow(
        'Cannot delete category "CategoryWithArticles" because it contains 5 articles',
      );
    });

    it('should call beforeDelete and afterDelete hooks', async () => {
      const mockCategory = {
        id: 1,
        name: 'Category1',
        slug: null,
        description: null,
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock findOne call - first select query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCategory]),
          }),
        }),
      });

      // Mock article count check - second select query - need to create a proper thenable chain
      const thenableMock = {
        then: vi.fn().mockImplementation((resolve) => resolve([{ count: 0 }])),
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(thenableMock),
        }),
      });

      // Mock delete returning
      mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

      await service.remove(1);

      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'category|beforeDelete',
        expect.any(Object),
        expect.objectContaining({ action: 'delete' }),
      );
      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'category|afterDelete',
        expect.objectContaining({ id: 1, name: 'Category1' }),
      );
    });
  });

  describe('findByName', () => {
    it('should return category when found', async () => {
      const mockCategory = {
        id: 1,
        name: 'Technology',
        slug: 'tech',
        description: 'Tech articles',
        private: false,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockCategory]);

      const result = await service.findByName('Technology');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Technology');
    });

    it('should return null when category not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.findByName('NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('getStatistics', () => {
    it('should return overall statistics', async () => {
      const result = await service.getStatistics();

      expect(result).toBeDefined();
      expect(result.totalCategories).toBe(0);
      expect(result.totalTags).toBe(0);
      expect(result.totalArticles).toBe(0);
    });
  });
});
