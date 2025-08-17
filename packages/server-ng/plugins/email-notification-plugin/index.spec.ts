import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

const mockLogger = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

vi.mock('@nestjs/common', () => ({
  Logger: vi.fn().mockImplementation(() => mockLogger),
}));

import plugin from './index';

describe('EmailNotificationPlugin', () => {
  let mockContext: PluginContext;
  let mockConfig: any;
  let mockData: any;

  beforeEach(() => {
    // Reset mock calls
    vi.clearAllMocks();

    mockConfig = {
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        const configs = {
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: 'test@example.com',
          smtp_pass: 'password',
          email_from: 'test@example.com',
          email_to: ['admin@example.com'],
        };
        return configs[key as keyof typeof configs] ?? defaultValue;
      }),
    };

    mockData = {
      set: vi.fn(),
      get: vi.fn(),
      clear: vi.fn(),
    };

    mockContext = {
      config: mockConfig,
      data: mockData,
      settings: {
        register: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        listKeys: vi.fn().mockReturnValue([]),
        getRegistration: vi.fn(),
      } as any,
    } as unknown as PluginContext;
  });

  describe('Plugin Basic Info', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.name).toBe('email-notification-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toContain('邮件通知插件');
    });

    it('should have init and destroy methods', () => {
      expect(typeof plugin.init).toBe('function');
      expect(typeof plugin.destroy).toBe('function');
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize successfully', async () => {
      if (plugin.init) {
        await expect(plugin.init(mockContext)).resolves.not.toThrow();
      }
      expect(mockData.set).toHaveBeenCalledWith('email_enabled', true);
      expect(mockData.set).toHaveBeenCalledWith('emails_sent', 0);
    });

    it('should destroy successfully', async () => {
      if (plugin.destroy) {
        await expect(plugin.destroy(mockContext)).resolves.not.toThrow();
      }
      expect(mockData.clear).toHaveBeenCalled();
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      mockData.get.mockImplementation((key: string) => {
        if (key === 'email_enabled') return true;
        if (key === 'emails_sent') return 5;
        return null;
      });

      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        const configs: Record<string, any> = {
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: 'test@example.com',
          smtp_pass: 'password',
          email_from: 'noreply@example.com',
          email_to: ['admin@example.com'],
        };
        return configs[key] || defaultValue;
      });
    });

    it('should skip sending when email is disabled', async () => {
      mockData.get.mockImplementation((key: string) => {
        if (key === 'email_enabled') return false;
        return null;
      });

      // Test through hooks since sendEmail is not exported
      const handler = plugin.hooks?.['article|afterCreate']?.handler;
      if (!handler) throw new Error('Handler not found');
      const articleData = { title: 'Test Article' };

      await handler(articleData, mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('email-notification-plugin:邮件功能未启用，跳过发送'),
      );
    });
  });

  describe('Hook Handlers', () => {
    beforeEach(() => {
      mockData.get.mockImplementation((key: string) => {
        if (key === 'email_enabled') return true;
        if (key === 'emails_sent') return 5;
        return null;
      });

      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        const configs: Record<string, any> = {
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: 'test@example.com',
          smtp_pass: 'password',
          email_from: 'noreply@example.com',
          email_to: ['admin@example.com'],
        };
        return configs[key] || defaultValue;
      });
    });

    it('should have all required hooks', () => {
      expect(plugin.hooks).toBeDefined();
      expect(plugin.hooks?.['article|afterCreate']).toBeDefined();
      expect(plugin.hooks?.['article|afterUpdate']).toBeDefined();
      expect(plugin.hooks?.['comment|afterUpdate']).toBeDefined();
      expect(plugin.hooks?.['draft.published']).toBeDefined();

      // Check hook types and priorities
      expect(plugin.hooks?.['article|afterCreate']?.type).toBe('action');
      expect(plugin.hooks?.['article|afterCreate']?.priority).toBe(10);
    });

    it('should handle article creation hook', async () => {
      const articleData = {
        id: '1',
        title: 'Test Article',
        content: 'This is a test article content',
        author: 'Test Author',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const handler = plugin.hooks?.['article|afterCreate']?.handler;
      if (!handler) throw new Error('Handler not found');
      await handler(articleData, mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'email-notification-plugin:邮件发送成功: 📝 新文章发布：Test Article',
        ),
      );
    });

    it('should handle comment update hook', async () => {
      const commentData = {
        articleId: '1',
        author: 'Test Commenter',
        content: 'This is a test comment',
        email: 'commenter@example.com',
      };

      const handler = plugin.hooks?.['comment|afterUpdate']?.handler;
      if (!handler) throw new Error('Handler not found');
      await handler(commentData, mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('email-notification-plugin:邮件发送成功: 💬 评论系统更新通知'),
      );
    });

    it('should handle invalid data gracefully', async () => {
      const handler = plugin.hooks?.['article|afterCreate']?.handler;
      if (!handler) throw new Error('Handler not found');
      await handler(null, mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('email-notification-plugin:文章创建Hook收到无效数据，跳过邮件发送'),
      );
    });
  });
});
