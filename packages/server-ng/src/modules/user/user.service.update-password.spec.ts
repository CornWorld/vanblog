/**
 * @fileoverview UserService 密码处理测试
 *
 * 测试场景：
 * - 密码更新与哈希处理
 * - 密码变更后的 Hook 触发（afterPasswordChange）
 * - 密码哈希验证
 *
 * 迁移说明：
 * - 使用真实数据库 + withTestTransaction 进行测试
 * - 保留 bcrypt Mock（外部依赖）
 * - 保留 HookService Mock
 *
 * 关联文件：
 * - user.service.spec.ts - 核心 CRUD 操作
 * - user.service.create-advanced.spec.ts - 高级创建场景
 * - user.service.permissions.spec.ts - 权限管理
 * - user.service.entity-mapping.spec.ts - 实体映射
 */

import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { Mock } from '@test/mock';
import { Given } from '@test/given';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';
import { users } from '@vanblog/shared/drizzle';

import { UserService } from './user.service';

vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('UserService - Update Password', () => {
  let service: UserService;
  let mockHookService: ReturnType<typeof Mock.hook>;

  beforeAll(async () => {
    // 创建Hook服务Mock
    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Password Hashing', () => {
    it('should hash password when updating password', async () => {
      await withTestTransaction(db, async (tx) => {
        // 注入事务数据库
        (service as any)['db'] = tx;

        // 创建测试用户
        const user = await Given.user(db as any, {
          username: 'testuser',
          password: 'oldHashedPassword',
          type: 'admin',
        });

        const updateData = {
          password: 'newpassword123',
        };

        mockedBcrypt.hash.mockResolvedValue('newHashedPassword' as never);

        await service.update(user.id, updateData);

        // 验证 bcrypt.hash 被调用
        expect(mockedBcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);

        // 验证数据库持久化
        const [saved] = await tx.select().from(users).where(eq(users.id, user.id));
        expect(saved.password).toBe('newHashedPassword');

        // 验证 Hook 触发
        expect(mockHookService.doAction).toHaveBeenCalledWith('user|afterPasswordChange', {
          userId: user.id,
          username: 'testuser',
        });
      });
    });
  });

  describe('afterPasswordChange Hook', () => {
    it('should trigger afterPasswordChange hook when password changed', async () => {
      await withTestTransaction(db, async (tx) => {
        // 注入事务数据库
        (service as any)['db'] = tx;

        // 创建测试用户
        const user = await Given.user(db as any, {
          username: 'testuser',
          password: 'oldHashedPassword',
          nickname: 'Old Nickname',
          type: 'admin',
        });

        const updateData = {
          password: 'newpassword123',
          nickname: 'Updated',
        };

        mockedBcrypt.hash.mockResolvedValue('newHashedPassword' as never);

        await service.update(user.id, updateData);

        // 验证数据库更新
        const [saved] = await tx.select().from(users).where(eq(users.id, user.id));
        expect(saved.nickname).toBe('Updated');
        expect(saved.password).toBe('newHashedPassword');

        // 验证 Hook 触发
        expect(mockHookService.doAction).toHaveBeenCalledWith('user|afterPasswordChange', {
          userId: user.id,
          username: 'testuser',
        });
      });
    });

    it('should not trigger afterPasswordChange hook when password not changed', async () => {
      await withTestTransaction(db, async (tx) => {
        // 注入事务数据库
        (service as any)['db'] = tx;

        // 创建测试用户
        const [user] = await tx
          .insert(users)
          .values({
            username: 'testuser',
            password: 'hashedPassword',
            nickname: 'Old Nickname',
            type: 'admin',
          })
          .returning();

        const updateData = {
          nickname: 'Updated',
        };

        await service.update(user.id, updateData);

        // 验证数据库更新
        const [saved] = await tx.select().from(users).where(eq(users.id, user.id));
        expect(saved.nickname).toBe('Updated');
        expect(saved.password).toBe('hashedPassword'); // 密码未改变

        // 验证 Hook 未触发
        expect(mockHookService.doAction).not.toHaveBeenCalledWith(
          'user|afterPasswordChange',
          expect.any(Object),
        );
      });
    });
  });
});
