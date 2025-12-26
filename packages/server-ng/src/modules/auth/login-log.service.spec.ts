import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { loginLogs } from '@vanblog/shared/drizzle';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DATABASE_CONNECTION, type Database } from '../../database';

import { LoginLogService } from './login-log.service';

describe('LoginLogService', () => {
  let service: LoginLogService;
  let mockDb: Partial<Database>;

  beforeEach(async () => {
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginLogService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<LoginLogService>(LoginLogService);
  });

  describe('createLog', () => {
    it('should create a login log successfully', async () => {
      const logData = {
        username: 'testuser',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        message: 'Login successful',
      };

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.createLog(logData);

      expect(mockDb.insert).toHaveBeenCalledWith(loginLogs);
      expect(mockInsertBuilder.values).toHaveBeenCalledWith({
        username: logData.username,
        ip: logData.ip,
        userAgent: logData.userAgent,
        success: logData.success,
        message: logData.message,
      });
    });

    it('should handle null ip and userAgent', async () => {
      const logData = {
        username: 'testuser',
        success: false,
        message: 'Invalid credentials',
      };

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.createLog(logData);

      expect(mockInsertBuilder.values).toHaveBeenCalledWith({
        username: logData.username,
        ip: null,
        userAgent: null,
        success: logData.success,
        message: logData.message,
      });
    });

    it('should handle null message', async () => {
      const logData = {
        username: 'testuser',
        ip: '127.0.0.1',
        userAgent: 'Chrome',
        success: true,
      };

      const mockInsertBuilder = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert = vi.fn().mockReturnValue(mockInsertBuilder);

      await service.createLog(logData);

      expect(mockInsertBuilder.values).toHaveBeenCalledWith({
        username: logData.username,
        ip: logData.ip,
        userAgent: logData.userAgent,
        success: logData.success,
        message: null,
      });
    });
  });

  describe('getLogs', () => {
    it('should return all logs without filters', async () => {
      const mockLogs = [
        {
          id: 1,
          username: 'user1',
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          success: true,
          message: 'Login successful',
          createdAt: dayjs().format(),
        },
        {
          id: 2,
          username: 'user2',
          ip: '192.168.1.1',
          userAgent: 'Chrome',
          success: false,
          message: 'Invalid password',
          createdAt: dayjs().subtract(1, 'hour').format(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockLogs),
            }),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await service.getLogs({});

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          username: 'user1',
          success: true,
        }),
      );
    });

    it('should filter logs by username', async () => {
      const mockLogs = [
        {
          id: 1,
          username: 'testuser',
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          success: true,
          message: null,
          createdAt: dayjs().format(),
        },
      ];

      const mockQuery = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockLogs),
            }),
          }),
        }),
      };

      mockDb.select = vi.fn().mockReturnValue(mockQuery);

      const result = await service.getLogs({ username: 'testuser' });

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('testuser');
    });

    it('should filter logs by success status', async () => {
      const mockLogs = [
        {
          id: 1,
          username: 'user1',
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          success: true,
          message: null,
          createdAt: dayjs().format(),
        },
      ];

      const mockQuery = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockLogs),
            }),
          }),
        }),
      };

      mockDb.select = vi.fn().mockReturnValue(mockQuery);

      const result = await service.getLogs({ success: true });

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
    });

    it('should filter logs by date range', async () => {
      const startDate = dayjs().subtract(1, 'day').format();
      const endDate = dayjs().format();

      const mockLogs = [
        {
          id: 1,
          username: 'user1',
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          success: true,
          message: null,
          createdAt: dayjs().format(),
        },
      ];

      const mockQuery = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockLogs),
            }),
          }),
        }),
      };

      mockDb.select = vi.fn().mockReturnValue(mockQuery);

      const result = await service.getLogs({ startDate, endDate });

      expect(result).toHaveLength(1);
    });
  });

  describe('getRecentFailedAttempts', () => {
    it('should count recent failed login attempts by username', async () => {
      const mockFailedLogs = [
        {
          id: 1,
          username: 'testuser',
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          success: false,
          message: 'Invalid password',
          createdAt: dayjs().subtract(10, 'minutes').format(),
        },
        {
          id: 2,
          username: 'testuser',
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          success: false,
          message: 'Invalid password',
          createdAt: dayjs().subtract(20, 'minutes').format(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFailedLogs),
        }),
      });

      const count = await service.getRecentFailedAttempts('testuser', 30);

      expect(count).toBe(2);
    });

    it('should use custom time window', async () => {
      const mockFailedLogs = [
        {
          id: 1,
          username: 'testuser',
          ip: '127.0.0.1',
          userAgent: 'Mozilla',
          success: false,
          message: 'Invalid password',
          createdAt: dayjs().subtract(5, 'minutes').format(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFailedLogs),
        }),
      });

      const count = await service.getRecentFailedAttempts('testuser', 10);

      expect(count).toBe(1);
    });

    it('should return 0 when no failed attempts found', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const count = await service.getRecentFailedAttempts('testuser', 30);

      expect(count).toBe(0);
    });
  });

  describe('getRecentFailedAttemptsByIp', () => {
    it('should count recent failed login attempts by IP', async () => {
      const mockFailedLogs = [
        {
          id: 1,
          username: 'user1',
          ip: '192.168.1.1',
          userAgent: 'Mozilla',
          success: false,
          message: 'Invalid password',
          createdAt: dayjs().subtract(15, 'minutes').format(),
        },
        {
          id: 2,
          username: 'user2',
          ip: '192.168.1.1',
          userAgent: 'Chrome',
          success: false,
          message: 'Account locked',
          createdAt: dayjs().subtract(25, 'minutes').format(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFailedLogs),
        }),
      });

      const count = await service.getRecentFailedAttemptsByIp('192.168.1.1', 30);

      expect(count).toBe(2);
    });

    it('should use custom time window', async () => {
      const mockFailedLogs = [
        {
          id: 1,
          username: 'user1',
          ip: '10.0.0.1',
          userAgent: 'Mozilla',
          success: false,
          message: 'Invalid password',
          createdAt: dayjs().subtract(5, 'minutes').format(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFailedLogs),
        }),
      });

      const count = await service.getRecentFailedAttemptsByIp('10.0.0.1', 10);

      expect(count).toBe(1);
    });

    it('should return 0 when no failed attempts found', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const count = await service.getRecentFailedAttemptsByIp('8.8.8.8', 30);

      expect(count).toBe(0);
    });
  });

  describe('Database Error Handling', () => {
    it('should handle database connection failure in createLog', async () => {
      const logData = {
        username: 'testuser',
        ip: '127.0.0.1',
        success: true,
        message: 'Login attempt',
      };

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      await expect(service.createLog(logData)).rejects.toThrow('Database connection failed');
    });

    it('should handle database connection failure in getLogs', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error('Database timeout')),
            }),
          }),
        }),
      });

      await expect(service.getLogs({})).rejects.toThrow('Database timeout');
    });

    it('should handle database error in getRecentFailedAttempts', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database unavailable')),
        }),
      });

      await expect(service.getRecentFailedAttempts('testuser', 30)).rejects.toThrow(
        'Database unavailable',
      );
    });

    it('should handle database error in getRecentFailedAttemptsByIp', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Query execution failed')),
        }),
      });

      await expect(service.getRecentFailedAttemptsByIp('192.168.1.1', 30)).rejects.toThrow(
        'Query execution failed',
      );
    });

    it('should handle partial result returns (database partial failure)', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await service.getLogs({});

      expect(result).toEqual([]);
    });
  });
});
