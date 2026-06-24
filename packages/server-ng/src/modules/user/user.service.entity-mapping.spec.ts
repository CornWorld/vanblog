/**
 * @fileoverview UserService 实体映射测试
 *
 * 测试场景：
 * - mapToEntity 方法（数据库实体 → API 响应）
 * - 敏感字段过滤（password 默认排除，可选包含）
 * - 字段转换逻辑（null → undefined，空数组 → undefined）
 * - 可选字段处理（email, nickname, avatar, permissions）
 *
 * 关联文件：
 * - user.service.spec.ts - 核心 CRUD 操作
 * - user.service.create-advanced.spec.ts - 高级创建场景
 * - user.service.update-password.spec.ts - 密码处理
 * - user.service.permissions.spec.ts - 权限管理
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { users } from '@vanblog/shared/drizzle';
import { faker } from '@faker-js/faker';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { db } from '@test/setup.unit';
import { Given } from '@test/given';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { DATABASE_CONNECTION } from '../../database';

import { UserService } from './user.service';
import { HookService } from '../plugin/services/hook.service';

vi.mock('bcrypt');

describe('UserService - Entity Mapping', () => {
  let baseModule: TestingModule;
  let mockHookService: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // 创建 Hook 服务 Mock
    mockHookService = {
      applyFilters: vi.fn().mockImplementation((_name: any, data: any) => data),
      doAction: vi.fn().mockResolvedValue(undefined),
    } as any;

    baseModule = await Test.createTestingModule({
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
  });

  // Helper function to create service with transaction database
  const createServiceWithTx = (tx: typeof db): UserService => {
    const service = baseModule.get(UserService);
    // Override the database connection with transaction
    (service as any)['db'] = tx as any;
    return service;
  };

  describe('Password Field Handling', () => {
    it('should exclude password by default', async () => {
      await withTestTransaction(db, async (tx) => {
        // 创建测试用户（包含密码）
        const password = faker.internet.password();
        const dbUser = await Given.user(db as any, {
          username: faker.internet.username(),
          password,
          nickname: faker.person.fullName(),
          email: faker.internet.email(),
          type: 'admin',
          permissions: ['all'],
        });

        // 使用事务内服务查询
        const service = createServiceWithTx(tx);
        const result = await service.findOne(dbUser.id);

        // 验证密码字段被排除
        expect(result.password).toBeUndefined();
        expect(result).toMatchObject({
          id: dbUser.id,
          username: dbUser.username,
          nickname: dbUser.nickname,
          email: dbUser.email,
          type: 'admin',
          permissions: ['all'],
        });
      });
    });

    it('should include password when explicitly requested', async () => {
      await withTestTransaction(db, async (tx) => {
        // 创建测试用户
        const username = faker.internet.username();
        const password = faker.internet.password();
        await Given.user(db as any, {
          username,
          password,
          nickname: faker.person.fullName(),
          email: faker.internet.email(),
          type: 'admin',
          permissions: ['all'],
        });

        // 使用 findByUsernameWithPassword（应包含密码）
        const service = createServiceWithTx(tx);
        const result = await service.findByUsernameWithPassword(username);

        // 验证密码字段存在
        expect(result).toBeDefined();
        expect(result?.password).toBe(password);
      });
    });
  });

  describe('Permissions Field Conversion', () => {
    it('should convert null permissions to undefined', async () => {
      await withTestTransaction(db, async (tx) => {
        const [dbUser] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname: faker.person.fullName(),
            email: faker.internet.email(),
            type: 'viewer',
            permissions: null,
          })
          .returning();

        const service = createServiceWithTx(tx);
        const result = await service.findOne(dbUser.id);

        // 验证 null 转换为 undefined
        expect(result.permissions).toBeUndefined();
      });
    });

    it('should convert empty permissions array to undefined', async () => {
      await withTestTransaction(db, async (tx) => {
        const [dbUser] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname: faker.person.fullName(),
            email: faker.internet.email(),
            type: 'viewer',
            permissions: [],
          })
          .returning();

        const service = createServiceWithTx(tx);
        const result = await service.findOne(dbUser.id);

        // 验证空数组转换为 undefined
        expect(result.permissions).toBeUndefined();
      });
    });

    it('should preserve non-empty permissions array', async () => {
      await withTestTransaction(db, async (tx) => {
        const [dbUser] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname: faker.person.fullName(),
            email: faker.internet.email(),
            type: 'editor',
            permissions: ['read', 'write'],
          })
          .returning();

        const service = createServiceWithTx(tx);
        const result = await service.findOne(dbUser.id);

        // 验证非空权限数组被保留
        expect(result.permissions).toEqual(['read', 'write']);
      });
    });

    it('should filter out non-string elements in permissions', async () => {
      await withTestTransaction(db, async (tx) => {
        // 插入用户后直接更新 permissions 字段（绕过 Zod 验证）
        const username = faker.internet.username();
        const password = faker.internet.password();
        const [user] = await tx
          .insert(users)
          .values({
            username,
            password,
            nickname: faker.person.fullName(),
            email: faker.internet.email(),
            type: 'viewer',
            permissions: ['read', 'write'],
          })
          .returning();

        // 直接更新数据库，插入包含非字符串元素的权限
        await tx
          .update(users)
          .set({
            permissions: JSON.parse(JSON.stringify(['read', 123, null, 'write', undefined])) as any,
          })
          .where(eq(users.id, user.id));

        // 通过用户名查询
        const service = createServiceWithTx(tx);
        const result = await service.findByUsername(username);

        // 验证只保留字符串元素
        expect(result).toBeDefined();
        expect(result?.permissions).toEqual(['read', 'write']);
      });
    });
  });

  describe('Optional Fields Conversion', () => {
    it('should convert null optional fields to undefined', async () => {
      await withTestTransaction(db, async (tx) => {
        const [dbUser] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname: null,
            email: null,
            avatar: null,
            type: 'viewer',
            permissions: null,
          })
          .returning();

        const service = createServiceWithTx(tx);
        const result = await service.findOne(dbUser.id);

        // 验证所有 null 可选字段转换为 undefined
        expect(result.email).toBeUndefined();
        expect(result.nickname).toBeUndefined();
        expect(result.avatar).toBeUndefined();
        expect(result.permissions).toBeUndefined();
      });
    });

    it('should preserve non-null optional fields', async () => {
      await withTestTransaction(db, async (tx) => {
        const nickname = faker.person.fullName();
        const email = faker.internet.email();
        const avatar = faker.image.url();

        const [dbUser] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname,
            email,
            avatar,
            type: 'editor',
          })
          .returning();

        const service = createServiceWithTx(tx);
        const result = await service.findOne(dbUser.id);

        // 验证非空字段被保留
        expect(result.nickname).toBe(nickname);
        expect(result.email).toBe(email);
        expect(result.avatar).toBe(avatar);
      });
    });
  });

  describe('Integration with Database Queries', () => {
    it('should correctly map multiple users from database', async () => {
      await withTestTransaction(db, async (tx) => {
        // 创建多个不同配置的用户
        const [user1] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname: 'User One',
            email: 'user1@example.com',
            type: 'admin',
            permissions: ['all'],
          })
          .returning();

        const [user2] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname: null, // 测试 null 字段
            email: null,
            type: 'viewer',
            permissions: [],
          })
          .returning();

        const [user3] = await tx
          .insert(users)
          .values({
            username: faker.internet.username(),
            password: faker.internet.password(),
            nickname: 'User Three',
            email: 'user3@example.com',
            type: 'editor',
            permissions: ['read', 'write'],
          })
          .returning();

        // 查询所有用户
        const service = createServiceWithTx(tx);
        const allUsers = await service.findAll();

        // 验证映射结果
        expect(allUsers).toHaveLength(3);

        // User 1: 完整信息
        const result1 = allUsers.find((u) => u.id === user1.id);
        expect(result1).toMatchObject({
          nickname: 'User One',
          email: 'user1@example.com',
          type: 'admin',
          permissions: ['all'],
        });
        expect(result1?.password).toBeUndefined();

        // User 2: null 字段
        const result2 = allUsers.find((u) => u.id === user2.id);
        expect(result2).toMatchObject({
          nickname: undefined,
          email: undefined,
          type: 'viewer',
          permissions: undefined,
        });

        // User 3: 部分权限
        const result3 = allUsers.find((u) => u.id === user3.id);
        expect(result3).toMatchObject({
          nickname: 'User Three',
          email: 'user3@example.com',
          type: 'editor',
          permissions: ['read', 'write'],
        });
      });
    });
  });

  describe('Data Integrity Verification', () => {
    it('should verify database state matches returned entity', async () => {
      await withTestTransaction(db, async (tx) => {
        const username = faker.internet.username();
        const password = faker.internet.password();
        const nickname = faker.person.fullName();
        const email = faker.internet.email();
        const permissions = ['read', 'write', 'delete'];

        // 插入用户
        const [dbUser] = await tx
          .insert(users)
          .values({
            username,
            password,
            nickname,
            email,
            type: 'editor',
            permissions,
          })
          .returning();

        // 通过服务获取
        const service = createServiceWithTx(tx);
        const serviceResult = await service.findOne(dbUser.id);

        // 直接查询数据库
        const [dbResult] = await tx
          .select({
            id: users.id,
            username: users.username,
            nickname: users.nickname,
            email: users.email,
            type: users.type,
            permissions: users.permissions,
          })
          .from(users)
          .where(eq(users.id, dbUser.id));

        // 验证服务结果与数据库一致
        expect(serviceResult.id).toBe(dbResult.id);
        expect(serviceResult.username).toBe(dbResult.username);
        expect(serviceResult.nickname).toBe(dbResult.nickname);
        expect(serviceResult.email).toBe(dbResult.email);
        expect(serviceResult.type).toBe(dbResult.type);
        expect(serviceResult.permissions).toEqual(dbResult.permissions);
      });
    });
  });
});
