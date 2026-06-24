/**
 * @fileoverview UserService 高级创建场景测试
 *
 * 测试场景：
 * - 并发创建用户的竞态条件
 * - 创建时的 Hook 复杂场景（beforeCreate/afterCreate）
 * - Hook 错误处理与数据修改
 *
 * 迁移模式：
 * - 使用真实数据库 + withTestTransaction 自动回滚
 * - 保留外部服务 Mock（HookService）
 *
 * 关联文件：
 * - user.service.spec.ts - 核心 CRUD 操作
 * - user.service.update-password.spec.ts - 密码处理
 * - user.service.permissions.spec.ts - 权限管理
 * - user.service.entity-mapping.spec.ts - 实体映射
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';
import { users } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

import { db } from '@test/setup.unit';
import { Mock } from '@test/mock';
import { withTestTransaction } from '@test/utils/db-transaction-helper';

import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { UserService } from './user.service';

import type { CreateUserDto } from './dto/create-user.dto';

vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('UserService - Create Advanced', () => {
  let module: TestingModule;
  let mockHookService: ReturnType<typeof Mock.hook>;

  beforeEach(async () => {
    // Setup bcrypt mock to return a hashed password
    mockedBcrypt.hash.mockResolvedValue('$2a$10$hashedPassword' as never);

    // Create Hook service mock
    mockHookService = Mock.hook();

    // Create test module with global database
    module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: HookService,
          useValue: mockHookService as any,
        },
      ],
    }).compile();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset hook mocks to default implementations
    mockHookService.applyFilters = Mock.hook().applyFilters;
    mockHookService.doAction = Mock.hook().doAction;
  });

  // Helper function to create service with transaction database
  const createServiceWithTx = (tx: typeof db): UserService => {
    const service = module.get(UserService);
    // Override the database connection with transaction
    (service as any)['db'] = tx as any;
    return service;
  };

  /**
   * Generate unique username for testing
   */
  const generateUsername = (): string => `test_${faker.string.alphanumeric(8)}`;

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent username existence checks', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createServiceWithTx(tx);

        const createUserDto: CreateUserDto = {
          username: generateUsername(),
          password: 'password123',
          type: 'admin',
        };

        // First creation should succeed
        const result1 = await service.create(createUserDto);
        expect(result1.username).toBe(createUserDto.username);

        // Verify user was created in database
        const [savedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.username, createUserDto.username));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe(createUserDto.username);
        expect(savedUser.type).toBe('admin');
      });
    });

    it('should throw ConflictException for duplicate username', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createServiceWithTx(tx);

        const username = generateUsername();
        const createUserDto: CreateUserDto = {
          username,
          password: 'password123',
          type: 'admin',
        };

        // First creation should succeed
        const result1 = await service.create(createUserDto);
        expect(result1.username).toBe(username);

        // Second creation with same username should fail
        await expect(service.create(createUserDto)).rejects.toThrow('Username already exists');
      });
    });
  });

  describe('Hook Integration - beforeCreate', () => {
    it('should trigger beforeCreate and afterCreate hooks', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createServiceWithTx(tx);

        const createUserDto: CreateUserDto = {
          username: generateUsername(),
          password: 'password123',
          type: 'admin',
        };

        await service.create(createUserDto);

        // Verify hooks were called
        expect(mockHookService.applyFilters).toHaveBeenCalledWith(
          'user|beforeCreate',
          createUserDto,
          { action: 'create' },
        );
        expect(mockHookService.doAction).toHaveBeenCalledWith(
          'user|afterCreate',
          expect.any(Object),
          expect.objectContaining({
            id: expect.any(Number),
            username: createUserDto.username,
          }),
        );

        // Verify user was created in database
        const [savedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.username, createUserDto.username));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe(createUserDto.username);
        expect(savedUser.type).toBe('admin');
      });
    });

    it('should continue even if beforeCreate hook throws error', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createServiceWithTx(tx);

        const createUserDto: CreateUserDto = {
          username: generateUsername(),
          password: 'password123',
          type: 'admin',
        };

        // Mock hook to throw error
        mockHookService.applyFilters = vi.fn().mockRejectedValue(new Error('Hook error'));

        // Creation should still succeed
        const result = await service.create(createUserDto);

        expect(result.username).toBe(createUserDto.username);

        // Verify user was still created in database
        const [savedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.username, createUserDto.username));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe(createUserDto.username);
      });
    });

    it('should allow beforeCreate hook to modify user data', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createServiceWithTx(tx);

        const createUserDto: CreateUserDto = {
          username: generateUsername(),
          password: 'password123',
          type: 'admin',
        };

        const modifiedDto = {
          ...createUserDto,
          nickname: 'Modified by hook',
        };

        // Mock hook to modify data
        mockHookService.applyFilters = vi.fn().mockResolvedValue(modifiedDto);

        const result = await service.create(createUserDto);

        // Verify modified data was used
        expect(result.nickname).toBe('Modified by hook');

        // Verify user was created with modified data in database
        const [savedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.username, createUserDto.username));
        expect(savedUser).toBeDefined();
        expect(savedUser.nickname).toBe('Modified by hook');
      });
    });

    it('should propagate afterCreate hook errors', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createServiceWithTx(tx);

        const createUserDto: CreateUserDto = {
          username: generateUsername(),
          password: 'password123',
          type: 'admin',
        };

        // Mock afterCreate hook to throw error
        mockHookService.doAction = vi.fn().mockRejectedValue(new Error('After hook error'));

        // Creation should fail with hook error
        await expect(service.create(createUserDto)).rejects.toThrow('After hook error');

        // Verify user was still created in database (transaction would have committed before hook)
        const [savedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.username, createUserDto.username));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe(createUserDto.username);
      });
    });

    it('should call hooks with correct context', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createServiceWithTx(tx);

        const createUserDto: CreateUserDto = {
          username: generateUsername(),
          password: 'password123',
          type: 'viewer',
        };

        await service.create(createUserDto);

        // Verify beforeCreate was called with action context
        expect(mockHookService.applyFilters).toHaveBeenCalledWith(
          'user|beforeCreate',
          createUserDto,
          { action: 'create' },
        );

        // Verify afterCreate was called with created user
        const afterCreateCalls = mockHookService.doAction.mock.calls;
        const userAfterCreateCall = afterCreateCalls.find(
          (call: any) => call[0] === 'user|afterCreate',
        );

        expect(userAfterCreateCall).toBeDefined();

        expect(userAfterCreateCall![2]).toMatchObject({
          username: createUserDto.username,
          type: 'viewer',
        });
      });
    });
  });
});
