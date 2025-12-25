/**
 * CategoryService - Password Management Tests
 *
 * 测试分类密码相关功能：
 * - 创建分类时的密码哈希处理
 * - 更新分类时的密码哈希处理
 * - 密码验证逻辑
 * - 密码相关的钩子触发
 *
 * @module CategoryService
 * @group password
 */

import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

describe('CategoryService - Password Management', () => {
  let service: CategoryService;
  let mockHookService: Partial<HookService>;

  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    then?: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    };

    mockHookService = {
      applyFilters: vi.fn().mockImplementation(async (_hookName, data) => Promise.resolve(data)),
      doAction: vi.fn().mockResolvedValue(undefined),
    };

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
          useValue: {
            jwt: { secret: 'test-secret-key' },
            get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('create - Password Handling', () => {
    it('should hash password when provided', async () => {
      const createDto = {
        name: 'Private Category',
        description: 'A private category',
        password: 'plaintext-password',
      };

      const mockCreatedCategory = {
        id: 1,
        name: 'Private Category',
        slug: undefined,
        description: 'A private category',
        private: true,
        password: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedCategory]);

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Private Category');
      // Password should be hashed (not equal to original)
      expect(mockHookService.applyFilters).toHaveBeenCalledWith(
        'category|beforeCreate',
        expect.any(Object),
        expect.objectContaining({ action: 'create' }),
      );
      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'category|afterCreate',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should apply beforeCreate filter hook', async () => {
      const createDto = {
        name: 'Test Category',
        description: 'Test',
      };

      const modifiedDto = {
        ...createDto,
        description: 'Modified by hook',
      };

      mockHookService.applyFilters = vi
        .fn()
        .mockImplementation(async (_hookName, _data) => Promise.resolve(modifiedDto));

      const mockCreatedCategory = {
        id: 1,
        ...modifiedDto,
        slug: undefined,
        private: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockCreatedCategory]);

      await service.create(createDto);

      expect(mockHookService.applyFilters).toHaveBeenCalledWith(
        'category|beforeCreate',
        createDto,
        expect.objectContaining({ action: 'create' }),
      );
    });

    it('should throw error when insert fails', async () => {
      const createDto = {
        name: 'Test Category',
      };

      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.create(createDto)).rejects.toThrow('Failed to create category');
    });
  });

  describe('update - Password Handling', () => {
    it('should hash password when provided', async () => {
      const updateDto = {
        name: 'Updated Category',
        password: 'new-password',
      };

      const mockUpdatedCategory = {
        id: 1,
        name: 'Updated Category',
        slug: null,
        description: null,
        private: true,
        password: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedCategory]);

      const result = await service.update(1, updateDto);

      expect(result.name).toBe('Updated Category');
      expect(mockHookService.applyFilters).toHaveBeenCalledWith(
        'category|beforeUpdate',
        expect.any(Object),
        expect.objectContaining({ action: 'update', id: 1 }),
      );
      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'category|afterUpdate',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should apply beforeUpdate filter hook', async () => {
      const updateDto = {
        name: 'Original Name',
        description: 'Original Description',
      };

      const modifiedDto = {
        name: 'Modified Name',
        description: 'Modified Description',
      };

      mockHookService.applyFilters = vi
        .fn()
        .mockImplementation(async (_hookName, _data) => Promise.resolve(modifiedDto));

      const mockUpdatedCategory = {
        id: 1,
        ...modifiedDto,
        slug: null,
        private: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedCategory]);

      await service.update(1, updateDto);

      expect(mockHookService.applyFilters).toHaveBeenCalledWith(
        'category|beforeUpdate',
        expect.any(Object),
        expect.objectContaining({ action: 'update', id: 1 }),
      );
    });
  });

  describe('verifyPassword', () => {
    it('should return success for non-private category', async () => {
      const mockCategory = {
        id: 1,
        name: 'Public Category',
        slug: null,
        description: null,
        private: null,
        password: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockDb.limit.mockResolvedValueOnce([
        { ...mockCategory, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const result = await service.verifyPassword(1, 'any-password');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Category is not private');
      expect(result.token).toBeUndefined();
    });

    it('should return failure for invalid password', async () => {
      const mockCategory = {
        id: 1,
        name: 'Private Category',
        slug: null,
        description: null,
        private: true,
        password: '$2b$10$somehash', // bcrypt hash
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValueOnce([mockCategory]);

      const result = await service.verifyPassword(1, 'wrong-password');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid password');
      expect(result.token).toBeUndefined();
    });

    it('should throw NotFoundException when category not found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.verifyPassword(999, 'password')).rejects.toThrow(NotFoundException);
    });
  });
});
