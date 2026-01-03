import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import * as bcrypt from 'bcrypt';
import { vi } from 'vitest';

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

describe('AuthService', () => {
  let service: AuthService;
  let mockUserService: any;
  let mockTokenService: any;
  let mockHookService: Partial<HookService>;

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

  beforeEach(async () => {
    mockUserService = {
      findByUsername: vi.fn() as any,
      findByUsernameWithPassword: vi.fn() as any,
      findOne: vi.fn() as any,
    } as any;

    mockTokenService = {
      generateTokenPair: vi.fn() as any,
      verifyAccessToken: vi.fn() as any,
      verifyRefreshToken: vi.fn() as any,
      refreshTokenPair: vi.fn() as any,
      revokeToken: vi.fn() as any,
      revokeAllUserTokens: vi.fn() as any,
      isTokenRevoked: vi.fn() as any,
      generateAnonymousAccessToken: vi.fn() as any,
    } as any;

    mockHookService = Mock.hook();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: HookService, useValue: mockHookService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    vi.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
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
      expect(mockHookService.doAction).toHaveBeenCalledWith('auth|beforeValidateUser', {
        username: 'testuser',
      });
      expect(mockHookService.doAction).toHaveBeenCalledWith('auth|validatedUser', {
        user: userWithoutPassword,
      });
    });

    it('should return null when user not found', async () => {
      mockUserService.findByUsernameWithPassword.mockResolvedValue(null);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toBeNull();
      expect(mockUserService.findByUsernameWithPassword).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockHookService.doAction).toHaveBeenCalledWith('auth|validateUserFailed', {
        username: 'testuser',
        reason: 'user_not_found',
      });
    });

    it('should return null when user has no password', async () => {
      const userWithoutPassword = new User({
        id: 1,
        username: 'testuser',
        password: undefined,
        nickname: 'Test User',
        type: UserType.ADMIN,
        permissions: [],
        createdAt: dayjs().format(),
        updatedAt: dayjs().format(),
      });
      mockUserService.findByUsernameWithPassword.mockResolvedValue(userWithoutPassword);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toBeNull();
      expect(mockUserService.findByUsernameWithPassword).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockHookService.doAction).toHaveBeenCalledWith('auth|validateUserFailed', {
        username: 'testuser',
        reason: 'no_password',
      });
    });

    it('should return null when password is invalid', async () => {
      mockUserService.findByUsernameWithPassword.mockResolvedValue(mockUser);
      // Override the default mock to return false

      (vi.mocked(bcrypt.compare) as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword');
      expect(mockHookService.doAction).toHaveBeenCalledWith('auth|validateUserFailed', {
        username: 'testuser',
        reason: 'invalid_password',
      });
    });
  });

  describe('login', () => {
    it('should return token pair and user info', () => {
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

    it('should trigger beforeLogin and loggedIn hooks', () => {
      const tokenPair = {
        accessToken: 'access.token.here',
        refreshToken: 'refresh.token.here',
      };
      mockTokenService.generateTokenPair.mockReturnValue(tokenPair);

      service.login(mockUser);

      expect(mockHookService.doAction).toHaveBeenCalledWith('auth|beforeLogin', {
        user: mockUser,
      });
      expect(mockHookService.doAction).toHaveBeenCalledWith('auth|loggedIn', {
        user: mockUser,
        token: tokenPair.accessToken,
      });
    });
  });

  describe('verifyToken', () => {
    it('should return user when token is valid', async () => {
      mockTokenService.verifyAccessToken.mockResolvedValue(mockUser);

      const result = await service.verifyToken('valid.token');

      expect(result).toEqual(mockUser);
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith('valid.token');
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockTokenService.verifyAccessToken.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      await expect(service.verifyToken('invalid.token')).rejects.toThrow(
        new UnauthorizedException('Invalid token'),
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new token pair when refresh token is valid', async () => {
      const tokenPair = {
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
      };
      mockTokenService.refreshTokenPair.mockResolvedValue(tokenPair);

      const result = await service.refreshToken('valid.refresh.token');

      expect(result).toEqual(tokenPair);
      expect(mockTokenService.refreshTokenPair).toHaveBeenCalledWith('valid.refresh.token');
    });
  });

  describe('revokeToken', () => {
    it('should revoke token', async () => {
      await service.revokeToken('token.to.revoke');

      expect(mockTokenService.revokeToken).toHaveBeenCalledWith('token.to.revoke');
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens', () => {
      service.revokeAllUserTokens(1);

      expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith(1);
    });
  });

  describe('generateAnonymousToken', () => {
    it('should generate anonymous token with default expiration (12h)', () => {
      mockTokenService.generateAnonymousAccessToken = vi.fn().mockReturnValue('anonymous.token');

      const result = service.generateAnonymousToken();

      expect(result).toEqual({
        access_token: 'anonymous.token',
        expiresAt: expect.any(String),
      });
      expect(mockTokenService.generateAnonymousAccessToken).toHaveBeenCalledWith(
        'anonymous',
        undefined,
      );

      // Verify expiresAt is approximately 12 hours from now
      const expiresAt = dayjs(result.expiresAt);
      const expectedExpiry = dayjs().add(12, 'hour');
      const diff = Math.abs(expiresAt.diff(expectedExpiry, 'minute'));
      expect(diff).toBeLessThan(1); // Allow 1 minute tolerance
    });

    it('should generate anonymous token with custom expiration (24h)', () => {
      mockTokenService.generateAnonymousAccessToken = vi.fn().mockReturnValue('anonymous.token');

      const result = service.generateAnonymousToken('24h');

      expect(result).toEqual({
        access_token: 'anonymous.token',
        expiresAt: expect.any(String),
      });
      expect(mockTokenService.generateAnonymousAccessToken).toHaveBeenCalledWith(
        'anonymous',
        '24h',
      );

      // Verify expiresAt is approximately 24 hours from now
      const expiresAt = dayjs(result.expiresAt);
      const expectedExpiry = dayjs().add(24, 'hour');
      const diff = Math.abs(expiresAt.diff(expectedExpiry, 'minute'));
      expect(diff).toBeLessThan(1); // Allow 1 minute tolerance
    });

    it('should generate anonymous token with custom expiration (1h)', () => {
      mockTokenService.generateAnonymousAccessToken = vi.fn().mockReturnValue('anonymous.token');

      const result = service.generateAnonymousToken('1h');

      expect(result).toEqual({
        access_token: 'anonymous.token',
        expiresAt: expect.any(String),
      });
      expect(mockTokenService.generateAnonymousAccessToken).toHaveBeenCalledWith('anonymous', '1h');

      // Verify expiresAt is approximately 1 hour from now
      const expiresAt = dayjs(result.expiresAt);
      const expectedExpiry = dayjs().add(1, 'hour');
      const diff = Math.abs(expiresAt.diff(expectedExpiry, 'minute'));
      expect(diff).toBeLessThan(1); // Allow 1 minute tolerance
    });
  });
});
