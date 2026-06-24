import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { dayjs } from '@vanblog/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Mock } from '@test/mock';
import { UserType } from '../user/dto/create-user.dto';
import { User } from '../user/entities/user.entity';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { LoginLogService } from './login-log.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let loginLogService: LoginLogService;

  const mockUser = new User(
    Mock.user({
      id: 1,
      username: 'testuser',
      password: 'hashedPassword',
      nickname: 'Test User',
      email: 'test@example.com',
      type: UserType.ADMIN,
      permissions: ['read', 'write'],
      createdAt: dayjs().format(),
      updatedAt: dayjs().format(),
    }),
  );

  const mockAuthService = {
    login: vi.fn(),
    validateUser: vi.fn(),
    revokeToken: vi.fn(),
    refreshToken: vi.fn(),
    revokeAllUserTokens: vi.fn(),
    generateAnonymousToken: vi.fn(),
  };

  const mockLoginLogService = {
    createLog: vi.fn(),
    getLogs: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: LoginLogService, useValue: mockLoginLogService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(LocalAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    loginLogService = module.get<LoginLogService>(LoginLogService);
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully and create log', async () => {
      const loginResult = {
        access_token: 'access.token',
        refresh_token: 'refresh.token',
        user: {
          id: mockUser.id,
          username: mockUser.username,
          nickname: mockUser.nickname,
          email: mockUser.email,
          type: mockUser.type,
          permissions: mockUser.permissions,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
      };

      mockAuthService.login.mockReturnValue(loginResult);
      mockLoginLogService.createLog.mockResolvedValue(undefined);

      const req = {
        user: mockUser,
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      } as any;

      const result = await controller.login(req);

      expect(result).toEqual({
        ...loginResult,
        token: loginResult.access_token,
      });

      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(loginLogService.createLog).toHaveBeenCalledWith({
        username: mockUser.username,
        ip: req.ip,
        userAgent: 'Mozilla/5.0',
        success: true,
        message: 'Login successful',
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile without password', () => {
      const req = {
        user: mockUser,
      } as any;

      const result = controller.getProfile(req);

      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          username: mockUser.username,
          email: mockUser.email,
          permissions: mockUser.permissions,
        }),
      );
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('logout', () => {
    it('should logout with token from body', async () => {
      mockAuthService.revokeToken.mockResolvedValue(undefined);

      const req = {
        user: mockUser,
        headers: {},
      } as any;

      const body = {
        token: 'token.to.revoke',
      };

      const result = await controller.logout(req, body);

      expect(result).toEqual({ message: 'Logout successful' });
      expect(authService.revokeToken).toHaveBeenCalledWith('token.to.revoke');
    });

    it('should logout with token from Authorization header', async () => {
      mockAuthService.revokeToken.mockResolvedValue(undefined);

      const req = {
        user: mockUser,
        headers: {
          authorization: 'Bearer header.token',
        },
      } as any;

      const body = {};

      const result = await controller.logout(req, body);

      expect(result).toEqual({ message: 'Logout successful' });
      expect(authService.revokeToken).toHaveBeenCalledWith('header.token');
    });

    it('should revoke both access and refresh tokens', async () => {
      mockAuthService.revokeToken.mockResolvedValue(undefined);

      const req = {
        user: mockUser,
        headers: {},
      } as any;

      const body = {
        token: 'access.token',
        refresh_token: 'refresh.token',
      };

      await controller.logout(req, body);

      expect(authService.revokeToken).toHaveBeenCalledTimes(2);
      expect(authService.revokeToken).toHaveBeenCalledWith('access.token');
      expect(authService.revokeToken).toHaveBeenCalledWith('refresh.token');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const tokenPair = {
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
      };

      mockAuthService.refreshToken.mockResolvedValue(tokenPair);

      const body = {
        refresh_token: 'old.refresh.token',
      };

      const result = await controller.refreshToken(body);

      expect(result).toEqual({
        access_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
      });
      expect(authService.refreshToken).toHaveBeenCalledWith('old.refresh.token');
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all user tokens', () => {
      const req = {
        user: mockUser,
      } as any;

      const result = controller.revokeAllTokens(req);

      expect(result).toEqual({ message: 'All tokens revoked successfully' });
      expect(authService.revokeAllUserTokens).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('getCsrfToken', () => {
    it('should return csrf token in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = {
        csrfToken: vi.fn().mockReturnValue('csrf-token-123'),
      } as any;

      const result = controller.getCsrfToken(req);

      expect(result).toEqual({ csrfToken: 'csrf-token-123' });

      process.env.NODE_ENV = originalEnv;
    });

    it('should return test token in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const req = {} as any;

      const result = controller.getCsrfToken(req);

      expect(result).toEqual({ csrfToken: 'test-csrf-token' });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('issueAnonymousToken', () => {
    it('should issue anonymous token with default expiry', () => {
      const tokenData = {
        access_token: 'anonymous.token',
        expiresAt: dayjs().add(1, 'hour').format(),
      };

      mockAuthService.generateAnonymousToken.mockReturnValue(tokenData);

      const result = controller.issueAnonymousToken();

      expect(result).toEqual(tokenData);
      expect(authService.generateAnonymousToken).toHaveBeenCalledWith(undefined);
    });

    it('should issue anonymous token with custom expiry', () => {
      const tokenData = {
        access_token: 'anonymous.token',
        expiresAt: dayjs().add(2, 'hours').format(),
      };

      mockAuthService.generateAnonymousToken.mockReturnValue(tokenData);

      const result = controller.issueAnonymousToken('2h');

      expect(result).toEqual(tokenData);
      expect(authService.generateAnonymousToken).toHaveBeenCalledWith('2h');
    });
  });
});
