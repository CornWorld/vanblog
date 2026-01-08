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
import { vi, describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { users } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

import { Mock } from '@test/mock';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { setupWorkerDatabase, cleanupWorkerDatabase, getWorkerIdFromEnv } from '@test/utils/db-worker-setup';

import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { UserService } from './user.service';

import type { CreateUserDto } from './dto/create-user.dto';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

describe('UserService - Create Advanced', () => {
  let db: LibSQLDatabase;
  let dbPath: string;
  let service: UserService;
  let module: TestingModule;
  let mockHookService: ReturnType<typeof Mock.hook>;

  beforeAll(async () => {
    // Setup test database for this test file
    const workerId = getWorkerIdFromEnv();
    const setup = await setupWorkerDatabase(workerId);
    db = setup.db;
    dbPath = setup.dbPath;

    // Create users table
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        nickname TEXT,
        email TEXT UNIQUE,
        avatar TEXT,
        type TEXT NOT NULL DEFAULT 'guest',
        permissions TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    // Create Hook service mock
    mockHookService = Mock.hook();

    // Create test module with real database and mocked services
    module = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterAll(async () => {
    await cleanupWorkerDatabase(dbPath);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset hook mocks to default implementations
    mockHookService.applyFilters = Mock.hook().applyFilters;
    mockHookService.doAction = Mock.hook().doAction;
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent username existence checks', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database into service
        (service as any).db = tx;

        const createUserDto: CreateUserDto = {
          username: 'concurrentuser',
          password: 'password123',
          type: 'admin',
        };

        // First creation should succeed
        const result1 = await service.create(createUserDto);
        expect(result1.username).toBe('concurrentuser');

        // Verify user was created in database
        const [savedUser] = await tx.select().from(users).where(eq(users.username, 'concurrentuser'));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe('concurrentuser');
        expect(savedUser.type).toBe('admin');
      });

      // Verify rollback happened - database should be clean
      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(0);
    });

    it('should throw ConflictException for duplicate username', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database into service
        (service as any).db = tx;

        const createUserDto: CreateUserDto = {
          username: 'duplicateuser',
          password: 'password123',
          type: 'admin',
        };

        // First creation should succeed
        const result1 = await service.create(createUserDto);
        expect(result1.username).toBe('duplicateuser');

        // Second creation with same username should fail
        await expect(service.create(createUserDto)).rejects.toThrow('Username already exists');
      });

      // Verify rollback happened - database should be clean
      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(0);
    });
  });

  describe('Hook Integration - beforeCreate', () => {
    it('should trigger beforeCreate and afterCreate hooks', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database into service
        (service as any).db = tx;

        const createUserDto: CreateUserDto = {
          username: 'testuser',
          password: 'password123',
          type: 'admin',
        };

        const result = await service.create(createUserDto);

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
            username: 'testuser',
          }),
        );

        // Verify user was created in database
        const [savedUser] = await tx.select().from(users).where(eq(users.username, 'testuser'));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe('testuser');
        expect(savedUser.type).toBe('admin');
      });
    });

    it('should continue even if beforeCreate hook throws error', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database into service
        (service as any).db = tx;

        const createUserDto: CreateUserDto = {
          username: 'testuser',
          password: 'password123',
          type: 'admin',
        };

        // Mock hook to throw error
        mockHookService.applyFilters = vi.fn().mockRejectedValue(new Error('Hook error'));

        // Creation should still succeed
        const result = await service.create(createUserDto);

        expect(result.username).toBe('testuser');

        // Verify user was still created in database
        const [savedUser] = await tx.select().from(users).where(eq(users.username, 'testuser'));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe('testuser');
      });
    });

    it('should allow beforeCreate hook to modify user data', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database into service
        (service as any).db = tx;

        const createUserDto: CreateUserDto = {
          username: 'testuser',
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
        const [savedUser] = await tx.select().from(users).where(eq(users.username, 'testuser'));
        expect(savedUser).toBeDefined();
        expect(savedUser.nickname).toBe('Modified by hook');
      });
    });

    it('should propagate afterCreate hook errors', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database into service
        (service as any).db = tx;

        const createUserDto: CreateUserDto = {
          username: 'testuser',
          password: 'password123',
          type: 'admin',
        };

        // Mock afterCreate hook to throw error
        mockHookService.doAction = vi.fn().mockRejectedValue(new Error('After hook error'));

        // Creation should fail with hook error
        await expect(service.create(createUserDto)).rejects.toThrow('After hook error');

        // Verify user was still created in database (transaction would have committed before hook)
        const [savedUser] = await tx.select().from(users).where(eq(users.username, 'testuser'));
        expect(savedUser).toBeDefined();
        expect(savedUser.username).toBe('testuser');
      });
    });

    it('should call hooks with correct context', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction database into service
        (service as any).db = tx;

        const createUserDto: CreateUserDto = {
          username: 'contextuser',
          password: 'password123',
          type: 'guest',
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
        const userAfterCreateCall = afterCreateCalls.find((call) => call[0] === 'user|afterCreate');

        expect(userAfterCreateCall).toBeDefined();
        expect(userAfterCreateCall![2]).toMatchObject({
          username: 'contextuser',
          type: 'guest',
        });
      });
    });
  });
});
