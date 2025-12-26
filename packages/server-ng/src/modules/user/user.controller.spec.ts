import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { PermissionService } from '../permission/permission.service';

import { UserType, type CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

import type { UpdateUserDto } from './dto/update-user.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

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

  const mockUserService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getCollaborators: vi.fn(),
  };

  const mockPermissionService = {
    hasPermission: vi.fn(),
    getUserPermissions: vi.fn(),
    checkPermissions: vi.fn(),
  };

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
      const createUserDto: CreateUserDto = {
        username: 'testuser',
        password: 'TestPassword123!',
        nickname: 'Test User',
        email: 'test@example.com',
        type: 'admin',
        permissions: ['user:read', 'user:write'],
      } as unknown as CreateUserDto;

      mockUserService.create.mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(service.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException for invalid data', async () => {
      const invalidDto = {
        username: '',
        password: 'short',
      };

      await expect(controller.create(invalidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing required fields', async () => {
      const invalidDto = {
        username: 'testuser',
      };

      await expect(controller.create(invalidDto)).rejects.toThrow(BadRequestException);
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

      expect(service.findOne).toHaveBeenCalledWith(1);
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
      // Number('1.5') becomes 1.5 and is passed to service as 1.5
      const floatUser = new User({
        id: 1,
        username: 'test',
        type: UserType.EDITOR,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(floatUser);

      const result = await controller.findOne('1.5');
      // Number('1.5') = 1.5, passed as-is
      expect(service.findOne).toHaveBeenCalledWith(1.5);
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
      expect(service.findOne).toHaveBeenCalledWith(-1);
      expect(result.id).toBe(-1);
    });

    it('should reject non-numeric ID with explicit message', async () => {
      const invalidIds = ['abc123', 'test', '1a2b', 'id-1'];

      for (const invalidId of invalidIds) {
        await expect(controller.findOne(invalidId)).rejects.toThrow(BadRequestException);
        await expect(controller.findOne(invalidId)).rejects.toThrow('Invalid user id');
      }
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

      // Test with multiple decimal places
      const result = await controller.findOne('1.99999');
      expect(service.findOne).toHaveBeenCalledWith(1.99999);
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

    it('should pass float ID as-is (not truncated)', async () => {
      mockUserService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('1.5');
      // Number('1.5') = 1.5, passed as-is
      expect(service.remove).toHaveBeenCalledWith(1.5);
      expect(result).toEqual({ message: '用户删除成功' });
    });
  });

  describe('updateProfile (ts-rest handler)', () => {
    it('should update current user profile', async () => {
      const mockRequest = {
        user: { id: 1 },
      } as any;

      const updateDto = {
        nickname: 'New Nickname',
        email: 'newemail@example.com',
      };

      const mockUpdatedUser = new User({
        id: 1,
        username: 'testuser',
        nickname: 'New Nickname',
        email: 'newemail@example.com',
        type: UserType.EDITOR,
        permissions: [],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      const handler = controller.updateProfile(mockRequest) as unknown as (
        ctx: any,
      ) => Promise<any>;
      const result = await handler({ body: updateDto });

      expect(service.update).toHaveBeenCalledWith(1, {
        nickname: 'New Nickname',
        email: 'newemail@example.com',
        password: undefined,
        avatar: undefined,
      });
      expect(result.status).toBe(200);
      expect(result.body.nickname).toBe('New Nickname');
      expect(result.body.email).toBe('newemail@example.com');
    });

    it('should update profile with password', async () => {
      const mockRequest = {
        user: { id: 1 },
      } as any;

      const updateDto = {
        password: 'newPassword123',
      };

      const mockUpdatedUser = new User({
        id: 1,
        username: 'testuser',
        type: UserType.EDITOR,
        permissions: [],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      const handler = controller.updateProfile(mockRequest) as unknown as (
        ctx: any,
      ) => Promise<any>;
      await handler({ body: updateDto });

      expect(service.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          password: 'newPassword123',
        }),
      );
    });

    it('should return 401 when user is not authenticated', async () => {
      const mockRequest = {} as any;

      const handler = controller.updateProfile(mockRequest) as unknown as (
        ctx: any,
      ) => Promise<any>;
      const result = await handler({ body: { nickname: 'Test' } });

      expect(result.status).toBe(401);
      expect(result.body).toEqual({ message: 'Unauthorized' });
    });

    it('should update profile with avatar', async () => {
      const mockRequest = {
        user: { id: 1 },
      } as any;

      const updateDto = {
        avatar: 'https://example.com/avatar.png',
      };

      const mockUpdatedUser = new User({
        id: 1,
        username: 'testuser',
        avatar: 'https://example.com/avatar.png',
        type: UserType.EDITOR,
        permissions: [],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      const handler = controller.updateProfile(mockRequest) as unknown as (
        ctx: any,
      ) => Promise<any>;
      const result = await handler({ body: updateDto });

      expect(result.body.avatar).toBe('https://example.com/avatar.png');
    });
  });

  describe('getCollaborators_tsrest (ts-rest handler)', () => {
    it('should return collaborators list', async () => {
      const mockCollaborators = [
        new User({
          id: 2,
          username: 'editor1',
          nickname: 'Editor One',
          type: UserType.EDITOR,
          permissions: ['article:create'],
          createdAt: dayjs().format(),
          updatedAt: dayjs().format(),
        }),
        new User({
          id: 3,
          username: 'editor2',
          nickname: 'Editor Two',
          type: UserType.EDITOR,
          permissions: [],
          createdAt: dayjs().format(),
          updatedAt: dayjs().format(),
        }),
      ];

      mockUserService.getCollaborators.mockResolvedValue(mockCollaborators);

      const handler = controller.getCollaborators_tsrest() as unknown as () => Promise<any>;
      const result = await handler();

      expect(service.getCollaborators).toHaveBeenCalled();
      expect(result.status).toBe(200);
      expect(result.body).toHaveLength(2);
      expect(result.body[0].username).toBe('editor1');
      expect(result.body[1].username).toBe('editor2');
    });

    it('should return empty array when no collaborators', async () => {
      mockUserService.getCollaborators.mockResolvedValue([]);

      const handler = controller.getCollaborators_tsrest() as unknown as () => Promise<any>;
      const result = await handler();

      expect(result.status).toBe(200);
      expect(result.body).toEqual([]);
    });
  });

  describe('createCollaborator (ts-rest handler)', () => {
    it('should create a new collaborator', async () => {
      const createDto = {
        name: 'neweditor',
        password: 'password123',
        nickname: 'New Editor',
        permissions: ['article:create', 'article:read'],
      };

      const mockNewUser = new User({
        id: 4,
        username: 'neweditor',
        nickname: 'New Editor',
        type: UserType.EDITOR,
        permissions: ['article:create', 'article:read'],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.create.mockResolvedValue(mockNewUser);

      const handler = controller.createCollaborator() as unknown as (ctx: any) => Promise<any>;
      const result = await handler({ body: createDto });

      expect(service.create).toHaveBeenCalledWith({
        username: 'neweditor',
        password: 'password123',
        nickname: 'New Editor',
        type: UserType.EDITOR,
        permissions: ['article:create', 'article:read'],
      });
      expect(result.status).toBe(201);
      expect(result.body.username).toBe('neweditor');
      expect(result.body.permissions).toEqual(['article:create', 'article:read']);
    });

    it('should create collaborator without permissions', async () => {
      const createDto = {
        name: 'viewer',
        password: 'password123',
        nickname: 'Viewer',
        permissions: [],
      };

      const mockNewUser = new User({
        id: 5,
        username: 'viewer',
        nickname: 'Viewer',
        type: UserType.EDITOR,
        permissions: [],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.create.mockResolvedValue(mockNewUser);

      const handler = controller.createCollaborator() as unknown as (ctx: any) => Promise<any>;
      const result = await handler({ body: createDto });

      expect(result.status).toBe(201);
      expect(result.body.permissions).toEqual([]);
    });
  });

  describe('updateCollaborator (ts-rest handler)', () => {
    it('should update an existing collaborator', async () => {
      const updateDto = {
        id: 2,
        password: 'newPassword123',
        nickname: 'Updated Editor',
        permissions: ['article:create', 'article:update', 'article:delete'],
      };

      const mockUpdatedUser = new User({
        id: 2,
        username: 'editor1',
        nickname: 'Updated Editor',
        type: UserType.EDITOR,
        permissions: ['article:create', 'article:update', 'article:delete'],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      const handler = controller.updateCollaborator() as unknown as (ctx: any) => Promise<any>;
      const result = await handler({ body: updateDto });

      expect(service.update).toHaveBeenCalledWith(2, {
        password: 'newPassword123',
        nickname: 'Updated Editor',
        permissions: ['article:create', 'article:update', 'article:delete'],
      });
      expect(result.status).toBe(200);
      expect(result.body.nickname).toBe('Updated Editor');
    });

    it('should update collaborator nickname only', async () => {
      const updateDto = {
        id: 2,
        nickname: 'Just Nickname',
        permissions: [],
      };

      const mockUpdatedUser = new User({
        id: 2,
        username: 'editor1',
        nickname: 'Just Nickname',
        type: UserType.EDITOR,
        permissions: [],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      const handler = controller.updateCollaborator() as unknown as (ctx: any) => Promise<any>;
      const result = await handler({ body: updateDto });

      expect(result.body.nickname).toBe('Just Nickname');
    });
  });

  describe('deleteCollaborator (ts-rest handler)', () => {
    it('should delete a collaborator by ID', async () => {
      mockUserService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCollaborator() as unknown as (ctx: any) => Promise<any>;
      const result = await handler({ params: { id: '3' } });

      expect(service.remove).toHaveBeenCalledWith(3);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ success: true });
    });

    it('should handle deletion with string ID', async () => {
      mockUserService.remove.mockResolvedValue(undefined);

      const handler = controller.deleteCollaborator() as unknown as (ctx: any) => Promise<any>;
      const result = await handler({ params: { id: '10' } });

      expect(service.remove).toHaveBeenCalledWith(10);
      expect(result.status).toBe(200);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty string for user ID in findOne', async () => {
      // Number('') returns 0, which is valid
      const zeroUser = new User({
        id: 0,
        username: 'test',
        type: UserType.EDITOR,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(zeroUser);

      await controller.findOne('');
      expect(service.findOne).toHaveBeenCalledWith(0);
    });

    it('should handle whitespace-only string for user ID', async () => {
      // Number('   ') returns 0, which is valid
      const zeroUser = new User({
        id: 0,
        username: 'test',
        type: UserType.EDITOR,
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });

      mockUserService.findOne.mockResolvedValue(zeroUser);

      await controller.findOne('   ');
      expect(service.findOne).toHaveBeenCalledWith(0);
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
      expect(result.permissions).toBeUndefined();
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
