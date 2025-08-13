import { HttpException, HttpStatus, type ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { LoginLogService } from '../login-log.service';

import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let loginLogService: any;

  const mockLoginLogService = {
    getRecentFailedAttempts: vi.fn(),
    getRecentFailedAttemptsByIp: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: LoginLogService,
          useValue: mockLoginLogService,
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
});
