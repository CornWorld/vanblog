import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { CommentService } from './comment.service';

import type { WalineSetting } from './comment.schema';

describe('CommentService', () => {
  let service: CommentService;
  let settingService: SettingCoreService;
  let hookService: HookService;

  const mockWalineSetting: WalineSetting = {
    'smtp.enabled': true,
    'smtp.port': 587,
    'smtp.host': 'smtp.example.com',
    'smtp.user': 'user@example.com',
    'smtp.password': 'password',
    'sender.name': 'VanBlog',
    'sender.email': 'noreply@example.com',
    authorEmail: 'admin@example.com',
    webhook: 'https://example.com/webhook',
    forceLoginComment: false,
    otherConfig: '{"key":"value"}',
    serverURL: 'https://waline.example.com',
  };

  beforeEach(async () => {
    const mockSettingService = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getSiteInfo: vi.fn(),
    };

    const mockConfigService = {
      get: vi.fn(),
    };

    const mockHookService = {
      applyFilters: vi.fn(async (_hookName, data) => Promise.resolve(data)),
      doAction: vi.fn(async () => Promise.resolve()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: SettingCoreService,
          useValue: mockSettingService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HookService,
          useValue: mockHookService,
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    settingService = module.get(SettingCoreService);
    hookService = module.get(HookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWalineSetting', () => {
    it('should return waline setting', async () => {
      vi.mocked(settingService.getConfig).mockResolvedValue(mockWalineSetting);

      const result = await service.getWalineSetting();

      expect(result).toEqual(mockWalineSetting);
      expect(settingService.getConfig).toHaveBeenCalledWith('walineSetting', expect.any(Object));
    });

    it('should return default setting if no setting found', async () => {
      vi.mocked(settingService.getConfig).mockResolvedValue(null);

      const result = await service.getWalineSetting();

      expect(result).toBeDefined();
      expect(result['smtp.enabled']).toBe(false);
    });
  });

  describe('updateWalineSetting', () => {
    it('should update waline setting and restart service', async () => {
      const updateData = { 'smtp.enabled': false };
      const updatedSetting = { ...mockWalineSetting, ...updateData };

      vi.mocked(settingService.getConfig).mockImplementation(async () =>
        Promise.resolve(mockWalineSetting),
      );
      vi.mocked(settingService.updateConfig).mockImplementation(async () =>
        Promise.resolve(updatedSetting),
      );
      vi.spyOn(service, 'restart').mockImplementation(async () => Promise.resolve());

      const result = await service.updateWalineSetting(updateData);

      expect(result).toEqual(updatedSetting);
      expect(settingService.updateConfig).toHaveBeenCalledWith('walineSetting', updatedSetting);
      expect(service.restart).toHaveBeenCalledWith('配置更新');
    });

    it('should trigger beforeUpdate and afterUpdate hooks', async () => {
      const updateData = { 'smtp.enabled': false };
      const updatedSetting = { ...mockWalineSetting, ...updateData };

      vi.mocked(settingService.getConfig).mockImplementation(async () =>
        Promise.resolve(mockWalineSetting),
      );
      vi.mocked(settingService.updateConfig).mockImplementation(async () =>
        Promise.resolve(updatedSetting),
      );
      vi.spyOn(service, 'restart').mockImplementation(async () => Promise.resolve());

      await service.updateWalineSetting(updateData);

      expect(hookService.applyFilters).toHaveBeenCalledWith('comment|beforeUpdate', updateData, {
        action: 'update',
        existing: mockWalineSetting,
      });
      expect(hookService.doAction).toHaveBeenCalledWith('comment|afterUpdate', updatedSetting, {
        action: 'update',
        previous: mockWalineSetting,
        changes: updateData,
      });
    });
  });

  describe('Hook Integration', () => {
    it('should trigger start hooks when starting Waline', async () => {
      vi.spyOn(service as any, 'loadEnv').mockImplementation(async () => Promise.resolve());
      vi.spyOn(service, 'stop').mockImplementation(async () => Promise.resolve());

      // Mock process spawn to avoid actual process creation
      const mockProcess = {
        pid: 12345,
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };
      vi.doMock('node:child_process', () => ({
        spawn: vi.fn(() => mockProcess),
      }));

      await service.start();

      expect(hookService.doAction).toHaveBeenCalledWith(
        'comment|beforeStart',
        {},
        { action: 'start' },
      );
    });

    it('should trigger restart hooks when restarting Waline', async () => {
      const reason = '测试重启';
      vi.spyOn(service, 'stop').mockResolvedValue();
      vi.spyOn(service, 'start').mockResolvedValue();

      await service.restart(reason);

      expect(hookService.doAction).toHaveBeenCalledWith(
        'comment|beforeRestart',
        { reason },
        { action: 'restart' },
      );
      expect(hookService.doAction).toHaveBeenCalledWith(
        'comment|afterRestart',
        { reason },
        { action: 'restart' },
      );
    });
  });

  describe('getStatus', () => {
    it('should return status when service is not running', () => {
      const status = service.getStatus();

      expect(status).toEqual({
        running: false,
        pid: undefined,
      });
    });
  });

  describe('mapConfigToEnv', () => {
    it('should map waline config to environment variables', () => {
      // Access private method for testing
      const mapConfigToEnv = service.mapConfigToEnv.bind(service);

      const result = mapConfigToEnv(mockWalineSetting);

      expect(result).toEqual({
        SMTP_PORT: '587',
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SENDER_NAME: 'VanBlog',
        SENDER_EMAIL: 'noreply@example.com',
        AUTHOR_EMAIL: 'admin@example.com',
        WEBHOOK: 'https://example.com/webhook',
        VAN_BLOG_WALINE_URL: 'https://waline.example.com',
        key: 'value', // from otherConfig
      });
    });

    it('should handle force login comment', () => {
      const mapConfigToEnv = service.mapConfigToEnv.bind(service);
      const configWithForceLogin = {
        ...mockWalineSetting,
        forceLoginComment: true,
      };

      const result = mapConfigToEnv(configWithForceLogin);

      expect(result.LOGIN).toBe('force');
    });

    it('should filter out SMTP vars when SMTP is disabled', () => {
      const mapConfigToEnv = service.mapConfigToEnv.bind(service);
      const configWithoutSMTP = {
        ...mockWalineSetting,
        'smtp.enabled': false,
      };

      const result = mapConfigToEnv(configWithoutSMTP);

      expect(result.SMTP_PORT).toBeUndefined();
      expect(result.SMTP_HOST).toBeUndefined();
      expect(result.SMTP_USER).toBeUndefined();
      expect(result.SMTP_PASS).toBeUndefined();
      expect(result.SENDER_NAME).toBeUndefined();
      expect(result.SENDER_EMAIL).toBeUndefined();
      expect(result.AUTHOR_EMAIL).toBe('admin@example.com');
    });
  });
});
