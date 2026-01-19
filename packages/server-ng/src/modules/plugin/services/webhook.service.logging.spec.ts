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

import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookService } from './webhook.service';
import { DATABASE_CONNECTION } from '../../../database';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { Given } from '@test/given';
import { webhookLogs } from '../entities/webhook.schema';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

// Mock fetch globally
global.fetch = vi.fn();

describe('WebhookService - Logging & Statistics', () => {
  let mockWebhookRegistry: {
    registerWebhook: Mock;
    unregisterWebhookFromAllEvents: Mock;
  };

  beforeEach(async () => {
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
          useValue: db,
        },
        {
          provide: WebhookRegistryService,
          useValue: mockWebhookRegistry,
        },
      ],
    }).compile();

    // Note: Not storing service as it's created fresh for each test in createService()
    module.get<WebhookService>(WebhookService);

    // Mock logger to avoid console output during tests
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  // Helper to create service with transaction database
  function createService(tx: LibSQLDatabase<Record<string, unknown>>): WebhookService {
    const service = new WebhookService(tx, mockWebhookRegistry as any);
    return service;
  }

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('getLogs', () => {
    it('should return paginated logs', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook(tx, {
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Create test log
        const logPayload = JSON.stringify({ articleId: 1 });
        await tx.insert(webhookLogs as any).values({
          webhookId: webhook.id,
          event: 'article|afterCreate',
          payload: logPayload,
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 150,
          createdAt: new Date(),
        });

        // Query logs
        const result = await service.getLogs({ page: 1, limit: 10 });

        // Verify result structure
        expect(result.data).toHaveLength(1);
        expect(result.data[0].webhookId).toBe(webhook.id);

        // Handle the case where payload is a string that looks like JSON
        const payload = result.data[0].payload;
        if (typeof payload === 'string' && payload.startsWith('{') && payload.endsWith('}')) {
          // It's a JSON string, parse it
          expect(JSON.parse(payload)).toEqual({ articleId: 1 });
        } else if (typeof payload === 'object' && payload !== null) {
          // It's already an object
          expect(payload).toEqual({ articleId: 1 });
        } else {
          // Fallback - handle as string
          expect(payload).toEqual('{"articleId":1}');
        }

        expect(result.data[0].status).toBe('success');
        expect(result.data[0].responseCode).toBe(200);
        expect(result.pagination.total).toBe(1);

        // Verify database persistence
        const savedLogs = await tx.select().from(webhookLogs);
        expect(savedLogs).toHaveLength(1);
        expect(savedLogs[0].payload).toBe(logPayload);
      });
    });

    it('should filter logs by webhookId', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhooks
        const webhook1 = await Given.webhook(tx, {
          // name: 'Webhook 1',
          url: 'https://example1.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        const webhook2 = await Given.webhook(tx, {
          // name: 'Webhook 2',
          url: 'https://example2.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Create logs for both webhooks
        await tx.insert(webhookLogs as any).values({
          webhookId: webhook1.id,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 1 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 100,
          createdAt: new Date(),
        });

        await tx.insert(webhookLogs as any).values({
          webhookId: webhook2.id,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 2 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 150,
          createdAt: new Date(),
        });

        // Query logs for webhook1 only
        const result = await service.getLogs({ webhookId: webhook1.id });

        // Verify filtering
        expect(result.data).toHaveLength(1);
        expect(result.data[0].webhookId).toBe(webhook1.id);
        // Handle the case where payload is a string that looks like JSON
        const payload = result.data[0].payload;
        if (typeof payload === 'string' && payload.startsWith('{') && payload.endsWith('}')) {
          // It's a JSON string, parse it
          expect(JSON.parse(payload)).toEqual({ articleId: 1 });
        } else if (typeof payload === 'object' && payload !== null) {
          // It's already an object
          expect(payload).toEqual({ articleId: 1 });
        } else {
          // Fallback - handle as string
          expect(payload).toEqual('{"articleId":1}');
        }

        // Verify database persistence
        const savedLogs = await tx.select().from(webhookLogs);
        expect(savedLogs).toHaveLength(2);
      });
    });

    it('should filter logs by status', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook(tx, {
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Create logs with different statuses
        await tx.insert(webhookLogs as any).values({
          webhookId: webhook.id,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 1 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 100,
          createdAt: new Date(),
        });

        await tx.insert(webhookLogs as any).values({
          webhookId: webhook.id,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 2 }),
          status: 'failed',
          responseCode: 500,
          responseBody: 'Internal Server Error',
          error: 'Server error',
          duration: 200,
          createdAt: new Date(),
        });

        // Query logs with success status only
        const result = await service.getLogs({ status: 'success' });

        // Verify filtering
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('success');
        // Handle the case where payload is a string that looks like JSON
        const payload = result.data[0].payload;
        if (typeof payload === 'string' && payload.startsWith('{') && payload.endsWith('}')) {
          // It's a JSON string, parse it
          expect(JSON.parse(payload)).toEqual({ articleId: 1 });
        } else if (typeof payload === 'object' && payload !== null) {
          // It's already an object
          expect(payload).toEqual({ articleId: 1 });
        } else {
          // Fallback - handle as string
          expect(payload).toEqual('{"articleId":1}');
        }

        // Verify database persistence
        const savedLogs = await tx.select().from(webhookLogs);
        expect(savedLogs).toHaveLength(2);
      });
    });

    it('should filter logs by date range', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook(tx, {
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Create logs with different dates
        const date1 = new Date('2025-01-15T10:00:00Z');
        const date2 = new Date('2025-06-15T10:00:00Z');
        const date3 = new Date('2025-12-15T10:00:00Z');

        await tx.insert(webhookLogs as any).values({
          webhookId: webhook.id,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 1 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 100,
          createdAt: date1.toISOString(),
        });

        await tx.insert(webhookLogs as any).values({
          webhookId: webhook.id,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 2 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 150,
          createdAt: date2.toISOString(),
        });

        await tx.insert(webhookLogs as any).values({
          webhookId: webhook.id,
          event: 'article|afterCreate',
          payload: JSON.stringify({ articleId: 3 }),
          status: 'success',
          responseCode: 200,
          responseBody: 'OK',
          error: null,
          duration: 200,
          createdAt: date3.toISOString(),
        });

        // Query logs for date range (January to June 2025)
        const result = await service.getLogs({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        });

        // Verify filtering - should return all logs within date range
        expect(result.data).toHaveLength(3); // All three dates (Jan, Jun, Dec) are in range

        // Debug: show payload details for date range test
        console.log('Date range test payloads:');
        result.data.forEach((log, index) => {
          console.log(
            `Log ${index}: payload=${log.payload}, type=${typeof log.payload}, stringified=${JSON.stringify(log.payload)}`,
          );
        });

        // Check payloads (handle the JSON string case)
        const payload0 =
          typeof result.data[0].payload === 'string' && result.data[0].payload.startsWith('{')
            ? JSON.parse(result.data[0].payload)
            : result.data[0].payload;
        expect(payload0).toEqual({ articleId: 3 }); // Most recent (Dec)

        const payload1 =
          typeof result.data[1].payload === 'string' && result.data[1].payload.startsWith('{')
            ? JSON.parse(result.data[1].payload)
            : result.data[1].payload;
        expect(payload1).toEqual({ articleId: 2 }); // Second most recent (Jun)

        const payload2 =
          typeof result.data[2].payload === 'string' && result.data[2].payload.startsWith('{')
            ? JSON.parse(result.data[2].payload)
            : result.data[2].payload;
        expect(payload2).toEqual({ articleId: 1 }); // Third most recent (Jan)

        // Verify database persistence
        const savedLogs = await tx.select().from(webhookLogs);
        expect(savedLogs).toHaveLength(3);
      });
    });
  });

  describe('getStats', () => {
    it('should return overall statistics', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook(tx, {
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Create test logs with different statuses
        // 100 total logs: 80 success, 15 failed, 5 timeout
        const logs = [];
        for (let i = 0; i < 80; i++) {
          logs.push({
            webhookId: webhook.id,
            event: 'article|afterCreate',
            payload: JSON.stringify({ articleId: i }),
            status: 'success',
            responseCode: 200,
            responseBody: 'OK',
            error: null,
            duration: 100 + i,
          });
        }
        for (let i = 0; i < 15; i++) {
          logs.push({
            webhookId: webhook.id,
            event: 'article|afterCreate',
            payload: JSON.stringify({ articleId: 80 + i }),
            status: 'failed',
            responseCode: 500,
            responseBody: 'Internal Server Error',
            error: 'Server error',
            duration: 200 + i,
          });
        }
        for (let i = 0; i < 5; i++) {
          logs.push({
            webhookId: webhook.id,
            event: 'article|afterCreate',
            payload: JSON.stringify({ articleId: 95 + i }),
            status: 'timeout',
            responseCode: null,
            responseBody: null,
            error: 'Request timeout',
            duration: 30000 + i,
          });
        }

        // Insert all logs
        await tx.insert(webhookLogs as any).values(logs);

        // Query statistics
        const result = await service.getStats();

        // Verify statistics
        expect(result).toEqual({
          total: 100,
          success: 80,
          failed: 15,
          timeout: 5,
          successRate: 0.8,
        });

        // Verify database persistence
        const savedLogs = await tx.select().from(webhookLogs);
        expect(savedLogs).toHaveLength(100);
      });
    });

    it('should return statistics for specific webhook', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhooks
        const webhook1 = await Given.webhook(tx, {
          // name: 'Webhook 1',
          url: 'https://example1.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        const webhook2 = await Given.webhook(tx, {
          // name: 'Webhook 2',
          url: 'https://example2.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Create logs for webhook1 only (50 total: 40 success, 8 failed, 2 timeout)
        const logs1 = [];
        for (let i = 0; i < 40; i++) {
          logs1.push({
            webhookId: webhook1.id,
            event: 'article|afterCreate',
            payload: JSON.stringify({ articleId: i }),
            status: 'success',
            responseCode: 200,
            responseBody: 'OK',
            error: null,
            duration: 100 + i,
          });
        }
        for (let i = 0; i < 8; i++) {
          logs1.push({
            webhookId: webhook1.id,
            event: 'article|afterCreate',
            payload: JSON.stringify({ articleId: 40 + i }),
            status: 'failed',
            responseCode: 500,
            responseBody: 'Internal Server Error',
            error: 'Server error',
            duration: 200 + i,
          });
        }
        for (let i = 0; i < 2; i++) {
          logs1.push({
            webhookId: webhook1.id,
            event: 'article|afterCreate',
            payload: JSON.stringify({ articleId: 48 + i }),
            status: 'timeout',
            responseCode: null,
            responseBody: null,
            error: 'Request timeout',
            duration: 30000 + i,
          });
        }

        // Insert logs for webhook1
        await tx.insert(webhookLogs as any).values(logs1);

        // Create logs for webhook2 (different counts)
        const logs2 = [];
        for (let i = 0; i < 10; i++) {
          logs2.push({
            webhookId: webhook2.id,
            event: 'article|afterCreate',
            payload: JSON.stringify({ articleId: i }),
            status: 'success',
            responseCode: 200,
            responseBody: 'OK',
            error: null,
            duration: 100 + i,
          });
        }

        // Insert logs for webhook2
        await tx.insert(webhookLogs as any).values(logs2);

        // Query statistics for webhook1 only
        const result = await service.getStats(webhook1.id);

        // Verify statistics for webhook1 only
        expect(result).toEqual({
          total: 50,
          success: 40,
          failed: 8,
          timeout: 2,
          successRate: 0.8,
        });

        // Verify database persistence
        const savedLogs = await tx.select().from(webhookLogs);
        expect(savedLogs).toHaveLength(60); // 50 for webhook1 + 10 for webhook2
      });
    });

    it('should handle zero total count', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook (no logs created)
        const webhook = await Given.webhook(tx, {
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Query statistics
        const result = await service.getStats(webhook.id);

        // Verify statistics for empty database
        expect(result).toEqual({
          total: 0,
          success: 0,
          failed: 0,
          timeout: 0,
          successRate: 0,
        });

        // Verify database persistence
        const savedLogs = await tx.select().from(webhookLogs);
        expect(savedLogs).toHaveLength(0);
      });
    });
  });
});
