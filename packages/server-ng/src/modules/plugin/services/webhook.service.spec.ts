/**
 * WebhookService - Core CRUD Tests (MIGRATED TO REAL DATABASE)
 *
 * 测试 Webhook 核心 CRUD 操作
 *
 * 测试覆盖：
 * - CRUD 操作（create, findAll, findOne, update, remove）+ ORM 验证
 * - Webhook 触发逻辑（trigger, triggerForEvent）
 * - Webhook 测试功能（test）+ 错误场景
 * - Webhook 注册表集成
 * - 事件订阅过滤
 * - 错误场景（URL格式错误、执行失败、超时、重试）
 *
 * 迁移说明：
 * - 从 Mock.db() 迁移到真实数据库 + withTestTransaction
 * - 使用真实的 Drizzle ORM 查询验证数据持久化
 * - 保留外部服务 Mock（fetch, webhookRegistry）
 * - 每个测试使用独立事务，自动回滚
 *
 * 相关测试：
 * - webhook.service.execution.spec.ts - 执行与重试机制
 * - webhook.service.security.spec.ts - 安全验证
 * - webhook.service.logging.spec.ts - 日志与统计
 */

import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../../database';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { Given } from '@test/given';
import { webhooks, webhookLogs } from '../entities/webhook.schema';
import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookService } from './webhook.service';

// Mock fetch globally
global.fetch = vi.fn();

// Helper functions for random data generation
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomUrl = () => `https://example${randomInt(1, 999)}.com/webhook`;
const randomEvent = () => {
  const events = ['article|afterCreate', 'article|afterUpdate', 'draft|afterPublish', 'comment|afterCreate'];
  return events[randomInt(0, events.length - 1)];
};

