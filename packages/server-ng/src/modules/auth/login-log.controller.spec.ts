import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LoginLogTsRestController } from './login-log.controller';
import { LoginLogService } from './login-log.service';

describe('LoginLogTsRestController', () => {
  let controller: LoginLogTsRestController;
  let loginLogService: LoginLogService;

  const mockLoginLogs = [
    {
      id: 1,
      username: 'testuser',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      success: true,
      message: 'Login successful',
      createdAt: dayjs().format(),
    },
    {
      id: 2,
      username: 'testuser',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      success: false,
      message: 'Invalid password',
      createdAt: dayjs().subtract(1, 'hour').format(),
    },
  ];

  const mockLoginLogService = {
    getLogs: vi.fn(),
    getRecentFailedAttempts: vi.fn(),
    getRecentFailedAttemptsByIp: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoginLogTsRestController],
      providers: [
        {
          provide: LoginLogService,
          useValue: mockLoginLogService,
        },
      ],
    }).compile();

    controller = module.get<LoginLogTsRestController>(LoginLogTsRestController);
    loginLogService = module.get<LoginLogService>(LoginLogService);

    vi.clearAllMocks();
  });

  describe('getLoginLogs', () => {
    it('should return login logs successfully', async () => {
      mockLoginLogService.getLogs.mockResolvedValue(mockLoginLogs);

      const handler = controller.getLoginLogs();
      const result = await handler({
        query: {
          username: 'testuser',
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: mockLoginLogs,
      });
      expect(loginLogService.getLogs).toHaveBeenCalledWith({
        username: 'testuser',
        success: undefined,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should filter logs by success status', async () => {
      const successLogs = mockLoginLogs.filter((log) => log.success);
      mockLoginLogService.getLogs.mockResolvedValue(successLogs);

      const handler = controller.getLoginLogs();
      const result = await handler({
        query: {
          success: true,
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: successLogs,
      });
      expect(loginLogService.getLogs).toHaveBeenCalledWith({
        username: undefined,
        success: true,
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should filter logs by date range', async () => {
      mockLoginLogService.getLogs.mockResolvedValue(mockLoginLogs);

      const startDate = dayjs().subtract(1, 'day').format();
      const endDate = dayjs().format();

      const handler = controller.getLoginLogs();
      const result = await handler({
        query: {
          startDate,
          endDate,
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: mockLoginLogs,
      });
      expect(loginLogService.getLogs).toHaveBeenCalledWith({
        username: undefined,
        success: undefined,
        startDate,
        endDate,
      });
    });

    it('should return empty array on error', async () => {
      mockLoginLogService.getLogs.mockRejectedValue(new Error('Database error'));

      const handler = controller.getLoginLogs();
      const result = await handler({
        query: {},
      } as any);

      expect(result).toEqual({
        status: 200,
        body: [],
      });
    });
  });

  describe('getRecentFailedAttemptsByUsername', () => {
    it('should return failed attempts count for username', async () => {
      mockLoginLogService.getRecentFailedAttempts.mockResolvedValue(3);

      const handler = controller.getRecentFailedAttemptsByUsername();
      const result = await handler({
        query: {
          username: 'testuser',
          cutoffMinutes: 30,
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: { count: 3 },
      });
      expect(loginLogService.getRecentFailedAttempts).toHaveBeenCalledWith('testuser', 30);
    });

    it('should use default cutoff minutes if not provided', async () => {
      mockLoginLogService.getRecentFailedAttempts.mockResolvedValue(2);

      const handler = controller.getRecentFailedAttemptsByUsername();
      const result = await handler({
        query: {
          username: 'testuser',
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: { count: 2 },
      });
      expect(loginLogService.getRecentFailedAttempts).toHaveBeenCalledWith('testuser', 30);
    });

    it('should return zero count on error', async () => {
      mockLoginLogService.getRecentFailedAttempts.mockRejectedValue(new Error('Database error'));

      const handler = controller.getRecentFailedAttemptsByUsername();
      const result = await handler({
        query: {
          username: 'testuser',
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: { count: 0 },
      });
    });
  });

  describe('getRecentFailedAttemptsByIp', () => {
    it('should return failed attempts count for IP', async () => {
      mockLoginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(5);

      const handler = controller.getRecentFailedAttemptsByIp();
      const result = await handler({
        query: {
          ip: '192.168.1.1',
          cutoffMinutes: 60,
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: { count: 5 },
      });
      expect(loginLogService.getRecentFailedAttemptsByIp).toHaveBeenCalledWith('192.168.1.1', 60);
    });

    it('should use default cutoff minutes if not provided', async () => {
      mockLoginLogService.getRecentFailedAttemptsByIp.mockResolvedValue(1);

      const handler = controller.getRecentFailedAttemptsByIp();
      const result = await handler({
        query: {
          ip: '192.168.1.1',
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: { count: 1 },
      });
      expect(loginLogService.getRecentFailedAttemptsByIp).toHaveBeenCalledWith('192.168.1.1', 30);
    });

    it('should return zero count on error', async () => {
      mockLoginLogService.getRecentFailedAttemptsByIp.mockRejectedValue(
        new Error('Database error'),
      );

      const handler = controller.getRecentFailedAttemptsByIp();
      const result = await handler({
        query: {
          ip: '192.168.1.1',
        },
      } as any);

      expect(result).toEqual({
        status: 200,
        body: { count: 0 },
      });
    });
  });
});
