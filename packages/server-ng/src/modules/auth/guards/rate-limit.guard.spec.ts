import { HttpException, HttpStatus, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { LoginLogService } from '../login-log.service';

import { RateLimitGuard } from './rate-limit.guard';

// Helper function to create mock ExecutionContext
const createMockContext = (body: any, ip = '127.0.0.1'): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        ip,
        socket: { remoteAddress: ip },
        headers: {},
      }),
    }),
  } as ExecutionContext;
};

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let loginLogService: any;
  let configService: any;

  const mockLoginLogService = {
    getRecentFailedAttempts: vi.fn(),
    getRecentFailedAttemptsByIp: vi.fn(),
  };

  beforeEach(async () => {
    // Mock ConfigService
    configService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'auth.rateLimit.userAttempts': 5,
          'auth.rateLimit.ipAttempts': 10,
          'auth.rateLimit.windowMinutes': 30,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: LoginLogService,
          useValue: mockLoginLogService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    loginLogService = module.get(LoginLogService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    const createMockContext = (body: any, ip = '127.0.0.1'): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            body,
            ip,
            socket: { remoteAddress: ip },
            headers: {},
          }),
        }),
      } as ExecutionContext;
    };

    it('should allow access when no username is provided', async () => {
      const context = createMockContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(loginLogService.getRecentFailedAttempts).not.toHaveBeenCalled();
      expect(loginLogService.getRecentFailedAttemptsByIp).not.toHaveBeenCalled();
    });

    it('should allow access when failed attempts are below limits', async () => {
      const context = createMockContext({ username: 'testuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(2);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(3);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(loginLogService.getRecentFailedAttempts).toHaveBeenCalledWith('testuser', 30);
      expect(loginLogService.getRecentFailedAttemptsByIp).toHaveBeenCalledWith('127.0.0.1', 30);
    });

    it('should block access when user failed attempts exceed limit', async () => {
      const context = createMockContext({ username: 'testuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(5);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(3);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            message: '登录尝试次数过多，请30分钟后再试',
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
          }),
        }),
      );
    });

    it('should block access when IP failed attempts exceed limit', async () => {
      const context = createMockContext({ username: 'testuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(2);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(10);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            message: 'IP地址登录尝试次数过多，请30分钟后再试',
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
          }),
        }),
      );
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: { username: 'testuser' },
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            headers: {
              'x-forwarded-for': '192.168.1.1, 10.0.0.1',
            },
          }),
        }),
      } as ExecutionContext;

      loginLogService.getRecentFailedAttempts.mockResolvedValue(2);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(3);

      await guard.canActivate(context);

      expect(loginLogService.getRecentFailedAttemptsByIp).toHaveBeenCalledWith('192.168.1.1', 30);
    });

    it('should extract IP from x-real-ip header when x-forwarded-for is not available', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            body: { username: 'testuser' },
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            headers: {
              'x-real-ip': '192.168.1.2',
            },
          }),
        }),
      } as ExecutionContext;

      loginLogService.getRecentFailedAttempts.mockResolvedValue(2);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(3);

      await guard.canActivate(context);

      expect(loginLogService.getRecentFailedAttemptsByIp).toHaveBeenCalledWith('192.168.1.2', 30);
    });
  });

  describe('ConfigService Integration', () => {
    it('should handle missing ConfigService configuration gracefully', async () => {
      configService.get.mockReturnValue(undefined);

      const context = createMockContext({ username: 'testuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(2);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(3);

      // Should still work with default values
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle exactly at user limit boundary (5 attempts)', async () => {
      const context = createMockContext({ username: 'testuser' });
      // The guard uses >= comparison, so 5 attempts triggers block at limit of 5
      loginLogService.getRecentFailedAttempts.mockResolvedValue(5); // Exactly at limit
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(3);

      // Should reject at exact limit (implementation uses >=)
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            message: '登录尝试次数过多，请30分钟后再试',
          }),
        }),
      );
    });

    it('should allow just below user limit boundary (4 attempts)', async () => {
      const context = createMockContext({ username: 'testuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(4); // Just below limit
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(9);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle exactly at IP limit boundary (10 attempts)', async () => {
      const context = createMockContext({ username: 'testuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(3);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(10); // Exactly at IP limit

      // Should reject at exact IP limit
      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            message: 'IP地址登录尝试次数过多，请30分钟后再试',
          }),
        }),
      );
    });

    it('should allow just below IP limit boundary (9 attempts)', async () => {
      const context = createMockContext({ username: 'testuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(4);
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(9); // Just below IP limit

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle zero failed attempts (fresh login)', async () => {
      const context = createMockContext({ username: 'newuser' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(0); // No attempts yet
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(0);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle very high failed attempts (well above limits)', async () => {
      const context = createMockContext({ username: 'attacker' });
      loginLogService.getRecentFailedAttempts.mockResolvedValue(100); // Way beyond 5
      loginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(3);

      await expect(guard.canActivate(context)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            message: '登录尝试次数过多，请30分钟后再试',
          }),
        }),
      );
    });
  });
});
