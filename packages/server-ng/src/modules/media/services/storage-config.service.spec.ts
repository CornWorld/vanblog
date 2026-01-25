import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { StorageProvider, type UpdateStorageConfigDto } from '../dto/storage-config.dto';

import { StorageConfigService } from './storage-config.service';

import type { SettingRegistryService } from '../../setting/services/setting-registry.service';

describe('StorageConfigService (registry-backed)', () => {
  let service: StorageConfigService;
  let registry: Pick<SettingRegistryService, 'getConfig' | 'updateConfig'>;

  beforeEach(() => {
    registry = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
    } as any;
    service = new StorageConfigService(registry as SettingRegistryService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStorageConfig', () => {
    it('should return default LOCAL config via registration when registry returns default', async () => {
      vi.mocked(registry.getConfig).mockResolvedValue({
        provider: StorageProvider.LOCAL,
        enabled: true,
      } as any);

      const result = await service.getStorageConfig();

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });
      expect(registry.getConfig).toHaveBeenCalledOnce();
    });

    it('should return parsed config when registry has value', async () => {
      vi.mocked(registry.getConfig).mockResolvedValue({
        provider: StorageProvider.PICGO,
        enabled: true,
        baseUrl: '/media',
      } as any);

      const result = await service.getStorageConfig();

      expect(result).toEqual({ provider: StorageProvider.PICGO, enabled: true, baseUrl: '/media' });
    });

    it('should return null when registry parsing failed (returns null)', async () => {
      vi.mocked(registry.getConfig).mockResolvedValue(null);

      const result = await service.getStorageConfig();

      expect(result).toBeNull();
    });
  });

  describe('updateStorageConfig', () => {
    it('should write new LOCAL config and return newConfig', async () => {
      vi.mocked(registry.getConfig).mockResolvedValueOnce({
        provider: StorageProvider.LOCAL,
        enabled: true,
      } as any);

      const dto: UpdateStorageConfigDto = {
        provider: StorageProvider.LOCAL,
      } as any;

      const result = await service.updateStorageConfig(dto);

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });
      expect(registry.updateConfig).toHaveBeenCalledTimes(1);
      const [[key, saved]] = vi.mocked(registry.updateConfig).mock.calls as any;
      expect(key).toBe('storage_config');
      expect(saved).toEqual({
        provider: StorageProvider.LOCAL,
        enabled: true,
        localPath: undefined,
        baseUrl: undefined,
        picgoConfig: undefined,
      });
    });

    it('should update to PICGO and include picgoConfig when provided', async () => {
      vi.mocked(registry.getConfig).mockResolvedValueOnce({
        provider: StorageProvider.LOCAL,
        enabled: false,
      } as any);

      const dto: UpdateStorageConfigDto = {
        provider: StorageProvider.PICGO,
        picgoConfig: { uploader: 'smms', config: { token: 'xxx', folder: 'blog' } },
      } as any;

      const result = await service.updateStorageConfig(dto);

      expect(result).toEqual({
        provider: StorageProvider.PICGO,
        enabled: false,
        picgoConfig: { uploader: 'smms', config: { token: 'xxx', folder: 'blog' } },
      });

      expect(registry.updateConfig).toHaveBeenCalledTimes(1);
      const [[, saved]] = vi.mocked(registry.updateConfig).mock.calls as any;
      expect(saved).toEqual({
        provider: StorageProvider.PICGO,
        enabled: false,
        localPath: undefined,
        baseUrl: undefined,
        picgoConfig: { uploader: 'smms', config: { token: 'xxx', folder: 'blog' } },
      });
    });

    it('should ignore picgoConfig when provider is LOCAL', async () => {
      vi.mocked(registry.getConfig).mockResolvedValueOnce({
        provider: StorageProvider.PICGO,
        enabled: true,
      } as any);

      const dto: UpdateStorageConfigDto = {
        provider: StorageProvider.LOCAL,
        enabled: true,
        picgoConfig: { uploader: 'whatever', config: { a: 1 } },
      } as any;

      const result = await service.updateStorageConfig(dto);

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });
      const [[, saved]] = vi.mocked(registry.updateConfig).mock.calls as any;
      expect(saved).toEqual({
        provider: StorageProvider.LOCAL,
        enabled: true,
        localPath: undefined,
        baseUrl: undefined,
        picgoConfig: undefined,
      });
    });
  });

  describe('getFullStorageConfig', () => {
    it('should return default when registry returns default', async () => {
      vi.mocked(registry.getConfig).mockResolvedValueOnce({
        provider: StorageProvider.LOCAL,
        enabled: true,
      } as any);

      const result = await service.getFullStorageConfig();

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });
    });
  });
});
