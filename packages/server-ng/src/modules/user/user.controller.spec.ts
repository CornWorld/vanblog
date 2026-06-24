import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { Mock } from '@test/mock';
import { PermissionService } from '../permission/permission.service';

import { UserType } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

import type { UpdateUserDto } from './dto/update-user.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  // Use Mock to create service mocks
  const mockUserService = Mock.userService();
  const mockPermissionService = Mock.permission();

  // Use MockUtils to create test user data
  const mockUser = new User({
    id: 1,
    username: 'testuser',
    password: 'hashedPassword',
    nickname: 'Test User',
    email: 'test@example.com',
    avatar: undefined,
    type: UserType.ADMIN,
    permissions: [],
    createdAt: dayjs().format(),
    updatedAt: dayjs().format(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user with valid data', async () => {
      const createUserDto = {
        username: 'testuser',
        password: 'TestPassword123!',
        nickname: 'Test User',
        email: 'test@example.com',
        type: UserType.ADMIN,
        permissions: ['user:read', 'user:write'],
      };

      mockUserService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(mockUserService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockUserService.findAll.mockResolvedValue([mockUser]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockUser]);
    });

    it('should return empty array when no users exist', async () => {
      mockUserService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should return multiple users with different types', async () => {
      const users = [
        mockUser,
        new User({
          id: 2,
          username: 'editor',
          type: UserType.EDITOR,
          createdAt: dayjs().format(),
          updatedAt: dayjs().format(),
        }),
        new User({
          id: 3,
          username: 'viewer',
          type: UserType.VIEWER,
          createdAt: dayjs().format(),
          updatedAt: dayjs().format(),
        }),
      ];

      mockUserService.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe(UserType.ADMIN);
      expect(result[1].type).toBe(UserType.EDITOR);
      expect(result[2].type).toBe(UserType.VIEWER);
    });
  });

  describe('getCollaborators', () => {
    it('should return all collaborators (non-admin users)', async () => {
      const mockCollaborators = [
        new User({
          id: 2,
          username: 'editor1',
          nickname: 'Editor One',
          type: UserType.EDITOR,
          createdAt: dayjs().format(),
          updatedAt: dayjs().format(),
        }),
        new User({
          id: 3,
          username: 'editor2',
          nickname: 'Editor Two',
          type: UserType.EDITOR,
          createdAt: dayjs().format(),
          updatedAt: dayjs().format(),
        }),
      ];

      mockUserService.getCollaborators.mockResolvedValue(mockCollaborators);

      const result = await controller.getCollaborators();

      expect(service.getCollaborators).toHaveBeenCalled();
      expect(result).toEqual(mockCollaborators);
      expect(result.every((u) => u.type !== UserType.ADMIN)).toBe(true);
    });

    it('should return empty array when no collaborators exist', async () => {
      mockUserService.getCollaborators.mockResolvedValue([]);

      const result = await controller.getCollaborators();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a user by valid ID', async () => {
      mockUserService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('1');

      expect(mockUserService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException for invalid ID format', async () => {
      await expect(controller.findOne('invalid')).rejects.toThrow(BadRequestException);
      await expect(controller.findOne('invalid')).rejects.toThrow('Invalid user id');
    });

    it('should throw BadRequestException for NaN ID', async () => {
      await expect(controller.findOne('abc')).rejects.toThrow(BadRequestException);
    });

    it('should pass float ID as-is (not truncated) with explicit validation', async () => {
      // parseInt('1.5', 10) becomes 1 (truncates decimals)
      const floatUser = new User({
        id: 1,
        username: 'test',
        type: UserType.EDITOR,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(floatUser);

      const result = await controller.findOne('1.5');
      // parseInt('1.5', 10) = 1, truncates decimals
      expect(mockUserService.findOne).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
    });

    it('should validate and pass negative IDs explicitly', async () => {
      const negativeId = -1;
      const negativeUser = new User({
        id: negativeId,
        username: 'negative-id-user',
        type: UserType.EDITOR,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(negativeUser);

      // Ensure Number('-1') correctly converts to -1
      const result = await controller.findOne('-1');
      expect(mockUserService.findOne).toHaveBeenCalledWith(-1);
      expect(result.id).toBe(-1);
    });

    it('should reject non-numeric ID with explicit message', async () => {
      // Note: parseInt('1a2b', 10) = 1, so we use strings that truly return NaN
      const invalidIds = ['abc', 'xyz123', 'test'];

      for (const invalidId of invalidIds) {
        await expect(controller.findOne(invalidId)).rejects.toThrow(BadRequestException);
        await expect(controller.findOne(invalidId)).rejects.toThrow('Invalid user id');
      }
    });

    it('should reject hyphenated string ID', async () => {
      // 'id-1' with parseInt returns NaN, should be rejected
      await expect(controller.findOne('id-1')).rejects.toThrow(BadRequestException);
      await expect(controller.findOne('id-1')).rejects.toThrow('Invalid user id');
    });

    it('should handle decimal precision for float IDs', async () => {
      const floatUser = new User({
        id: 1,
        username: 'float-test',
        type: UserType.EDITOR,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(floatUser);

      // Test with multiple decimal places - parseInt truncates to 1
      const result = await controller.findOne('1.99999');
      expect(mockUserService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(floatUser);
    });

    it('should handle very large ID', async () => {
      const largeIdUser = new User({
        id: 999999999,
        username: 'test',
        type: UserType.EDITOR,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(largeIdUser);

      const result = await controller.findOne('999999999');
      expect(result).toEqual(largeIdUser);
    });
  });

  describe('update', () => {
    it('should update a user with valid data', async () => {
      const updateUserDto: UpdateUserDto = {
        nickname: 'Updated User',
      } as UpdateUserDto;
      const updatedUser = new User({
        id: mockUser.id,
        username: mockUser.username,
        password: mockUser.password,
        nickname: 'Updated User',
        email: mockUser.email,
        avatar: mockUser.avatar,
        type: mockUser.type,
        permissions: mockUser.permissions,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('1', updateUserDto);

      expect(service.update).toHaveBeenCalledWith(1, updateUserDto);
      expect(result).toEqual(updatedUser);
    });

    it('should update user email', async () => {
      const updateDto = {
        email: 'newemail@example.com',
      };

      const updatedUser = new User({
        id: mockUser.id,
        username: mockUser.username,
        password: mockUser.password,
        nickname: mockUser.nickname,
        email: 'newemail@example.com',
        avatar: mockUser.avatar,
        type: mockUser.type,
        permissions: mockUser.permissions,
        createdAt: mockUser.createdAt,
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('1', updateDto);

      expect(result.email).toBe('newemail@example.com');
    });

    it('should update user permissions', async () => {
      const updateDto = {
        permissions: ['article:create', 'article:delete'],
      };

      const updatedUser = new User({
        id: mockUser.id,
        username: mockUser.username,
        password: mockUser.password,
        nickname: mockUser.nickname,
        email: mockUser.email,
        avatar: mockUser.avatar,
        type: mockUser.type,
        permissions: ['article:create', 'article:delete'],
        createdAt: mockUser.createdAt,
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('1', updateDto);

      expect(result.permissions).toEqual(['article:create', 'article:delete']);
    });

    it('should update user avatar', async () => {
      const updateDto = {
        avatar: 'https://example.com/avatar.png',
      };

      const updatedUser = new User({
        id: mockUser.id,
        username: mockUser.username,
        password: mockUser.password,
        nickname: mockUser.nickname,
        email: mockUser.email,
        avatar: 'https://example.com/avatar.png',
        type: mockUser.type,
        permissions: mockUser.permissions,
        createdAt: mockUser.createdAt,
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('1', updateDto);

      expect(result.avatar).toBe('https://example.com/avatar.png');
    });

    it('should throw BadRequestException for invalid ID', async () => {
      const updateDto = { nickname: 'Test' };

      await expect(controller.update('invalid', updateDto)).rejects.toThrow(BadRequestException);
      await expect(controller.update('invalid', updateDto)).rejects.toThrow('Invalid user id');
    });

    it('should throw BadRequestException for invalid update data', async () => {
      const invalidDto = {
        email: 'not-an-email',
      };

      await expect(controller.update('1', invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException from service', async () => {
      const updateDto = { nickname: 'Test' };
      mockUserService.update.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.update('1', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should update multiple fields at once', async () => {
      const updateDto = {
        nickname: 'New Name',
        email: 'new@example.com',
        avatar: 'https://example.com/new.png',
      };

      const updatedUser = new User({
        id: mockUser.id,
        username: mockUser.username,
        password: mockUser.password,
        nickname: 'New Name',
        email: 'new@example.com',
        avatar: 'https://example.com/new.png',
        type: mockUser.type,
        permissions: mockUser.permissions,
        createdAt: mockUser.createdAt,
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('1', updateDto);

      expect(result.nickname).toBe('New Name');
      expect(result.email).toBe('new@example.com');
      expect(result.avatar).toBe('https://example.com/new.png');
    });
  });

  describe('getProfile', () => {
    it('should return current user profile from request', () => {
      const mockRequest = {
        user: mockUser,
      } as any;

      const result = controller.getProfile(mockRequest);

      expect(result).toEqual(mockUser);
    });

    it('should handle user with permissions in request', () => {
      const userWithPerms = new User({
        id: mockUser.id,
        username: mockUser.username,
        password: mockUser.password,
        nickname: mockUser.nickname,
        email: mockUser.email,
        avatar: mockUser.avatar,
        type: mockUser.type,
        permissions: ['article:create', 'article:read'],
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });

      const mockRequest = {
        user: userWithPerms,
      } as any;

      const result = controller.getProfile(mockRequest);

      expect(result.permissions).toEqual(['article:create', 'article:read']);
    });

    it('should handle user without optional fields', () => {
      const minimalUser = new User({
        id: 1,
        username: 'minimal',
        type: UserType.VIEWER,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      const mockRequest = {
        user: minimalUser,
      } as any;

      const result = controller.getProfile(mockRequest);

      expect(result.nickname).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.avatar).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      mockUserService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: '用户删除成功' });
    });

    it('should throw BadRequestException for invalid ID', async () => {
      await expect(controller.remove('invalid')).rejects.toThrow(BadRequestException);
      await expect(controller.remove('invalid')).rejects.toThrow('Invalid user id');
    });

    it('should propagate NotFoundException from service', async () => {
      mockUserService.remove.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('should truncate float ID to integer', async () => {
      mockUserService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('1.5');
      // parseInt('1.5', 10) = 1, truncates decimals
      expect(mockUserService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: '用户删除成功' });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty string for user ID in findOne', async () => {
      // After trim, empty string is invalid - should throw BadRequestException
      await expect(controller.findOne('')).rejects.toThrow(BadRequestException);
      await expect(controller.findOne('')).rejects.toThrow('Invalid user id');
    });

    it('should handle whitespace-only string for user ID', async () => {
      // After trim, whitespace-only string is invalid - should throw BadRequestException
      await expect(controller.findOne('   ')).rejects.toThrow(BadRequestException);
      await expect(controller.findOne('   ')).rejects.toThrow('Invalid user id');
    });

    it('should handle user with minimal required fields', async () => {
      const minimalUser = new User({
        id: 1,
        username: 'minimaluser',
        type: UserType.VIEWER,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(minimalUser);

      const result = await controller.findOne('1');

      expect(result.nickname).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.avatar).toBeUndefined();
      expect(result.permissions).toEqual([]);
    });

    it('should allow update with empty object (optional fields)', async () => {
      // UpdateUserSchema allows all fields to be optional
      const updatedUser = new User({
        id: mockUser.id,
        username: mockUser.username,
        password: mockUser.password,
        nickname: mockUser.nickname,
        email: mockUser.email,
        avatar: mockUser.avatar,
        type: mockUser.type,
        permissions: mockUser.permissions,
        createdAt: mockUser.createdAt,
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('1', {});
      expect(result).toEqual(updatedUser);
    });
  });
});
