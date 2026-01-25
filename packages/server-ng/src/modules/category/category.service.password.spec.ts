/**
 * CategoryService - Password Management Tests
 *
 * 测试分类密码相关功能：
 * - 创建分类时的密码哈希处理
 * - 更新分类时的密码哈希处理
 * - 密码验证逻辑
 * - 密码相关的钩子触发
 *
 * 测试策略：使用真实数据库 + 事务回滚
 * - 所有数据库操作在事务中执行，测试结束后自动回滚
 * - Mock bcrypt 避免真实的哈希计算（加快测试速度）
 * - 验证密码哈希和比对的正确性
 *
 * @module CategoryService
 * @group password
 */

import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { categories } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { db } from '@test/setup.unit';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { Mock } from '@test/mock';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION } from '../../database';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CategoryService } from './category.service';

// Mock bcrypt 模块
vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('CategoryService - Password Management', () => {
  let service: CategoryService;
  let mockHookService: ReturnType<typeof Mock.hook>;

  beforeEach(async () => {
    // 创建 Hook 服务 Mock
    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        CategoryService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: StatisticsService,
          useValue: Mock.statistics(),
        },
        {
          provide: QueryOptimizerService,
          useValue: Mock.queryOptimizer(),
        },
        {
          provide: HookService,
          useValue: mockHookService as any,
        },
        {
          provide: ConfigService,
          useValue: Mock.config({ 'jwt.secret': 'test-secret-key' }),
        },
        {
          provide: JwtService,
          useValue: Mock.jwt(),
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create - Password Handling', () => {
    it('should hash password when provided', async () => {
      await withTestTransaction(db, async (tx) => {
        // 注入事务数据库
        (service as any)['db'] = tx;

        const createDto = {
          name: 'Private Category',
          description: 'A private category',
          password: 'plaintext-password',
        };

        // Mock bcrypt.hash 返回哈希后的密码
        const hashedPassword = 'hashed-password';
        mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

        // 执行创建操作
        const result = await service.create(createDto);

        // 验证返回值
        expect(result.id).toBeDefined();
        expect(result.name).toBe('Private Category');
        expect(result.description).toBe('A private category');

        // 验证 bcrypt.hash 被正确调用
        expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-password', 10);

        // 验证数据库持久化
        const [savedCategory] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, result.id));
        expect(savedCategory).toBeDefined();
        expect(savedCategory.password).toBe(hashedPassword);

        // 验证钩子触发
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
    });

    it('should create category without password', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        const createDto = {
          name: 'Public Category',
          description: 'A public category',
        };

        // 不调用 bcrypt.hash
        mockedBcrypt.hash.mockResolvedValue(undefined as never);

        const result = await service.create(createDto);

        expect(result.name).toBe('Public Category');
        expect(result.password).toBeNull();

        // 验证数据库持久化
        const [savedCategory] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, result.id));
        expect(savedCategory.password).toBeNull();
      });
    });

    it('should apply beforeCreate filter hook', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

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

        const result = await service.create(createDto);

        // 验证钩子被调用
        expect(mockHookService.applyFilters).toHaveBeenCalledWith(
          'category|beforeCreate',
          createDto,
          expect.objectContaining({ action: 'create' }),
        );

        // 验证修改后的值被保存
        expect(result.description).toBe('Modified by hook');

        // 验证数据库持久化
        const [savedCategory] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, result.id));
        expect(savedCategory.description).toBe('Modified by hook');
      });
    });
  });

  describe('update - Password Handling', () => {
    it('should hash password when provided', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        // 先创建一个分类
        const [category] = await tx
          .insert(categories)
          .values({
            name: 'Test Category',
            description: 'Test description',
          })
          .returning();

        const updateDto = {
          name: 'Updated Category',
          password: 'new-password',
        };

        // Mock bcrypt.hash
        const hashedPassword = 'new-hashed-password';
        mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

        // 执行更新操作
        const result = await service.update(category.id, updateDto);

        // 验证返回值
        expect(result.name).toBe('Updated Category');

        // 验证 bcrypt.hash 被正确调用
        expect(mockedBcrypt.hash).toHaveBeenCalledWith('new-password', 10);

        // 验证数据库持久化
        const [updatedCategory] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, category.id));
        expect(updatedCategory.password).toBe(hashedPassword);

        // 验证钩子触发
        expect(mockHookService.applyFilters).toHaveBeenCalledWith(
          'category|beforeUpdate',
          expect.any(Object),
          expect.objectContaining({ action: 'update', id: category.id }),
        );
        expect(mockHookService.doAction).toHaveBeenCalledWith(
          'category|afterUpdate',
          expect.any(Object),
          expect.any(Object),
        );
      });
    });

    it('should update category without changing password', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        // 创建带密码的分类
        const [category] = await tx
          .insert(categories)
          .values({
            name: 'Private Category',
            description: 'Private',
            password: 'existing-password',
          })
          .returning();

        const updateDto = {
          name: 'Updated Name',
        };

        const result = await service.update(category.id, updateDto);

        expect(result.name).toBe('Updated Name');

        // 验证密码未改变
        const [updatedCategory] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, category.id));
        expect(updatedCategory.password).toBe('existing-password');
      });
    });

    it('should apply beforeUpdate filter hook', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        // 创建分类
        const [category] = await tx
          .insert(categories)
          .values({
            name: 'Original Name',
            description: 'Original Description',
          })
          .returning();

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

        const result = await service.update(category.id, updateDto);

        // 验证钩子被调用
        expect(mockHookService.applyFilters).toHaveBeenCalledWith(
          'category|beforeUpdate',
          expect.any(Object),
          expect.objectContaining({ action: 'update', id: category.id }),
        );

        // 验证修改后的值被保存
        expect(result.name).toBe('Modified Name');
        expect(result.description).toBe('Modified Description');

        // 验证数据库持久化
        const [updatedCategory] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, category.id));
        expect(updatedCategory.name).toBe('Modified Name');
        expect(updatedCategory.description).toBe('Modified Description');
      });
    });
  });

  describe('verifyPassword', () => {
    it('should return success for non-private category', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        // 创建非私密分类
        const [category] = await tx
          .insert(categories)
          .values({
            name: 'Public Category',
            description: 'Public',
            private: false,
            password: null,
          })
          .returning();

        const result = await service.verifyPassword(category.id, 'any-password');

        expect(result.success).toBe(true);
        expect(result.message).toBe('Category is not private');
        expect(result.token).toBeUndefined();
      });
    });

    it('should return success for private category with correct password', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        // 创建私密分类
        const hashedPassword = '$2b$10$abcdefghijk123456789';
        const [category] = await tx
          .insert(categories)
          .values({
            name: 'Private Category',
            description: 'Private',
            private: true,
            password: hashedPassword,
          })
          .returning();

        // Mock bcrypt.compare 返回 true
        mockedBcrypt.compare.mockResolvedValue(true as never);

        const result = await service.verifyPassword(category.id, 'correct-password');

        expect(result.success).toBe(true);
        expect(result.token).toBeDefined();
        expect(mockedBcrypt.compare).toHaveBeenCalledWith('correct-password', hashedPassword);
      });
    });

    it('should return failure for private category with incorrect password', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        // 创建私密分类
        const hashedPassword = '$2b$10$abcdefghijk123456789';
        const [category] = await tx
          .insert(categories)
          .values({
            name: 'Private Category',
            description: 'Private',
            private: true,
            password: hashedPassword,
          })
          .returning();

        // Mock bcrypt.compare 返回 false
        mockedBcrypt.compare.mockResolvedValue(false as never);

        const result = await service.verifyPassword(category.id, 'wrong-password');

        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid password');
        expect(result.token).toBeUndefined();
        expect(mockedBcrypt.compare).toHaveBeenCalledWith('wrong-password', hashedPassword);
      });
    });

    it('should throw NotFoundException when category not found', async () => {
      await withTestTransaction(db, async (tx) => {
        (service as any)['db'] = tx;

        await expect(service.verifyPassword(999, 'password')).rejects.toThrow(NotFoundException);
      });
    });

    it('should generate valid JWT token on successful verification', async () => {
      await withTestTransaction(db, async (tx) => {
        // 创建私密分类
        const hashedPassword = '$2b$10$abcdefghijk123456789';
        const [category] = await tx
          .insert(categories)
          .values({
            name: 'Private Category',
            description: 'Private',
            private: true,
            password: hashedPassword,
          })
          .returning();

        // Mock bcrypt.compare 返回 true
        mockedBcrypt.compare.mockResolvedValue(true as never);

        // 创建一个返回真实 JWT 格式的 mock jwtService
        const mockJwtService = Mock.jwt();
        (mockJwtService.sign as any).mockReturnValue(
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjYXRlZ29yeUlkIjoxfQ.signature',
        );

        // 创建使用 mock jwtService 的服务
        const serviceWithMockJwt = new CategoryService(
          tx,
          Mock.statistics(),
          Mock.queryOptimizer(),
          mockHookService as any,
          mockJwtService,
        );

        const result = await serviceWithMockJwt.verifyPassword(category.id, 'correct-password');

        expect(result.success).toBe(true);
        expect(result.token).toBeDefined();
        expect(typeof result.token).toBe('string');

        // 验证 token 格式（JWT 应该是 3 部分用点分隔）
        const parts = result.token!.split('.');
        expect(parts).toHaveLength(3);
      });
    });
  });
});
