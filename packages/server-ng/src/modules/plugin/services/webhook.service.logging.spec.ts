/**
 * WebhookService - Logging & Statistics Tests
 *
 * 测试 Webhook 日志记录与统计功能
 *
 * 测试场景：
 * - Webhook 执行日志记录
 * - 统计信息（成功率、平均响应时间）
 * - 历史记录查询
 * - 日志过滤（按状态、webhookId、日期范围）
 * - 统计计算（总数、成功、失败、超时）
 *
 * 相关测试：
 * - webhook.service.spec.ts - 核心 CRUD 操作
 * - webhook.service.execution.spec.ts - 执行与重试机制
 * - webhook.service.security.spec.ts - 安全验证
 */

import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import { DATABASE_CONNECTION } from '../../../database';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookService } from './webhook.service';

// Mock fetch globally
global.fetch = vi.fn();

describe('WebhookService - Logging & Statistics', () => {
  let service: WebhookService;
  let mockDb: {
    insert: Mock;
    select: Mock;
    update: Mock;
    delete: Mock;
    $client: { execute: Mock };
  };
  let mockWebhookRegistry: {
    registerWebhook: Mock;
    unregisterWebhookFromAllEvents: Mock;
  };

  beforeEach(async () => {
    // Mock database
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      $client: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Mock webhook registry
    mockWebhookRegistry = {
      registerWebhook: vi.fn(),
      unregisterWebhookFromAllEvents: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: WebhookRegistryService,
          useValue: mockWebhookRegistry,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);

    // Mock logger to avoid console output during tests
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('getLogs', () => {
    it('should return paginated logs', async () => {
      const logs = [
        {
          id: 1,
          webhookId: 1,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 1 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 150,
          createdAt: new Date(),
        },
      ];

      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(logs),
              }),
            }),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(logs),
              }),
            }),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const result = await service.getLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].payload).toEqual({ articleId: 1 });
      expect(result.pagination.total).toBe(1);
    });

    it('should filter logs by webhookId', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      await service.getLogs({ webhookId: 1 });

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should filter logs by status', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      await service.getLogs({ status: 'success' });

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should filter logs by date range', async () => {
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      await service.getLogs({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return overall statistics', async () => {
      const mockQueries = [
        [{ count: 100 }], // total
        [{ count: 80 }], // success
        [{ count: 15 }], // failed
        [{ count: 5 }], // timeout
      ];

      let queryIndex = 0;
      mockDb.select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockQueries[queryIndex++]),
        }),
      }));

      const result = await service.getStats();

      expect(result).toEqual({
        total: 100,
        success: 80,
        failed: 15,
        timeout: 5,
        successRate: 0.8,
      });
    });

    it('should return statistics for specific webhook', async () => {
      const mockQueries = [
        [{ count: 50 }], // total
        [{ count: 40 }], // success
        [{ count: 8 }], // failed
        [{ count: 2 }], // timeout
      ];

      let queryIndex = 0;
      mockDb.select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockQueries[queryIndex++]),
        }),
      }));

      const result = await service.getStats(1);

      expect(result).toEqual({
        total: 50,
        success: 40,
        failed: 8,
        timeout: 2,
        successRate: 0.8,
      });
    });

    it('should handle zero total count', async () => {
      const mockQueries = [
        [{ count: 0 }], // total
        [{ count: 0 }], // success
        [{ count: 0 }], // failed
        [{ count: 0 }], // timeout
      ];

      let queryIndex = 0;
      mockDb.select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockQueries[queryIndex++]),
        }),
      }));

      const result = await service.getStats();

      expect(result.successRate).toBe(0);
    });
  });
});
