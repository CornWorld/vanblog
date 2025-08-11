import { describe, it, expect, vi, beforeEach } from 'vitest';
import plugin from './index';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  createTransporter: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  })),
}));

describe('EmailNotificationPlugin', () => {
  let mockContext: PluginContext;
  let mockLogger: any;
  let mockConfig: any;
  let mockData: any;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockConfig = {
      get: vi.fn(),
    };

    mockData = {
      set: vi.fn(),
      get: vi.fn(),
      clear: vi.fn(),
    };

    mockContext = {
      logger: mockLogger,
      config: mockConfig,
      data: mockData,
    };
  });

  describe('Plugin Basic Info', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.name).toBe('email-notification-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toContain('邮件通知插件');
    });
  });

  describe('Plugin Initialization', () => {
    it('should initialize successfully with valid email config', async () => {
      // Mock valid email configuration
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

      await plugin.init(mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith('📧邮件通知插件正在初始化...');
      expect(mockLogger.log).toHaveBeenCalledWith('📧邮件配置验证成功');
      expect(mockLogger.log).toHaveBeenCalledWith('📧邮件通知插件初始化成功');
      expect(mockData.set).toHaveBeenCalledWith('email_enabled', true);
      expect(mockData.set).toHaveBeenCalledWith('emails_sent', 0);
    });

    it('should handle incomplete email config gracefully', async () => {
      // Mock incomplete email configuration
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        const configs: Record<string, any> = {
          smtp_host: '',
          smtp_port: 587,
          smtp_secure: false,
          smtp_user: '',
          smtp_pass: '',
          email_from: '',
          email_to: [],
        };
        return configs[key] || defaultValue;
      });

      await plugin.init(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith('📧邮件配置不完整，插件将不会发送邮件');
      expect(mockData.set).toHaveBeenCalledWith('email_enabled', false);
    });
  });

  describe('Plugin Destruction', () => {
    it('should destroy plugin and clean up data', async () => {
      mockData.get.mockResolvedValue(5);

      await plugin.destroy(mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith('📧邮件通知插件正在销毁...');
      expect(mockLogger.log).toHaveBeenCalledWith('📧插件已发送 5 封邮件');
      expect(mockData.clear).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('📧邮件通知插件销毁完成');
    });
  });

  describe('Email Configuration', () => {
    it('should return valid email config when all required fields are provided', async () => {
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

      const config = await plugin.getEmailConfig(mockContext);

      expect(config).toEqual({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password',
        },
        from: 'noreply@example.com',
        to: ['admin@example.com'],
      });
    });

    it('should return null when required fields are missing', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue: any) => {
        return defaultValue;
      });

      const config = await plugin.getEmailConfig(mockContext);

      expect(config).toBeNull();
    });
  });

  describe('Email Sending', () => {
    it('should send email successfully when enabled', async () => {
      mockData.get.mockImplementation((key: string) => {
        if (key === 'email_enabled') return true;
        if (key === 'emails_sent') return 0;
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

      await plugin.sendEmail(mockContext, 'Test Subject', 'Test Content');

      expect(mockLogger.log).toHaveBeenCalledWith('📧邮件发送成功: Test Subject');
      expect(mockData.set).toHaveBeenCalledWith('emails_sent', 1);
    });

    it('should skip sending when email is disabled', async () => {
      mockData.get.mockResolvedValue(false);

      await plugin.sendEmail(mockContext, 'Test Subject', 'Test Content');

      expect(mockLogger.warn).toHaveBeenCalledWith('📧邮件功能未启用，跳过发送');
    });
  });

  describe('Hook Handlers', () => {
    it('should have correct hook configurations', () => {
      expect(plugin.hooks).toBeDefined();
      expect(plugin.hooks['article|afterCreate']).toBeDefined();
      expect(plugin.hooks['article|afterUpdate']).toBeDefined();
      expect(plugin.hooks['comment|afterUpdate']).toBeDefined();
      expect(plugin.hooks['draft.published']).toBeDefined();

      // Check hook types and priorities
      expect(plugin.hooks['article|afterCreate'].type).toBe('action');
      expect(plugin.hooks['article|afterCreate'].priority).toBe(10);
    });

    it('should handle article creation hook', async () => {
      const articleData = {
        id: '1',
        title: 'Test Article',
        content: 'This is a test article content',
        author: 'Test Author',
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockData.get.mockResolvedValue(true);
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

      const handler = plugin.hooks['article|afterCreate'].handler;
      await handler(articleData, mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('📧邮件发送成功: 📝 新文章发布：Test Article'),
      );
    });

    it('should handle comment update hook', async () => {
      const commentData = {
        articleId: '1',
        author: 'Test Commenter',
        content: 'This is a test comment',
        email: 'commenter@example.com',
      };

      mockData.get.mockResolvedValue(true);
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

      const handler = plugin.hooks['comment|afterUpdate'].handler;
      await handler(commentData, mockContext);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('📧邮件发送成功: 💬 评论系统更新通知'),
      );
    });
  });
});
