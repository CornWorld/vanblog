/**
 * WebhookService - Execution & Retry Tests
 *
 * 测试 Webhook 执行与重试机制
 *
 * 测试场景：
 * - executeWebhook 方法测试
 * - 重试逻辑（失败后自动重试）
 * - 超时处理
 * - 错误处理与恢复
 * - 非 2xx 响应处理
 * - 日志记录
 *
 * 相关测试：
 * - webhook.service.spec.ts - 核心 CRUD 操作
 * - webhook.service.security.spec.ts - 安全验证
 * - webhook.service.logging.spec.ts - 日志与统计
 */

import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import { DATABASE_CONNECTION } from '../../../database';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookService } from './webhook.service';

// Mock fetch globally
global.fetch = vi.fn();

describe('WebhookService - Execution & Retry', () => {
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

  describe('executeWebhook', () => {
    it('should execute webhook successfully', async () => {
      const webhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate'],
        secret: null,
        active: true,
        retryCount: 3,
        timeout: 5000,
      };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('Success'),
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await (service as any).executeWebhook(webhook, 'article|afterCreate', {
        articleId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('success');
      expect(result.responseCode).toBe(200);
      expect(result.attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      const webhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate'],
        secret: null,
        active: true,
        retryCount: 3,
        timeout: 5000,
      };

      // First two attempts fail, third succeeds
      (global.fetch as Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('Success'),
        });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.useFakeTimers();

      const executePromise = (service as any).executeWebhook(webhook, 'article|afterCreate', {
        articleId: 1,
      });

      // Fast-forward timers for retries
      await vi.advanceTimersByTimeAsync(5000);

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should handle timeout error', async () => {
      const webhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate'],
        secret: null,
        active: true,
        retryCount: 1,
        timeout: 100,
      };

      const abortError = new Error('Timeout');
      abortError.name = 'AbortError';
      (global.fetch as Mock).mockRejectedValue(abortError);

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const result = await (service as any).executeWebhook(webhook, 'article|afterCreate', {
        articleId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('timeout');
      expect(result.error).toBe('Request timeout');
    });

    it('should handle non-2xx response', async () => {
      const webhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate'],
        secret: null,
        active: true,
        retryCount: 2,
        timeout: 5000,
      };

      (global.fetch as Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockDb.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.useFakeTimers();

      const executePromise = (service as any).executeWebhook(webhook, 'article|afterCreate', {
        articleId: 1,
      });

      await vi.advanceTimersByTimeAsync(5000);

      const result = await executePromise;

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.responseCode).toBe(500);
      expect(result.attempts).toBe(2);

      vi.useRealTimers();
    });

    it('should log webhook execution', async () => {
      const webhook = {
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['article|afterCreate'],
        secret: null,
        active: true,
        retryCount: 1,
        timeout: 5000,
      };

      (global.fetch as Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('Success'),
      });

      mockDb.update = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const insertMock = vi.fn().mockResolvedValue(undefined);
      mockDb.insert = vi.fn().mockReturnValue({
        values: insertMock,
      });

      await (service as any).executeWebhook(webhook, 'article|afterCreate', { articleId: 1 });

      // Verify log was inserted
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(insertMock).toHaveBeenCalled();
    });
  });
});