describe('WebhookService', () => {
  let service: WebhookService;
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

  describe('create', () => {
    it('should create a webhook with active registration and verify in database', async () => {
      await withTestTransaction(db, async (tx) => {
        // Inject transaction DB into service
        service['db'] = tx;

        const createDto = {
          name: `Webhook-${randomInt(1000, 9999)}`,
          url: randomUrl(),
          events: [randomEvent(), randomEvent()],
          secret: `secret-${randomInt(100, 999)}`,
          active: true,
          retryCount: randomInt(1, 5),
          timeout: randomInt(5000, 30000),
        };

        // Business method call
        const result = await service.create(createDto);

        // Assertions on returned data
        expect(result).toBeDefined();
        expect(result.name).toBe(createDto.name);
        expect(result.url).toBe(createDto.url);
        expect(result.events).toEqual(createDto.events);
        expect(result.active).toBe(true);
        expect(result.secret).toBe(createDto.secret);
        expect(result.retryCount).toBe(createDto.retryCount);
        expect(result.timeout).toBe(createDto.timeout);

        // Verify webhook was registered
        expect(mockWebhookRegistry.registerWebhook).toHaveBeenCalledWith(result.id, createDto.events);

        // ORM direct query verification (read-write separation)
        const [saved] = await tx.select().from(webhooks).where(eq(webhooks.id, result.id));
        expect(saved).toBeDefined();
        expect(saved.name).toBe(createDto.name);
        expect(saved.url).toBe(createDto.url);
        expect(saved.active).toBe(true);
        expect(saved.secret).toBe(createDto.secret);
      });
    });

    it('should create webhook without registration if inactive', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const createDto = {
          name: `Inactive-${randomInt(1000, 9999)}`,
          url: randomUrl(),
          events: [randomEvent()],
          active: false,
          retryCount: 3,
          timeout: 30000,
        };

        const result = await service.create(createDto);

        expect(result.active).toBe(false);
        expect(mockWebhookRegistry.registerWebhook).not.toHaveBeenCalled();

        // Verify database state
        const [saved] = await tx.select().from(webhooks).where(eq(webhooks.id, result.id));
        expect(saved.active).toBe(false);
      });
    });

    it('should handle database errors gracefully', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // This test verifies that the service can handle database errors
        // without crashing - the database constraints will handle validation
        const createDto = {
          name: `Webhook-${randomInt(1000, 9999)}`,
          url: randomUrl(),
          events: [randomEvent()],
          active: true,
          retryCount: 3,
          timeout: 30000,
        };

        // Create a webhook successfully
        const result = await service.create(createDto);
        expect(result).toBeDefined();

        // Try to create duplicate (should fail due to unique constraint on name)
        await expect(service.create(createDto)).rejects.toThrow();
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated webhooks', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // Create test webhooks
        await Given.webhook({
          name: `Webhook ${randomInt(1, 10)}`,
          url: randomUrl(),
          events: [randomEvent()],
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        await Given.webhook({
          name: `Webhook ${randomInt(11, 20)}`,
          url: randomUrl(),
          events: [randomEvent()],
          active: false,
          retryCount: 3,
          timeout: 30000,
        });

        const result = await service.findAll({ page: 1, limit: 10 });

        expect(result.data).toBeDefined();
        expect(result.pagination).toEqual({
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        });
        expect(result.data[0].events).toBeDefined();
        expect(Array.isArray(result.data[0].events)).toBe(true);
      });
    });

    it('should filter by active status', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // Create active and inactive webhooks
        await Given.webhook({
          // name: 'Active Webhook',
          url: randomUrl(),
          events: [randomEvent()],
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        await Given.webhook({
          // name: 'Inactive Webhook',
          url: randomUrl(),
          events: [randomEvent()],
          active: false,
          retryCount: 3,
          timeout: 30000,
        });

        const result = await service.findAll({ active: true });

        expect(result.data.every((w: any) => w.active === true)).toBe(true);
      });
    });

    it('should filter by event', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const event = 'article|afterCreate';

        await Given.webhook({
          // name: 'Article Webhook',
          url: randomUrl(),
          events: [event],
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        await Given.webhook({
          // name: 'Draft Webhook',
          url: randomUrl(),
          events: ['draft|afterPublish'],
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        const result = await service.findAll({ event });

        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.every((w: any) => w.events.includes(event))).toBe(true);
      });
    });
  });

  describe('findOne', () => {
    it('should return a webhook by id and verify database state', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          name: `Webhook-${randomInt(1, 100)}`,
          url: randomUrl(),
          events: [randomEvent()],
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        const result = await service.findOne(webhook.id);

        expect(result).toBeDefined();
        expect(result?.id).toBe(webhook.id);
        expect(result?.events).toBeDefined();
        expect(Array.isArray(result?.events)).toBe(true);
        expect(mockWebhookRegistry.unregisterWebhookFromAllEvents).toHaveBeenCalledWith(webhook.id);
        expect(mockWebhookRegistry.registerWebhook).toHaveBeenCalled();

        // Verify database state
        const [saved] = await tx.select().from(webhooks).where(eq(webhooks.id, webhook.id));
        expect(saved).toBeDefined();
        expect(saved.name).toBe(webhook.name);
      });
    });

    it('should return null if webhook not found', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const result = await service.findOne(999999);

        expect(result).toBeNull();
      });
    });

    it('should not register inactive webhook', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          name: `Inactive-${randomInt(1, 100)}`,
          url: randomUrl(),
          events: [randomEvent()],
          active: false,
          retryCount: 3,
          timeout: 30000,
        });

        await service.findOne(webhook.id);

        expect(mockWebhookRegistry.unregisterWebhookFromAllEvents).toHaveBeenCalledWith(webhook.id);
        expect(mockWebhookRegistry.registerWebhook).not.toHaveBeenCalled();
      });
    });
  });

  describe('update', () => {
    it('should update a webhook and verify in database', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          name: 'Original Name',
          url: randomUrl(),
          events: [randomEvent()],
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        // Update only non-unique fields to avoid constraint violations
        const updateDto = {
          url: randomUrl(),
          active: false,
        };

        const result = await service.update(webhook.id, updateDto);

        expect(result).toBeDefined();
        expect(result?.url).toBe(updateDto.url);
        expect(result?.active).toBe(updateDto.active);

        // ORM direct query verification
        const [saved] = await tx.select().from(webhooks).where(eq(webhooks.id, webhook.id));
        expect(saved).toBeDefined();
        expect(saved.url).toBe(updateDto.url);
        expect(saved.active).toBe(updateDto.active);
      });
    });

    it('should return null if webhook not found', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const result = await service.update(999999, { name: 'Not Found' });

        expect(result).toBeNull();
      });
    });
  });

  describe('remove', () => {
    it('should delete a webhook and verify removal from database', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          name: `Webhook-${randomInt(1, 100)}`,
          url: randomUrl(),
          events: [randomEvent()],
          active: true,
          retryCount: 3,
          timeout: 30000,
        });

        await service.remove(webhook.id);

        expect(mockWebhookRegistry.unregisterWebhookFromAllEvents).toHaveBeenCalledWith(webhook.id);

        // ORM direct query verification - should not exist
        const saved = await tx.select().from(webhooks).where(eq(webhooks.id, webhook.id));
        expect(saved).toHaveLength(0);
      });
    });
  });

  describe('trigger', () => {
    it('should trigger webhooks for an event and log execution', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // Create webhooks
        await Given.webhook({
          name: `Webhook ${randomInt(1, 10)}`,
          url: randomUrl(),
          events: ['article|afterCreate', 'article|afterUpdate'],
          secret: null,
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        await Given.webhook({
          name: `Webhook ${randomInt(11, 20)}`,
          url: randomUrl(),
          events: ['article|afterCreate'],
          secret: `secret-${randomInt(100, 999)}`,
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock successful fetch
        (global.fetch as Mock).mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
        });

        await service.trigger('article|afterCreate', { articleId: randomInt(1, 100) });

        expect(global.fetch).toHaveBeenCalledTimes(2);

        // Verify logs were created
        const logs = await tx.select().from(webhookLogs);
        expect(logs.length).toBeGreaterThan(0);
      });
    });

    it('should only trigger webhooks subscribed to the event', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        await Given.webhook({
          // name: 'Webhook 1',
          url: randomUrl(),
          events: ['article|afterCreate'],
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        await Given.webhook({
          // name: 'Webhook 2',
          url: randomUrl(),
          events: ['draft|afterPublish'],
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        (global.fetch as Mock).mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
        });

        await service.trigger('article|afterCreate', { articleId: 1 });

        // Only one webhook should be triggered
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle webhook execution failure', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        await Given.webhook({
          // name: 'Failing Webhook',
          url: randomUrl(),
          events: ['article|afterCreate'],
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock failed fetch (HTTP 500)
        (global.fetch as Mock).mockResolvedValue({
          ok: false,
          status: 500,
          text: vi.fn().mockResolvedValue('Internal Server Error'),
        });

        await service.trigger('article|afterCreate', { articleId: 1 });

        // Verify error was logged
        const logs = await tx.select().from(webhookLogs);
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].status).toBe('failed');
      });
    });

    it('should handle webhook timeout error', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        await Given.webhook({
          // name: 'Timeout Webhook',
          url: randomUrl(),
          events: ['article|afterCreate'],
          active: true,
          retryCount: 1,
          timeout: 100,
        });

        // Mock timeout error
        const abortError = new Error('Timeout');
        abortError.name = 'AbortError';
        (global.fetch as Mock).mockRejectedValue(abortError);

        await service.trigger('article|afterCreate', { articleId: 1 });

        // Verify timeout was logged
        const logs = await tx.select().from(webhookLogs);
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].status).toBe('timeout');
      });
    });
  });

  describe('triggerForEvent', () => {
    it('should call trigger method', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const triggerSpy = vi.spyOn(service, 'trigger').mockResolvedValue();

        await service.triggerForEvent('article|afterCreate', { articleId: randomInt(1, 100) });

        expect(triggerSpy).toHaveBeenCalledWith('article|afterCreate', expect.any(Object));

        triggerSpy.mockRestore();
      });
    });
  });

  describe('test', () => {
    it('should execute a test webhook successfully', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          url: randomUrl(),
          events: [randomEvent()],
          secret: null,
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        (global.fetch as Mock).mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
        });

        const result = await service.test(webhook.id, {
          event: 'article|afterCreate',
          payload: { test: true },
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe('success');
        expect(result.responseCode).toBe(200);
      });
    });

    it('should throw error if webhook not found', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        await expect(
          service.test(999999, {
            event: 'test|event',
            payload: {},
          }),
        ).rejects.toThrow('Webhook not found');
      });
    });

    it('should handle test webhook execution failure (HTTP 4xx)', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          url: randomUrl(),
          events: [randomEvent()],
          secret: null,
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock HTTP 400 error
        (global.fetch as Mock).mockResolvedValue({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue('Bad Request'),
        });

        const result = await service.test(webhook.id, {
          event: 'article|afterCreate',
          payload: { test: true },
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.responseCode).toBe(400);
        expect(result.error).toContain('HTTP 400');
      });
    });

    it('should handle test webhook network error', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          url: randomUrl(),
          events: [randomEvent()],
          secret: null,
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock network error
        (global.fetch as Mock).mockRejectedValue(new Error('Network unreachable'));

        const result = await service.test(webhook.id, {
          event: 'article|afterCreate',
          payload: { test: true },
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.error).toContain('Network unreachable');
      });
    });

    it('should handle test webhook retry exhaustion', async () => {
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        const webhook = await Given.webhook({
          url: randomUrl(),
          events: [randomEvent()],
          secret: null,
          active: true,
          retryCount: 3,
          timeout: 5000,
        });

        // Mock all retries failing
        (global.fetch as Mock).mockRejectedValue(new Error('Connection refused'));

        vi.useFakeTimers();

        const testPromise = service.test(webhook.id, {
          event: 'article|afterCreate',
          payload: { test: true },
        });

        // Fast-forward through retries
        await vi.advanceTimersByTimeAsync(10000);

        const result = await testPromise;

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(3);
        expect(global.fetch).toHaveBeenCalledTimes(3);

        vi.useRealTimers();
      });
    });
  });
});
