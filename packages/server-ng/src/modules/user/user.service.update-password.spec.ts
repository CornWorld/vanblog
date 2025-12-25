/**
 * @fileoverview UserService 密码处理测试
 *
 * 测试场景：
 * - 密码更新与哈希处理
 * - 密码变更后的 Hook 触发（afterPasswordChange）
 * - 密码哈希验证
 *
 * 关联文件：
 * - user.service.spec.ts - 核心 CRUD 操作
 * - user.service.create-advanced.spec.ts - 高级创建场景
 * - user.service.permissions.spec.ts - 权限管理
 * - user.service.entity-mapping.spec.ts - 实体映射
 */

import { Test, type TestingModule } from '@nestjs/testing';
// import { users } from '@vanblog/shared/drizzle';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

import { MockUtils } from '../../../test/mock-utils';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { UserService } from './user.service';

vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('UserService - Update Password', () => {
  let service: UserService;
  let databaseMock: InstanceType<typeof MockUtils.database>;
  let mockHookService: Partial<HookService>;

  beforeEach(async () => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = new MockUtils.database();

    // 创建Hook服务Mock
    mockHookService = {
      applyFilters: vi.fn().mockImplementation((_, data) => data),
      doAction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DATABASE_CONNECTION,
          useValue: databaseMock.db,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    databaseMock.reset();
  });

  describe('Password Hashing', () => {
    it('should hash password when updating password', async () => {
      const updateData = {
        password: 'newpassword123',
      };

      mockedBcrypt.hash.mockResolvedValue('newHashedPassword' as never);

      const updatedDbUser = {
        id: 1,
        username: 'testuser',
        nickname: null,
        email: null,
        avatar: null,
        type: 'admin',
        permissions: null,
        password: 'newHashedPassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([updatedDbUser]);

      await service.update(1, updateData);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(mockHookService.doAction).toHaveBeenCalledWith('user|afterPasswordChange', {
        userId: 1,
        username: 'testuser',
      });
    });
  });

  describe('afterPasswordChange Hook', () => {
    it('should trigger afterPasswordChange hook when password changed', async () => {
      const updateData = {
        password: 'newpassword123',
        nickname: 'Updated',
      };

      mockedBcrypt.hash.mockResolvedValue('newHashedPassword' as never);

      const updatedDbUser = {
        id: 1,
        username: 'testuser',
        nickname: 'Updated',
        email: null,
        avatar: null,
        type: 'admin',
        permissions: null,
        password: 'newHashedPassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([updatedDbUser]);

      await service.update(1, updateData);

      expect(mockHookService.doAction).toHaveBeenCalledWith('user|afterPasswordChange', {
        userId: 1,
        username: 'testuser',
      });
    });

    it('should not trigger afterPasswordChange hook when password not changed', async () => {
      const updateData = {
        nickname: 'Updated',
      };

      const updatedDbUser = {
        id: 1,
        username: 'testuser',
        nickname: 'Updated',
        email: null,
        avatar: null,
        type: 'admin',
        permissions: null,
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([updatedDbUser]);

      await service.update(1, updateData);

      expect(mockHookService.doAction).not.toHaveBeenCalledWith(
        'user|afterPasswordChange',
        expect.any(Object),
      );
    });
  });
});
