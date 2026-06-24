import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';

import { CaddyController } from './caddy.controller';
import { SettingCoreService } from './services/setting-core.service';

describe('CaddyController', () => {
  let controller: CaddyController;
  let mockSettingCoreService: {
    getCaddyLog: ReturnType<typeof vi.fn>;
    clearCaddyLog: ReturnType<typeof vi.fn>;
    getCaddyConfig: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSettingCoreService = {
      getCaddyLog: vi.fn(),
      clearCaddyLog: vi.fn(),
      getCaddyConfig: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaddyController],
      providers: [
        {
          provide: SettingCoreService,
          useValue: mockSettingCoreService,
        },
      ],
    }).compile();

    controller = module.get<CaddyController>(CaddyController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCaddyLog', () => {
    it('should delegate to service and return the result', () => {
      const mockLog =
        '2024-01-01 12:00:00 INFO caddy started\n2024-01-01 12:01:00 INFO request handled';
      mockSettingCoreService.getCaddyLog.mockReturnValue(mockLog);

      const result = controller.getCaddyLog();

      expect(result).toBe(mockLog);
      expect(mockSettingCoreService.getCaddyLog).toHaveBeenCalledOnce();
    });

    it('should return empty string when service returns empty', () => {
      mockSettingCoreService.getCaddyLog.mockReturnValue('');

      const result = controller.getCaddyLog();

      expect(result).toBe('');
      expect(mockSettingCoreService.getCaddyLog).toHaveBeenCalledOnce();
    });
  });

  describe('clearCaddyLog', () => {
    it('should call service.clearCaddyLog() and return success message', () => {
      const result = controller.clearCaddyLog();

      expect(result).toBe('Caddy logs cleared successfully');
      expect(mockSettingCoreService.clearCaddyLog).toHaveBeenCalledOnce();
    });
  });

  describe('getCaddyConfig', () => {
    it('should delegate to service and return the result', async () => {
      const mockConfig = {
        apps: {
          http: {
            servers: {
              srv1: {
                listen: [':443'],
              },
            },
          },
        },
      };
      mockSettingCoreService.getCaddyConfig.mockResolvedValue(mockConfig);

      const result = await controller.getCaddyConfig();

      expect(result).toEqual(mockConfig);
      expect(mockSettingCoreService.getCaddyConfig).toHaveBeenCalledOnce();
    });

    it('should return null when service returns null', async () => {
      mockSettingCoreService.getCaddyConfig.mockResolvedValue(null);

      const result = await controller.getCaddyConfig();

      expect(result).toBeNull();
      expect(mockSettingCoreService.getCaddyConfig).toHaveBeenCalledOnce();
    });
  });
});
