import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import * as bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, vi } from 'vitest';

import { configTest } from '../../../test/vitest-fixtures.test';
import { HookService } from '../plugin/services/hook.service';
import { UserType } from '../user/dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

import { AuthService } from './auth.service';
import { TokenService } from './token.service';

// Mock bcrypt before any imports that use it
vi.mock('bcrypt', () => ({
  compare: vi.fn().mockResolvedValue(true),
  hash: vi.fn().mockResolvedValue('hashedPassword'),
}));

describe('AuthService with Vitest Fixtures', () => {
  let service: AuthService;
  let mockHookService: HookService;

  const mockUser = new User({
    id: 1,
    username: 'testuser',
    password: 'hashedPassword',
    nickname: 'Test User',
    type: UserType.ADMIN,
    permissions: [],
    createdAt: dayjs().format(),
    updatedAt: dayjs().format(),
  });

  const mockUserService = {
    findByUsername: vi.fn(),
    findByUsernameWithPassword: vi.fn(),
    findOne: vi.fn(),
  };

  const mockTokenService = {
    generateTokenPair: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
    refreshTokenPair: vi.fn(),
    revokeToken: vi.fn(),
    revokeAllUserTokens: vi.fn(),
    isTokenRevoked: vi.fn(),
  };

  beforeEach(async () => {
    mockHookService = {
      applyFilters: vi.fn().mockImplementation(async (_hookName, data) => Promise.resolve(data)),
      doAction: vi.fn().mockResolvedValue(undefined),
    } as unknown as HookService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUser', () => {
    configTest('should return user when credentials are valid', async () => {
      mockUserService.findByUsernameWithPassword.mockResolvedValue(mockUser);
      // bcrypt.compare will return true by default from vi.mock
      const userWithoutPassword = new User({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        type: mockUser.type,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      mockUserService.findByUsername.mockResolvedValue(userWithoutPassword);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          type: mockUser.type,
          password: undefined,
        }),
      );
      expect(mockUserService.findByUsernameWithPassword).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashedPassword');
    });

    configTest('should return null when user not found', async () => {
      mockUserService.findByUsernameWithPassword.mockResolvedValue(null);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toBeNull();
      expect(mockUserService.findByUsernameWithPassword).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    configTest('should return null when password is invalid', async () => {
      mockUserService.findByUsernameWithPassword.mockResolvedValue(mockUser);
      // Override the default mock to return false
      (vi.mocked(bcrypt.compare) as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword');
    });
  });

  describe('login', () => {
    configTest('should return token pair and user info', () => {
      const tokenPair = {
        accessToken: 'access.token.here',
        refreshToken: 'refresh.token.here',
      };
      mockTokenService.generateTokenPair.mockReturnValue(tokenPair);

      const result = service.login(mockUser);

      expect(result).toEqual({
        access_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          nickname: mockUser.nickname,
          email: mockUser.email,
          avatar: mockUser.avatar,
          type: mockUser.type,
          permissions: mockUser.permissions,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      });
      expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('verifyToken', () => {
    configTest('should return user when token is valid', async () => {
      mockTokenService.verifyAccessToken.mockResolvedValue(mockUser);

      const result = await service.verifyToken('valid.token');

      expect(result).toEqual(mockUser);
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid.token');
    });

    configTest('should throw UnauthorizedException when token is invalid', async () => {
      mockTokenService.verifyAccessToken.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      await expect(service.verifyToken('invalid.token')).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );
    });
  });
});
