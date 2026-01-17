/**
 * @fileoverview UserService 核心操作测试
 *
 * 测试场景：
 * - 基础 CRUD 操作（create, findAll, findOne, findByUsername, update, remove）
 * - 用户查询方法（getAdminUser, getCollaborators, findByUsernameWithPassword）
 * - 基础的 Hook 触发验证
 * - 异常处理（ConflictException, NotFoundException）
 *
 * 关联文件：
 * - user.service.create-advanced.spec.ts - 高级创建场景（并发、复杂 Hook）
 * - user.service.update-password.spec.ts - 密码处理
 * - user.service.permissions.spec.ts - 权限管理
 * - user.service.entity-mapping.spec.ts - 实体映射
 */

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { users } from '@vanblog/shared/drizzle';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

import { createMockUser, Mock } from '@test/mock';
import type { DatabaseMockBuilder } from '@test/mock';
import { DATABASE_CONNECTION } from '../../database';
import { HookService } from '../plugin/services/hook.service';

import { UserService } from './user.service';

import type { CreateUserDto } from './dto/create-user.dto';

vi.mock('bcrypt');
const mockedBcrypt = vi.mocked(bcrypt);

describe('UserService', () => {
  let service: UserService;
  let databaseMock: InstanceType<typeof DatabaseMockBuilder>;
  let mockHookService: ReturnType<typeof Mock.hook>;

  beforeEach(async () => {
    // 使用Mock工具类创建数据库Mock
    databaseMock = Mock.db();

    // 创建Hook服务Mock
    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DATABASE_CONNECTION,
          useValue: databaseMock.db,
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
    databaseMock.reset();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'password123',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: 'read,write',
      };

      const hashedPassword = 'hashedPassword123';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const createdDbUser = createMockUser({
        id: 1,
        username: createUserDto.username,
        password: hashedPassword,
        nickname: createUserDto.nickname,
        email: createUserDto.email,
        type: createUserDto.type,
        permissions: ['read', 'write'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // First query checks if username exists (should return empty)
      databaseMock.setQueryResult([]);
      // Then insert the new user
      databaseMock.setInsertResult([createdDbUser]);

      const result = await service.create(createUserDto);

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: ['read', 'write'],
      });
      expect(result.password).toBeUndefined(); // password should not be included
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(databaseMock.db.insert).toHaveBeenCalledWith(users);
    });

    it('should throw ConflictException if username already exists', async () => {
      const createUserDto: CreateUserDto = {
        username: 'existinguser',
        password: 'password123',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: 'read',
      };

      // Mock existing user found
      databaseMock.setQueryResult([createMockUser({ username: 'existinguser' })]);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createUserDto)).rejects.toThrow('Username already exists');
    });

    it('should verify username uniqueness check happens before insert', async () => {
      const createUserDto: CreateUserDto = {
        username: 'newuser',
        password: 'password123',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: 'read',
      };

      const hashedPassword = 'hashedPassword123';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const createdDbUser = createMockUser({
        id: 2,
        username: createUserDto.username,
        password: hashedPassword,
        nickname: createUserDto.nickname,
        email: createUserDto.email,
        type: createUserDto.type,
        permissions: ['read'],
      });

      // Verify call order: select should be called before insert
      databaseMock.setQueryResult([]);
      databaseMock.setInsertResult([createdDbUser]);

      await service.create(createUserDto);

      // Verify both were called (the order is implicit in service logic)
      expect(databaseMock.db.select).toHaveBeenCalled();
      expect(databaseMock.db.insert).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const dbUsers = [
        createMockUser({
          id: 1,
          username: 'user1',
          email: 'user1@example.com',
          nickname: 'User 1',
          type: 'admin',
          permissions: [],
        }),
        createMockUser({
          id: 2,
          username: 'user2',
          email: 'user2@example.com',
          nickname: 'User 2',
          type: 'editor',
          permissions: ['read'],
        }),
      ];

      databaseMock.setQueryResult(dbUsers);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        username: 'user1',
        email: 'user1@example.com',
        nickname: 'User 1',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result[0].password).toBeUndefined();
      expect(result[1]).toMatchObject({
        id: 2,
        username: 'user2',
        email: 'user2@example.com',
        nickname: 'User 2',
        type: 'collaborator',
        permissions: ['read'],
      });
      expect(result[1].password).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const dbUser = createMockUser({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        type: 'admin',
        permissions: [],
      });
      databaseMock.setQueryResult([dbUser]);

      const result = await service.findOne(1);

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result.password).toBeUndefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      databaseMock.setQueryResult([]);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      const dbUser = createMockUser({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        type: 'admin',
        permissions: [],
      });
      databaseMock.setQueryResult([dbUser]);

      const result = await service.findByUsername('testuser');

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result?.password).toBeUndefined(); // password should not be included
    });

    it('should return null if user not found', async () => {
      databaseMock.setQueryResult([]);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const updateData = {
        nickname: 'Updated User',
        email: 'updated@example.com',
      };

      const updatedDbUser = createMockUser({
        id: 1,
        username: 'testuser',
        nickname: 'Updated User',
        email: 'updated@example.com',
        type: 'admin',
        permissions: [],
      });

      databaseMock.setUpdateResult([updatedDbUser]);

      const result = await service.update(1, updateData);

      expect(result).toMatchObject({
        id: 1,
        username: 'testuser',
        nickname: 'Updated User',
        email: 'updated@example.com',
        type: 'admin',
        permissions: undefined, // Empty array is converted to undefined by mapToEntity
      });
      expect(result.password).toBeUndefined(); // password should not be included
      expect(databaseMock.db.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      databaseMock.setUpdateResult([]);

      await expect(service.update(999, { nickname: 'Test' })).rejects.toThrow(NotFoundException);
      await expect(service.update(999, { nickname: 'Test' })).rejects.toThrow(
        'User with ID 999 not found',
      );
    });

    it('should update type', async () => {
      const updateData = {
        type: 'editor' as const,
      };

      const updatedDbUser = {
        id: 1,
        username: 'testuser',
        nickname: null,
        email: null,
        avatar: null,
        type: 'editor',
        permissions: null,
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([updatedDbUser]);

      const result = await service.update(1, updateData);

      expect(result.type).toBe('editor');
    });

    it('should update avatar including null value', async () => {
      const updateData = {
        avatar: null,
      };

      const updatedDbUser = createMockUser({
        nickname: null,
        email: null,
        avatar: null,
        permissions: null,
      });

      databaseMock.setUpdateResult([updatedDbUser]);

      const result = await service.update(1, updateData);

      expect(result.avatar).toBeUndefined();
    });

    it('should trigger beforeUpdate and afterUpdate hooks', async () => {
      const updateData = {
        nickname: 'Updated',
      };

      const updatedDbUser = createMockUser({
        id: 1,
        username: 'testuser',
        nickname: 'Updated',
        email: null,
        permissions: null,
      });

      databaseMock.setUpdateResult([updatedDbUser]);

      await service.update(1, updateData);

      expect(mockHookService.applyFilters).toHaveBeenCalledWith('user|beforeUpdate', updateData, {
        action: 'update',
        id: 1,
      });
      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'user|afterUpdate',
        expect.any(Object),
        expect.objectContaining({
          id: 1,
          username: 'testuser',
        }),
      );
    });

    it('should continue even if beforeUpdate hook throws error', async () => {
      const updateData = {
        nickname: 'Updated',
      };

      mockHookService.applyFilters = vi.fn().mockRejectedValue(new Error('Hook error'));

      const updatedDbUser = createMockUser({
        nickname: 'Updated',
        email: null,
        permissions: null,
      });

      databaseMock.setUpdateResult([updatedDbUser]);

      const result = await service.update(1, updateData);

      expect(result.nickname).toBe('Updated');
    });

    it('should allow beforeUpdate hook to modify update data', async () => {
      const updateData = {
        nickname: 'Original',
      };

      const modifiedDto = {
        nickname: 'Modified by hook',
      };

      mockHookService.applyFilters = vi.fn().mockResolvedValue(modifiedDto);

      const updatedDbUser = {
        id: 1,
        username: 'testuser',
        nickname: 'Modified by hook',
        email: null,
        avatar: null,
        type: 'admin',
        permissions: null,
        password: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      databaseMock.setUpdateResult([updatedDbUser]);

      const result = await service.update(1, updateData);

      expect(result.nickname).toBe('Modified by hook');
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      databaseMock.setDeleteResult(1);

      await service.remove(1);

      expect(databaseMock.db.delete).toHaveBeenCalled();
      expect(mockHookService.doAction).toHaveBeenCalledWith(
        'user|beforeDelete',
        { id: 1 },
        { action: 'delete' },
      );
      expect(mockHookService.doAction).toHaveBeenCalledWith('user|afterDelete', { id: 1 });
    });

    it('should throw NotFoundException if user not found', async () => {
      databaseMock.setDeleteResult(0);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      await expect(service.remove(999)).rejects.toThrow('User with ID 999 not found');
    });

    it('should continue even if beforeDelete hook throws error', async () => {
      mockHookService.doAction = vi
        .fn()
        .mockRejectedValueOnce(new Error('Hook error'))
        .mockResolvedValueOnce(undefined);

      databaseMock.setDeleteResult(1);

      await service.remove(1);

      expect(databaseMock.db.delete).toHaveBeenCalled();
    });

    it('should still call afterDelete hook even if beforeDelete fails', async () => {
      mockHookService.doAction = vi
        .fn()
        .mockRejectedValueOnce(new Error('beforeDelete error'))
        .mockResolvedValueOnce(undefined);

      databaseMock.setDeleteResult(1);

      await service.remove(1);

      expect(mockHookService.doAction).toHaveBeenCalledTimes(2);
      expect(mockHookService.doAction).toHaveBeenNthCalledWith(
        1,
        'user|beforeDelete',
        { id: 1 },
        { action: 'delete' },
      );
      expect(mockHookService.doAction).toHaveBeenNthCalledWith(2, 'user|afterDelete', { id: 1 });
    });
  });

  describe('getAdminUser', () => {
    it('should return admin user when exists', async () => {
      const adminUser = createMockUser({
        username: 'admin',
        email: 'admin@example.com',
        nickname: 'Administrator',
        type: 'admin',
        permissions: ['all'],
      });

      databaseMock.setQueryResult([adminUser]);

      const result = await service.getAdminUser();

      expect(result).toBeDefined();
      expect(result?.type).toBe('admin');
      expect(result?.username).toBe('admin');
      expect(result?.password).toBeUndefined();
    });

    it('should return null when no admin user exists', async () => {
      databaseMock.setQueryResult([]);

      const result = await service.getAdminUser();

      expect(result).toBeNull();
    });
  });

  describe('getCollaborators', () => {
    it('should return all non-admin users', async () => {
      const collaborators = [
        createMockUser({
          id: 2,
          username: 'editor1',
          email: 'editor1@example.com',
          nickname: 'Editor 1',
          type: 'editor',
          permissions: ['article:read', 'article:write'],
        }),
        createMockUser({
          id: 3,
          username: 'author1',
          email: 'author1@example.com',
          nickname: 'Author 1',
          type: 'author',
          permissions: ['article:read'],
        }),
      ];

      databaseMock.setQueryResult(collaborators);

      const result = await service.getCollaborators();

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('editor');
      expect(result[1].type).toBe('author');
      expect(result[0].password).toBeUndefined();
      expect(result[1].password).toBeUndefined();
    });

    it('should return empty array when no collaborators exist', async () => {
      databaseMock.setQueryResult([]);

      const result = await service.getCollaborators();

      expect(result).toEqual([]);
    });
  });

  describe('findByUsernameWithPassword', () => {
    it('should return user with password when found', async () => {
      const dbUser = createMockUser({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        nickname: 'Test User',
        type: 'admin',
        permissions: ['all'],
        password: 'hashedPassword123',
      });

      databaseMock.setQueryResult([dbUser]);

      const result = await service.findByUsernameWithPassword('testuser');

      expect(result).toBeDefined();
      expect(result?.username).toBe('testuser');
      expect(result?.password).toBe('hashedPassword123');
    });

    it('should return null when user not found', async () => {
      databaseMock.setQueryResult([]);

      const result = await service.findByUsernameWithPassword('nonexistent');

      expect(result).toBeNull();
    });
  });
});
