import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { Mock } from '../../../test/mock';

import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { CommentService } from './comment.service';
import type { UpdateWalineSetting } from './comment.schema';

describe('CommentService', () => {
  let service: CommentService;
  let settingService: SettingCoreService;
  let hookService: HookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: SettingCoreService,
          useValue: Mock.settingCore(),
        },
        {
          provide: ConfigService,
          useValue: Mock.config({
            'waline.db': 'waline',
            'jwt.secret': 'test-secret',
          }),
        },
        {
          provide: HookService,
          useValue: Mock.hook(),
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    settingService = module.get(SettingCoreService);
    hookService = module.get(HookService);

    // Clear any walineProcess state between tests
    try {
      await service.stop();
    } catch (_e) {
      // Ignore stop errors during setup
    }
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // Ensure cleanup after each test
    try {
      await service.stop();
    } catch (_e) {
      // Ignore stop errors during cleanup
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWalineSetting', () => {
    it('should return waline setting', async () => {
      const mockWalineSetting = Mock.walineSetting();
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
      expect(result['smtp.port']).toBe(587);
      expect(result['smtp.host']).toBe('');
      expect(result['sender.email']).toBe('noreply@example.com');
      expect(result.authorEmail).toBe('admin@example.com');
    });

    it('should return default setting when getConfig returns null', async () => {
      vi.mocked(settingService.getConfig).mockResolvedValue(null);

      const result = await service.getWalineSetting();

      // Check essential fields instead of exact match since service may have different defaults
      expect(result).toBeDefined();
      expect(result['smtp.enabled']).toBe(false);
      expect(result['smtp.port']).toBe(587);
      expect(result['smtp.host']).toBe('');
      expect(result['smtp.user']).toBe('');
      expect(result['smtp.password']).toBe('');
      expect(result['sender.name']).toBe('');
      expect(result['sender.email']).toBe('noreply@example.com');
      expect(result.authorEmail).toBe('admin@example.com');
      expect(result.webhook).toBe('');
      expect(result.forceLoginComment).toBe(false);
      expect(result.serverURL).toBe('');
    });
  });

  describe('updateWalineSetting', () => {
    it('should update waline setting and restart service', async () => {
      const mockWalineSetting = Mock.walineSetting();
      const updateData: UpdateWalineSetting = { 'smtp.enabled': false };
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

    it('should trigger comment|beforeUpdate and comment|afterUpdate hooks', async () => {
      const mockWalineSetting = Mock.walineSetting();
      const updateData: UpdateWalineSetting = { 'smtp.enabled': false };
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

    it('should allow filter hook to modify update data', async () => {
      const mockWalineSetting = Mock.walineSetting();
      const updateData: UpdateWalineSetting = { 'smtp.port': 465 };
      const modifiedData: UpdateWalineSetting = { 'smtp.port': 587, 'smtp.enabled': true };
      const updatedSetting = { ...mockWalineSetting, ...modifiedData };

      vi.mocked(settingService.getConfig).mockResolvedValue(mockWalineSetting);
      vi.mocked(hookService.applyFilters).mockResolvedValue(modifiedData);
      vi.mocked(settingService.updateConfig).mockResolvedValue(updatedSetting);
      vi.spyOn(service, 'restart').mockResolvedValue();

      const result = await service.updateWalineSetting(updateData);

      expect(hookService.applyFilters).toHaveBeenCalledWith(
        'comment|beforeUpdate',
        updateData,
        expect.any(Object),
      );
      expect(result).toEqual(updatedSetting);
    });
  });

  describe('getResolvedWalineConfig', () => {
    it('should return configured serverURL when set', async () => {
      const mockWalineSetting = Mock.walineSetting();
      vi.mocked(settingService.getConfig).mockResolvedValue(mockWalineSetting);

      const result = await service.getResolvedWalineConfig();

      expect(result).toEqual({ serverURL: 'https://waline.example.com' });
    });

    it('should return default serverURL when not configured', async () => {
      const settingWithoutUrl = Mock.walineSetting({ serverURL: '' });
      vi.mocked(settingService.getConfig).mockResolvedValue(settingWithoutUrl);

      const result = await service.getResolvedWalineConfig();

      expect(result.serverURL).toMatch(/^http:\/\/127\.0\.0\.1:8360$/);
    });

    it('should fallback to default when getWalineSetting throws', async () => {
      vi.mocked(settingService.getConfig).mockRejectedValue(new Error('Database error'));

      const result = await service.getResolvedWalineConfig();

      expect(result.serverURL).toBeDefined();
      expect(result.serverURL).toMatch(/^http:\/\/127\.0\.0\.1:8360$/);
    });

    it('should use walineEnv SERVER_URL when available', async () => {
      const settingWithoutUrl = Mock.walineSetting({ serverURL: '' });
      vi.mocked(settingService.getConfig).mockResolvedValue(settingWithoutUrl);

      // Set internal walineEnv
      (service as any).walineEnv = { SERVER_URL: 'http://custom:9999' };

      const result = await service.getResolvedWalineConfig();

      expect(result.serverURL).toBe('http://custom:9999');
    });

    it('should construct URL from HOST and PORT when SERVER_URL not set', async () => {
      const settingWithoutUrl = Mock.walineSetting({ serverURL: '' });
      vi.mocked(settingService.getConfig).mockResolvedValue(settingWithoutUrl);

      // Set internal walineEnv
      (service as any).walineEnv = { HOST: '0.0.0.0', PORT: '3000' };

      const result = await service.getResolvedWalineConfig();

      expect(result.serverURL).toBe('http://0.0.0.0:3000');
    });
  });

  describe('mapConfigToEnv', () => {
    it('should map waline config to environment variables', () => {
      const mockWalineSetting = Mock.walineSetting();
      const result = service.mapConfigToEnv(mockWalineSetting as any);

      expect(result).toEqual({
        SMTP_PORT: '587',
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        SENDER_NAME: 'VanBlog',
        SENDER_EMAIL: 'noreply@example.com',
        AUTHOR_EMAIL: 'admin@example.com',
        WEBHOOK: 'https://example.com/webhook',
        SERVER_URL: 'https://waline.example.com',
        key: 'value', // from otherConfig
      });
    });

    it('should handle force login comment', () => {
      const configWithForceLogin = Mock.walineSetting({
        forceLoginComment: true,
      });

      const result = service.mapConfigToEnv(configWithForceLogin as any);

      expect(result.LOGIN).toBe('force');
    });

    it('should not set LOGIN when forceLoginComment is false', () => {
      const config = Mock.walineSetting({ forceLoginComment: false });

      const result = service.mapConfigToEnv(config as any);

      expect(result.LOGIN).toBeUndefined();
    });

    it('should filter out SMTP vars when SMTP is disabled', () => {
      const configWithoutSMTP = Mock.walineSetting({
        'smtp.enabled': false,
      });

      const result = service.mapConfigToEnv(configWithoutSMTP as any);

      expect(result.SMTP_PORT).toBeUndefined();
      expect(result.SMTP_HOST).toBeUndefined();
      expect(result.SMTP_USER).toBeUndefined();
      expect(result.SMTP_PASS).toBeUndefined();
      expect(result.SENDER_NAME).toBeUndefined();
      expect(result.SENDER_EMAIL).toBeUndefined();
      expect(result.AUTHOR_EMAIL).toBe('admin@example.com');
    });

    it('should parse otherConfig JSON and merge into env', () => {
      const configWithOther = Mock.walineSetting({
        otherConfig: '{"CUSTOM_KEY":"custom_value","ANOTHER":"value"}',
      });

      const result = service.mapConfigToEnv(configWithOther as any);

      expect(result.CUSTOM_KEY).toBe('custom_value');
      expect(result.ANOTHER).toBe('value');
    });

    it('should handle invalid otherConfig JSON gracefully', () => {
      const configWithInvalidOther = Mock.walineSetting({
        otherConfig: 'invalid json',
      });

      const result = service.mapConfigToEnv(configWithInvalidOther as any);

      // Should not throw and should still have other env vars
      expect(result).toBeDefined();
      expect(result.AUTHOR_EMAIL).toBe('admin@example.com');
    });

    it('should handle empty otherConfig', () => {
      const configWithEmptyOther = Mock.walineSetting({
        otherConfig: '',
      });

      const result = service.mapConfigToEnv(configWithEmptyOther as any);

      expect(result).toBeDefined();
      expect(result.AUTHOR_EMAIL).toBe('admin@example.com');
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

    it('should return running status with PID when process exists', () => {
      // Simulate running process
      (service as any).walineProcess = { pid: 12345 };

      const status = service.getStatus();

      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);

      // Cleanup
      (service as any).walineProcess = null;
    });
  });

  describe('lifecycle hooks', () => {
    it('should call stop on module destroy', async () => {
      const stopSpy = vi.spyOn(service, 'stop').mockResolvedValue();

      await service.onModuleDestroy();

      expect(stopSpy).toHaveBeenCalled();

      stopSpy.mockRestore();
    });

    it('should call stop before application shutdown', async () => {
      const stopSpy = vi.spyOn(service, 'stop').mockResolvedValue();

      await service.beforeApplicationShutdown();

      expect(stopSpy).toHaveBeenCalled();

      stopSpy.mockRestore();
    });

    it('should not start in test environment on module init', async () => {
      const startSpy = vi.spyOn(service, 'start');

      // Ensure we're in test environment
      process.env.VITEST = 'true';

      await service.onModuleInit();

      expect(startSpy).not.toHaveBeenCalled();

      startSpy.mockRestore();
    });

    it('should log error on module init failure in non-test environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalVitest = process.env.VITEST;

      process.env.NODE_ENV = 'development';
      delete process.env.VITEST;

      const startSpy = vi.spyOn(service, 'start');
      startSpy.mockRejectedValue(new Error('Start failed'));

      // Should not throw, just log error
      await service.onModuleInit();

      expect(startSpy).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
      process.env.VITEST = originalVitest;
      startSpy.mockRestore();
    });
  });

  describe('restart', () => {
    it('should restart Waline with reason and trigger hooks', async () => {
      // Simulate existing process so that stop gets called
      (service as any).walineProcess = { pid: 12345 };

      const stopSpy = vi.spyOn(service, 'stop').mockImplementation(async () => {
        (service as any).walineProcess = null;
        return Promise.resolve();
      });
      const startSpy = vi.spyOn(service, 'start').mockImplementation(async () => Promise.resolve());

      await service.restart('测试重启');

      expect(hookService.doAction).toHaveBeenCalledWith(
        'comment|beforeRestart',
        { reason: '测试重启' },
        { action: 'restart' },
      );

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();

      expect(hookService.doAction).toHaveBeenCalledWith(
        'comment|afterRestart',
        { reason: '测试重启' },
        { action: 'restart' },
      );

      stopSpy.mockRestore();
      startSpy.mockRestore();
    });

    it('should stop existing process before starting', async () => {
      // Simulate existing process
      (service as any).walineProcess = { pid: 12345 };

      const stopSpy = vi.spyOn(service, 'stop').mockImplementation(async () => {
        (service as any).walineProcess = null;
        return Promise.resolve();
      });
      const startSpy = vi.spyOn(service, 'start').mockImplementation(async () => Promise.resolve());

      await service.restart('配置更新');

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();

      stopSpy.mockRestore();
      startSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should do nothing when no process is running', async () => {
      await service.stop();

      // Should not throw and should complete
      expect(hookService.doAction).not.toHaveBeenCalled();
    });
  });
});
