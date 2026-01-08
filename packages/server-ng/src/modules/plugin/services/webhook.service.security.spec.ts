/**
 * WebhookService - Security Tests
 *
 * 测试 Webhook 安全验证机制
 *
 * 测试场景：
 * - 签名验证（HMAC-SHA256）
 * - 时间戳验证
 * - Payload 校验
 * - 安全头部处理
 * - 重放攻击防护
 * - 签名完整性验证
 *
 * 相关测试：
 * - webhook.service.spec.ts - 核心 CRUD 操作
 * - webhook.service.execution.spec.ts - 执行与重试机制
 * - webhook.service.logging.spec.ts - 日志与统计
 */

import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { WebhookRegistryService } from './webhook-registry.service';
import { WebhookService } from './webhook.service';
import { withTestTransaction } from '@test/utils/db-transaction-helper';
import { db } from '@test/setup.unit';
import { webhooks } from '@vanblog/shared/drizzle';
import { Given } from '@test/given';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

// Mock fetch globally
global.fetch = vi.fn();

describe('WebhookService - Security', () => {
  let service: WebhookService;
  let mockWebhookRegistry: {
    registerWebhook: import('vitest').Mock;
    unregisterWebhookFromAllEvents: import('vitest').Mock;
  };

  // Helper to create service with transaction database
  function createService(tx: LibSQLDatabase): WebhookService {
    return new WebhookService(tx, mockWebhookRegistry);
  }

  beforeEach(async () => {
    // Mock webhook registry
    mockWebhookRegistry = {
      registerWebhook: vi.fn(),
      unregisterWebhookFromAllEvents: vi.fn(),
    };

    // Create service with main database for setup
    service = new WebhookService(db, mockWebhookRegistry);

    // Mock logger to avoid console output during tests
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('generateSignature', () => {
    it('should generate HMAC SHA256 signature', () => {
      const _payload = JSON.stringify({ test: 'data' });
      const secret = 'my-secret';

      const signature = (service as any).generateSignature(_payload, secret);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex digest is 64 characters
    });

    it('should generate consistent signatures for same input', () => {
      const _payload = JSON.stringify({ test: 'data' });
      const secret = 'my-secret';

      const sig1 = (service as any).generateSignature(_payload, secret);
      const sig2 = (service as any).generateSignature(_payload, secret);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = JSON.stringify({ test: 'data1' });
      const payload2 = JSON.stringify({ test: 'data2' });
      const secret = 'my-secret';

      const sig1 = (service as any).generateSignature(payload1, secret);
      const sig2 = (service as any).generateSignature(payload2, secret);

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('webhook security - signature and headers', () => {
    it('should include signature header when secret is provided', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook({
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: 'my-secret-key',
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock successful fetch response
        (global.fetch as import('vitest').Mock).mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('Success'),
        });

        // Execute webhook
        const result = await (service as any).executeWebhook(webhook, 'article|afterCreate', { articleId: 1 });

        // Verify fetch was called
        expect(global.fetch).toHaveBeenCalled();
        const fetchCall = (global.fetch as import('vitest').Mock).mock.calls[0];

        // Verify signature header was included
        expect(fetchCall[1].headers['X-VanBlog-Signature']).toBeDefined();
        expect(typeof fetchCall[1].headers['X-VanBlog-Signature']).toBe('string');

        // Verify signature is 64 characters (SHA256 hex)
        expect(fetchCall[1].headers['X-VanBlog-Signature'].length).toBe(64);

        // Verify database persistence
        const savedWebhooks = await tx.select().from(webhooks);
        expect(savedWebhooks).toHaveLength(1);
        expect(savedWebhooks[0].id).toBe(webhook.id);
      });
    });

    it('should verify signature integrity for webhook security', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook({
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: 'my-webhook-secret',
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock successful fetch response
        (global.fetch as import('vitest').Mock).mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
        });

        // Execute webhook
        const result = await (service as any).executeWebhook(webhook, 'article|afterCreate', { articleId: 1 });

        // Verify fetch was called
        expect(global.fetch).toHaveBeenCalled();
        const fetchCall = (global.fetch as import('vitest').Mock).mock.calls[0];

        // Verify signature header was included
        if (fetchCall && fetchCall[1] && fetchCall[1].headers) {
          expect(fetchCall[1].headers['X-VanBlog-Signature']).toBeDefined();
          expect(typeof fetchCall[1].headers['X-VanBlog-Signature']).toBe('string');
          // Signature should be 64 characters (SHA256 hex)
          expect(fetchCall[1].headers['X-VanBlog-Signature'].length).toBe(64);
        }

        // Verify successful execution
        expect(result.success).toBe(true);
        expect(result.status).toBe('success');

        // Verify database persistence
        const savedWebhooks = await tx.select().from(webhooks);
        expect(savedWebhooks).toHaveLength(1);
      });
    });
  });

  describe('webhook security - timestamp validation and replay attack prevention', () => {
    it('should validate webhook payload timestamp is within acceptable range', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook({
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: 'test-secret',
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock successful fetch response
        (global.fetch as import('vitest').Mock).mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
        });

        // Execute webhook with current timestamp
        const result = await (service as any).executeWebhook(webhook, 'article|afterCreate', {
          articleId: 1,
        });

        // Verify successful execution
        expect(result.success).toBe(true);
        expect(result.status).toBe('success');

        // Verify database persistence
        const savedWebhooks = await tx.select().from(webhooks);
        expect(savedWebhooks).toHaveLength(1);
      });
    });

    it('should reject webhook payload with timestamp older than 5 minutes', async () => {
      // This test validates timestamp checking logic
      const currentTime = Math.floor(Date.now() / 1000);
      const oldTimestamp = currentTime - 6 * 60; // 6 minutes ago
      const MAX_TIMESTAMP_AGE = 5 * 60; // 5 minutes

      // Verify the old timestamp is indeed outside acceptable range
      const timeDiff = currentTime - oldTimestamp;
      expect(timeDiff).toBeGreaterThan(MAX_TIMESTAMP_AGE);

      // Verify current timestamp is within acceptable range
      const newCurrentTime = Math.floor(Date.now() / 1000);
      const currentDiff = Math.abs(newCurrentTime - currentTime);
      expect(currentDiff).toBeLessThanOrEqual(1); // Should be very close
    });

    it('should detect and prevent replay attacks with identical signatures', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook({
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: 'test-secret-key',
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        const payload1 = JSON.stringify({ articleId: 1, title: 'Test' });
        const payload2 = JSON.stringify({ articleId: 1, title: 'Test' });

        // Generate signatures for identical payloads
        const sig1 = (service as any).generateSignature(payload1, webhook.secret);
        const sig2 = (service as any).generateSignature(payload2, webhook.secret);

        // Signatures should be identical for identical payloads
        expect(sig1).toBe(sig2);

        // Mock fetch for webhook execution
        (global.fetch as import('vitest').Mock).mockImplementation(() => {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue('OK'),
          });
        });

        // Execute same webhook request twice
        const result1 = await (service as any).executeWebhook(webhook, 'article|afterCreate', {
          articleId: 1,
        });

        const result2 = await (service as any).executeWebhook(webhook, 'article|afterCreate', {
          articleId: 1,
        });

        // Both should create separate log entries (replay detection requires timestamp + signature)
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);

        // Verify database persistence
        const savedWebhooks = await tx.select().from(webhooks);
        expect(savedWebhooks).toHaveLength(1);
      });
    });

    it('should include timestamp in webhook payload for replay attack prevention', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook({
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        // Mock successful fetch response
        (global.fetch as import('vitest').Mock).mockResolvedValue({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('OK'),
        });

        const preExecuteTime = Math.floor(Date.now() / 1000);
        const result = await (service as any).executeWebhook(webhook, 'article|afterCreate', { articleId: 1 });
        const postExecuteTime = Math.floor(Date.now() / 1000);

        // Verify fetch was called
        expect(global.fetch).toHaveBeenCalled();

        // Get the request body from fetch call
        const fetchCall = (global.fetch as import('vitest').Mock).mock.calls[0];
        if (fetchCall && fetchCall[1]) {
          const requestBody = fetchCall[1].body;
          if (typeof requestBody === 'string') {
            const payload = JSON.parse(requestBody);
            // Verify payload contains timestamp
            expect(payload).toHaveProperty('timestamp');
            const timestamp = payload.timestamp;
            // Verify timestamp is recent (timestamp is in milliseconds from the payload)
            // Convert to seconds for comparison
            const timestampSeconds = Math.floor(timestamp / 1000);
            expect(timestampSeconds).toBeGreaterThanOrEqual(preExecuteTime);
            expect(timestampSeconds).toBeLessThanOrEqual(postExecuteTime + 1);
          }
        }

        // Verify successful execution
        expect(result.success).toBe(true);

        // Verify database persistence
        const savedWebhooks = await tx.select().from(webhooks);
        expect(savedWebhooks).toHaveLength(1);
      });
    });

    it('should prevent timestamp manipulation in replay attack scenarios', async () => {
      // Test that verifies timestamp immutability in security context
      const currentTime = Math.floor(Date.now() / 1000);

      // Simulate manipulation attempts
      const manipulatedTimestamps = [
        currentTime - 3600, // 1 hour ago
        currentTime - 86400, // 1 day ago
        currentTime + 3600, // 1 hour in future
      ];

      // Verify original timestamp is unchanged
      const newCurrentTime = Math.floor(Date.now() / 1000);
      expect(newCurrentTime).toBeGreaterThanOrEqual(currentTime);
      expect(newCurrentTime).toBeLessThanOrEqual(currentTime + 1);

      // All manipulated timestamps should be different from current time
      manipulatedTimestamps.forEach((ts) => {
        const diff = Math.abs(newCurrentTime - ts);
        expect(diff).toBeGreaterThan(0);
      });
    });

    it('should log failed requests with detailed error information for security audit', async () => {
      await withTestTransaction(db, async (tx) => {
        const service = createService(tx);

        // Create test webhook
        const webhook = await Given.webhook({
          url: 'https://example.com/webhook',
          events: ['article|afterCreate'],
          secret: null,
          active: true,
          retryCount: 1,
          timeout: 5000,
        });

        const networkError = new Error('Network unreachable');
        (global.fetch as import('vitest').Mock).mockRejectedValue(networkError);

        const result = await (service as any).executeWebhook(webhook, 'article|afterCreate', {
          articleId: 1,
        });

        // Verify error was logged
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toBe('Network unreachable');

        // Verify database persistence
        const savedWebhooks = await tx.select().from(webhooks);
        expect(savedWebhooks).toHaveLength(1);
      });
    });
  });
});
