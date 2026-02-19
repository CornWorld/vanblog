import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type User } from '@vanblog/shared';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { UserProfileController } from './user.controller';
import { UserService } from './user.service';

describe('UserProfileController', () => {
  let controller: UserProfileController;
  let userService: {
    update: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findByUsername: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    getAdminUser: ReturnType<typeof vi.fn>;
    getCollaborators: ReturnType<typeof vi.fn>;
    findByUsernameWithPassword: ReturnType<typeof vi.fn>;
  };

  const mockUser: User = {
    id: 1,
    username: 'testuser',
    nickname: 'Test User',
    email: 'test@example.com',
    type: 'admin',
    permissions: ['read', 'write'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    userService = {
      update: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      findByUsername: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      getAdminUser: vi.fn(),
      getCollaborators: vi.fn(),
      findByUsernameWithPassword: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserProfileController],
      providers: [
        {
          provide: UserService,
          useValue: userService,
        },
      ],
    }).compile();

    controller = module.get<UserProfileController>(UserProfileController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateProfile', () => {
    it('should update profile successfully with valid body', async () => {
      const req = { user: { id: 1 } };
      const rawBody = { nickname: 'Updated' };
      const updatedUser: User = {
        ...mockUser,
        nickname: 'Updated',
        updatedAt: '2025-06-01T00:00:00.000Z',
      };

      userService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(req as any, rawBody);

      expect(userService.update).toHaveBeenCalledWith(1, { nickname: 'Updated' });
      expect(result).toMatchObject({
        id: 1,
        nickname: 'Updated',
        permissions: ['read', 'write'],
      });
    });

    it('should normalize permissions to an array in the result', async () => {
      const req = { user: { id: 1 } };
      const rawBody = { nickname: 'Updated' };
      const updatedUser = {
        ...mockUser,
        nickname: 'Updated',
        permissions: undefined,
      };

      userService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(req as any, rawBody);

      expect(result.permissions).toEqual([]);
    });

    it('should throw BadRequestException on validation failure', async () => {
      const req = { user: { id: 1 } };
      // Pass a body with an invalid field type to trigger Zod validation failure.
      // UpdateUserSchema expects strings for nickname, so a number should fail.
      const invalidBody = { nickname: 12345 };

      await expect(controller.updateProfile(req as any, invalidBody)).rejects.toThrow(
        BadRequestException,
      );
      expect(userService.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException with validation details', async () => {
      const req = { user: { id: 1 } };
      const invalidBody = { nickname: 12345 };

      try {
        await controller.updateProfile(req as any, invalidBody);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toHaveProperty('message', 'Validation failed');
        expect(response).toHaveProperty('issues');
      }
    });

    it('should extract userId from req.user', async () => {
      const req = { user: { id: 42 } };
      const rawBody = { nickname: 'New Name' };
      const updatedUser: User = {
        ...mockUser,
        id: 42,
        nickname: 'New Name',
      };

      userService.update.mockResolvedValue(updatedUser);

      await controller.updateProfile(req as any, rawBody);

      expect(userService.update).toHaveBeenCalledWith(42, { nickname: 'New Name' });
    });

    it('should pass only parsed data to userService.update', async () => {
      const req = { user: { id: 1 } };
      // Include an extra field that should be stripped by Zod schema parsing
      const rawBody = { nickname: 'Updated', email: 'new@example.com' };
      const updatedUser: User = {
        ...mockUser,
        nickname: 'Updated',
        email: 'new@example.com',
      };

      userService.update.mockResolvedValue(updatedUser);

      await controller.updateProfile(req as any, rawBody);

      // The parsed data should contain only the valid schema fields
      expect(userService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ nickname: 'Updated' }),
      );
    });
  });
});
