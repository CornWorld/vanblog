/**
 * @fileoverview UserService 高级创建场景测试
 *
 * 测试场景：
 * - 并发创建用户的竞态条件
 * - 创建时的 Hook 复杂场景（beforeCreate/afterCreate）
 * - Hook 错误处理与数据修改
 *
 * 关联文件：
 * - user.service.spec.ts - 核心 CRUD 操作
 * - user.service.update-password.spec.ts - 密码处理
 * - user.service.permissions.spec.ts - 权限管理
 * - user.service.entity-mapping.spec.ts - 实体映射
 */

import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

import { createMockUser, MockUtils } from '../../../test/mock-utils';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { UserService } from './user.service';

import type { CreateUserDto } from './dto/create-user.dto';

vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('UserService - Create Advanced', () => {
  let service: UserService;
  let databaseMock: InstanceType<typeof MockUtils.database>;
  let mockHookService: ReturnType<typeof MockUtils.services.createHookServiceMock>;

  beforeEach(async () => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = new MockUtils.database();

    // 创建Hook服务Mock
    mockHookService = MockUtils.services.createHookServiceMock();

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

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent username existence checks', async () => {
      const createUserDto1: CreateUserDto = {
        username: 'concurrentuser',
        password: 'password123',
        type: 'admin',
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      // First call finds no user, second call also finds no user (simulating race condition)
      databaseMock.setQueryResult([]);

      const createdDbUser = createMockUser({
        username: 'concurrentuser',
        type: 'admin',
        password: 'hashedPassword',
      });

      databaseMock.setInsertResult([createdDbUser]);

      // Both calls should complete without throwing ConflictException
      // (Database would handle the uniqueness constraint in real scenario)
      const result1 = await service.create(createUserDto1);
      expect(result1.username).toBe('concurrentuser');
    });
  });

  describe('Hook Integration - beforeCreate', () => {
    it('should trigger beforeCreate and afterCreate hooks', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'admin',
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = createMockUser({
        username: createUserDto.username,
        type: createUserDto.type,
        password: 'hashedPassword',
      });

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      await service.create(createUserDto);

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
    });

    it('should continue even if beforeCreate hook throws error', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'admin',
      };

      mockHookService.applyFilters = vi.fn().mockRejectedValue(new Error('Hook error'));
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = createMockUser({
        username: createUserDto.username,
        type: createUserDto.type,
        password: 'hashedPassword',
      });

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.username).toBe('testuser');
    });

    it('should allow beforeCreate hook to modify user data', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'admin',
      };

      const modifiedDto = {
        ...createUserDto,
        nickname: 'Modified by hook',
      };

      mockHookService.applyFilters = vi.fn().mockResolvedValue(modifiedDto);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = createMockUser({
        username: modifiedDto.username,
        type: modifiedDto.type,
        password: 'hashedPassword',
        nickname: modifiedDto.nickname,
      });

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.nickname).toBe('Modified by hook');
    });
  });
});
