import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { UserType } from '../../user/dto/create-user.dto';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';

import { JwtStrategy, type JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userService: UserService;
  let configService: ConfigService;

  const mockUser = new User({
    id: 1,
    username: 'testuser',
    type: UserType.ADMIN,
    permissions: ['user:read', 'user:write'],
    createdAt: dayjs().format(),
    updatedAt: dayjs().format(),
  });

  const mockUserService = {
    findOne: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn(),
  };

  beforeEach(async () => {
    mockConfigService.get.mockReturnValue('test-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    userService = module.get<UserService>(UserService);
    configService = module.get<ConfigService>(ConfigService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw error when JWT_SECRET is not configured', () => {
    mockConfigService.get.mockReturnValue(undefined);

    expect(() => {
      new JwtStrategy(configService, userService);
    }).toThrow('JWT_SECRET is not configured');
  });

  describe('validate', () => {
    it('should return anonymous user for anonymous payload', async () => {
      const payload: JwtPayload = {
        sub: 'anonymous',
        username: 'anonymous',
        type: UserType.VIEWER,
        isAnonymous: true,
      };

      const result = await strategy.validate(payload);

      expect(result).toBeInstanceOf(User);
      expect(result.id).toBe(0);
      expect(result.username).toBe('anonymous');
      expect(result.type).toBe(UserType.VIEWER);
      expect(result.permissions).toEqual(['role:viewer']);
      expect(userService.findOne).not.toHaveBeenCalled();
    });

    it('should return anonymous user when sub is "anonymous"', async () => {
      const payload: JwtPayload = {
        sub: 'anonymous',
        username: 'guest',
        type: UserType.VIEWER,
      };

      const result = await strategy.validate(payload);

      expect(result).toBeInstanceOf(User);
      expect(result.id).toBe(0);
      expect(result.username).toBe('guest');
      expect(result.type).toBe(UserType.VIEWER);
      expect(result.permissions).toEqual(['role:viewer']);
      expect(userService.findOne).not.toHaveBeenCalled();
    });

    it('should return anonymous user when isAnonymous is true', async () => {
      const payload: JwtPayload = {
        sub: 123,
        username: 'visitor',
        type: UserType.VIEWER,
        isAnonymous: true,
      };

      const result = await strategy.validate(payload);

      expect(result).toBeInstanceOf(User);
      expect(result.id).toBe(0);
      expect(result.username).toBe('visitor');
      expect(result.type).toBe(UserType.VIEWER);
      expect(result.permissions).toEqual(['role:viewer']);
      expect(userService.findOne).not.toHaveBeenCalled();
    });

    it('should return user when valid user ID is provided', async () => {
      const payload: JwtPayload = {
        sub: 1,
        username: 'testuser',
        type: UserType.ADMIN,
      };

      mockUserService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toBe(mockUser);
      expect(userService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      const payload: JwtPayload = {
        sub: 999,
        username: 'nonexistent',
        type: UserType.ADMIN,
      };

      mockUserService.findOne.mockRejectedValue(new Error('User not found'));

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );

      expect(userService.findOne).toHaveBeenCalledWith(999);
    });

    it('should throw UnauthorizedException when userService throws error', async () => {
      const payload: JwtPayload = {
        sub: 1,
        username: 'testuser',
        type: UserType.ADMIN,
      };

      mockUserService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate(payload)).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );

      expect(userService.findOne).toHaveBeenCalledWith(1);
    });
  });
});
