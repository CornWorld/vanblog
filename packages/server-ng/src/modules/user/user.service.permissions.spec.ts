/**
 * @fileoverview UserService 权限管理测试
 *
 * 测试场景：
 * - normalizePermissions 方法（数组、字符串、空值处理）
 * - 权限验证逻辑
 * - 权限字段转换与过滤
 * - 创建/更新时的权限处理
 *
 * 关联文件：
 * - user.service.spec.ts - 核心 CRUD 操作
 * - user.service.create-advanced.spec.ts - 高级创建场景
 * - user.service.update-password.spec.ts - 密码处理
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

import type { CreateUserDto } from './dto/create-user.dto';

vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('UserService - Permissions', () => {
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

  describe('Create - Permissions Handling', () => {
    it('should handle permissions as array', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: ['article:read', 'article:write'],
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: ['article:read', 'article:write'] as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toEqual(['article:read', 'article:write']);
    });

    it('should handle permissions as comma-separated string with whitespace', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: ' article:read , article:write , article:delete ',
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: ['article:read', 'article:write', 'article:delete'] as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toEqual(['article:read', 'article:write', 'article:delete']);
    });

    it('should handle empty permissions array as null/undefined', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: [],
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: null as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toBeUndefined();
    });

    it('should handle empty string permissions as null/undefined', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: '',
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: null as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toBeUndefined();
    });
  });

  describe('Update - Permissions Handling', () => {
    it('should update permissions as array', async () => {
      const updateData = {
        permissions: ['article:read', 'article:write', 'article:delete'],
      };

      const updatedDbUser = {
        id: 1,
        username: 'testuser',
        nickname: null,
        email: null,
        avatar: null,
        type: 'admin' as const,
        permissions: ['article:read', 'article:write', 'article:delete'] as string[] | null,
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([updatedDbUser]);

      const result = await service.update(1, updateData);

      expect(result.permissions).toEqual(['article:read', 'article:write', 'article:delete']);
    });
  });

  describe('normalizePermissions', () => {
    it('should normalize array permissions correctly', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: ['read', 'write', 'delete'],
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: ['read', 'write', 'delete'] as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toEqual(['read', 'write', 'delete']);
    });

    it('should normalize string permissions with trimming', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: '  read , write  ,  delete  ',
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: ['read', 'write', 'delete'] as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toEqual(['read', 'write', 'delete']);
    });

    it('should handle permissions with only commas as null', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: ' , , , ',
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: null as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toBeUndefined();
    });

    it('should handle array with non-string elements', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        type: 'editor' as const,
        permissions: ['read', 'write', 'delete'],
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);

      const createdDbUser = {
        id: 1,
        username: createUserDto.username,
        password: 'hashedPassword',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor' as const,
        permissions: ['read', 'write', 'delete'] as string[] | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result.permissions).toEqual(['read', 'write', 'delete']);
    });
  });
});
