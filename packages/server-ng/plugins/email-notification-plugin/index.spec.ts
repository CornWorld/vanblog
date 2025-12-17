import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PluginAPI } from '@vanblog/shared/plugin';

import plugin from './index';

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

describe('Email Notification Plugin (Functional API)', () => {
  let mockAPI: Partial<PluginAPI>;
  let storeValues: Map<string, any>;
  let actionHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    storeValues = new Map();
    actionHandlers = new Map();

    mockAPI = {
      id: 'email-notification-plugin',
      version: '1.0.0',
      dir: '/path/to/plugin',
      config: {
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: 'test@example.com',
        smtp_pass: 'password',
        email_from: 'noreply@example.com',
        email_to: ['admin@example.com'],
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
      filter: vi.fn(),
      action: vi.fn((name: string, handler: Function) => {
        actionHandlers.set(name, handler);
      }),
      shortcode: vi.fn(),
      provide: vi.fn(),
      store: vi.fn((key: string, defaultValue: any) => ({
        get value() {
          return storeValues.has(key) ? storeValues.get(key) : defaultValue;
        },
        set value(newValue: any) {
          storeValues.set(key, newValue);
        },
      })),
      onActivate: vi.fn(),
      onDeactivate: vi.fn(),
      onConfigChange: vi.fn(),
    };
  });

  it('should load plugin successfully', () => {
    expect(() => {
      plugin(mockAPI as PluginAPI);
    }).not.toThrow();
    expect(mockAPI.log?.info).toHaveBeenCalledWith('邮件通知插件正在初始化...');
  });

  it('should register action hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.action).toHaveBeenCalledWith('article.afterCreate', expect.any(Function));
    expect(mockAPI.action).toHaveBeenCalledWith('article.afterUpdate', expect.any(Function));
    expect(mockAPI.action).toHaveBeenCalledWith('comment.afterUpdate', expect.any(Function));
    expect(mockAPI.action).toHaveBeenCalledWith('draft.afterPublish', expect.any(Function));
  });

  it('should register lifecycle hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onActivate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockAPI.onDeactivate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should initialize stores', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.store).toHaveBeenCalledWith('email_enabled', false);
    expect(mockAPI.store).toHaveBeenCalledWith('emails_sent', 0);
  });

  describe('Email Configuration', () => {
    it('should enable email when config is complete', () => {
      let activateCallback: Function | undefined;
      mockAPI.onActivate = vi.fn((cb) => {
        activateCallback = cb;
      });

      plugin(mockAPI as PluginAPI);
      activateCallback?.();

      expect(mockAPI.log?.info).toHaveBeenCalledWith('邮件配置验证成功');
      expect(storeValues.get('email_enabled')).toBe(true);
    });

    it('should disable email when config is incomplete', () => {
      mockAPI.config = {
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        smtp_pass: '',
        email_from: '',
        email_to: [],
      };

      let activateCallback: Function | undefined;
      mockAPI.onActivate = vi.fn((cb) => {
        activateCallback = cb;
      });

      plugin(mockAPI as PluginAPI);
      activateCallback?.();

      expect(mockAPI.log?.warn).toHaveBeenCalledWith('邮件配置不完整，插件将不会发送邮件');
      expect(storeValues.get('email_enabled')).toBe(false);
    });
  });

  describe('Action Handlers', () => {
    beforeEach(() => {
      // Enable email
      storeValues.set('email_enabled', true);
    });

    it('should handle article.afterCreate', async () => {
      plugin(mockAPI as PluginAPI);

      const handler = actionHandlers.get('article.afterCreate');
      expect(handler).toBeDefined();

      const article = {
        id: '1',
        title: 'Test Article',
        content: 'This is a test article content',
        author: 'Test Author',
        createdAt: '2024-01-01T00:00:00Z',
      };

      handler?.(article);

      // Wait for async email send
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAPI.log?.info).toHaveBeenCalledWith(
        expect.stringContaining('邮件发送成功: 📝 新文章发布：Test Article'),
      );
    });

    it('should handle article.afterUpdate', async () => {
      plugin(mockAPI as PluginAPI);

      const handler = actionHandlers.get('article.afterUpdate');
      expect(handler).toBeDefined();

      const article = {
        title: 'Updated Article',
        content: 'Updated content',
        author: 'Test Author',
        updatedAt: '2024-01-02T00:00:00Z',
      };

      handler?.(article);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAPI.log?.info).toHaveBeenCalledWith(
        expect.stringContaining('邮件发送成功: ✏️ 文章更新：Updated Article'),
      );
    });

    it('should handle comment.afterUpdate', async () => {
      plugin(mockAPI as PluginAPI);

      const handler = actionHandlers.get('comment.afterUpdate');
      expect(handler).toBeDefined();

      const comment = {
        articleId: '1',
        author: 'Commenter',
        content: 'Test comment',
        email: 'test@example.com',
      };

      handler?.(comment);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAPI.log?.info).toHaveBeenCalledWith(
        expect.stringContaining('邮件发送成功: 💬 评论系统更新通知'),
      );
    });

    it('should handle draft.afterPublish', async () => {
      plugin(mockAPI as PluginAPI);

      const handler = actionHandlers.get('draft.afterPublish');
      expect(handler).toBeDefined();

      const draft = {
        title: 'Published Draft',
        author: 'Test Author',
        articleId: 123,
        publishedAt: '2024-01-01T00:00:00Z',
        content: 'Draft content',
      };

      handler?.(draft);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAPI.log?.info).toHaveBeenCalledWith(
        expect.stringContaining('邮件发送成功: 📢 草稿发布通知：Published Draft'),
      );
    });

    it('should skip sending when email is disabled', async () => {
      storeValues.set('email_enabled', false);

      plugin(mockAPI as PluginAPI);

      const handler = actionHandlers.get('article.afterCreate');
      handler?.({ title: 'Test' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockAPI.log?.warn).toHaveBeenCalledWith('邮件功能未启用，跳过发送');
    });

    it('should increment email count on successful send', async () => {
      plugin(mockAPI as PluginAPI);

      const handler = actionHandlers.get('article.afterCreate');
      handler?.({ title: 'Test' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(storeValues.get('emails_sent')).toBe(1);
    });
  });

  describe('Deactivation', () => {
    it('should log email count on deactivate', () => {
      storeValues.set('emails_sent', 5);

      let deactivateCallback: Function | undefined;
      mockAPI.onDeactivate = vi.fn((cb) => {
        deactivateCallback = cb;
      });

      plugin(mockAPI as PluginAPI);
      deactivateCallback?.();

      expect(mockAPI.log?.info).toHaveBeenCalledWith('插件销毁，共发送 5 封邮件');
    });
  });
});
