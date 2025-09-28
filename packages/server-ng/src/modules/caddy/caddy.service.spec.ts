import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SettingRegistryService } from '../setting/services/setting-registry.service';

import { CaddyService } from './caddy.service';

describe('CaddyService', () => {
  let service: CaddyService;
  let settingRegistryService: SettingRegistryService;

  beforeEach(async () => {
    const mockSettingRegistryService = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaddyService,
        {
          provide: SettingRegistryService,
          useValue: mockSettingRegistryService,
        },
      ],
    }).compile();

    service = module.get<CaddyService>(CaddyService);
    settingRegistryService = module.get<SettingRegistryService>(SettingRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHttpsSettings', () => {
    it('should return HTTPS settings', async () => {
      const mockSettings = {
        redirect: true,
        domains: ['example.com', 'www.example.com'],
      };

      vi.mocked(settingRegistryService.getConfig).mockResolvedValue(mockSettings);

      const result = await service.getHttpsSettings();

      expect(settingRegistryService.getConfig).toHaveBeenCalledWith('caddy.https');
      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateHttpsSettings', () => {
    it('should update HTTPS settings', async () => {
      const mockSettings = {
        redirect: true,
        domains: ['example.com', 'www.example.com'],
      };

      vi.mocked(settingRegistryService.updateConfig).mockResolvedValue(mockSettings);

      const result = await service.updateHttpsSettings(mockSettings);

      expect(settingRegistryService.updateConfig).toHaveBeenCalledWith('caddy.https', mockSettings);
      expect(result).toEqual(mockSettings);
    });
  });
});
