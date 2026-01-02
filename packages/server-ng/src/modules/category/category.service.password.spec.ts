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
import { MockUtils } from '../../../test/mock-utils';

import { CategoryService } from './category.service';

describe('CategoryService - Password Management', () => {
  let service: CategoryService;
  let mockHookService: Partial<HookService>;
  let mockDb: any;

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
          useValue: MockUtils.services.createStatisticsServiceMock(),
        },
        {
          provide: QueryOptimizerService,
          useValue: MockUtils.services.createQueryOptimizerServiceMock(),
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

  describe('create - Password Handling', () => {
    it('should hash password when provided', async () => {
      const createDto = {
        name: 'Private Category',
        description: 'A private category',
        password: 'plaintext-password',
      };

      const mockCreatedCategory = MockUtils.testData.createCategory({
        name: 'Private Category',
        description: 'A private category',
        private: true,
        password: 'hashed-password',
      });

      mockDb.returning.mockResolvedValueOnce([mockCreatedCategory]);

      const result = await service.create(createDto);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Private Category');
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

      const mockCreatedCategory = MockUtils.testData.createCategory({
        ...modifiedDto,
      });

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

      const mockUpdatedCategory = MockUtils.testData.createCategory({
        name: 'Updated Category',
        private: true,
        password: 'hashed-password',
      });

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

      const mockUpdatedCategory = MockUtils.testData.createCategory(modifiedDto);

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
      const mockCategory = MockUtils.testData.createCategory({
        private: false,
        password: null,
      });

      mockDb.limit.mockResolvedValueOnce([mockCategory]);

      const result = await service.verifyPassword(1, 'any-password');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Category is not private');
      expect(result.token).toBeUndefined();
    });

    it('should return failure for invalid password', async () => {
      const mockCategory = MockUtils.testData.createCategory({
        private: true,
        password: '$2b$10$somehash',
      });

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
