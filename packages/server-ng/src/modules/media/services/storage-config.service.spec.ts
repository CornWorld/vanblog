import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

import { DatabaseMockBuilder } from '../../../../test/mock-utils';
import { StorageProvider, type UpdateStorageConfigDto } from '../dto/storage-config.dto';

import { StorageConfigService } from './storage-config.service';

// Note: We instantiate the service directly with a mocked DB connection
// instead of spinning up Nest testing module, to keep tests fast and focused.

describe('StorageConfigService', () => {
  let service: StorageConfigService;
  let mockDb: DatabaseMockBuilder;

  beforeEach(() => {
    mockDb = new DatabaseMockBuilder();
    service = new StorageConfigService(mockDb.db as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStorageConfig', () => {
    it('should return default LOCAL config when no record exists', async () => {
      // select().from().where().limit(1) -> []
      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getStorageConfig();

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });
      expect(mockDb.db.select).toHaveBeenCalledOnce();
    });

    it('should parse and return config when record exists with valid JSON', async () => {
      const stored = {
        value: JSON.stringify({
          provider: StorageProvider.PICGO,
          enabled: true,
          baseUrl: '/media',
        }),
      };

      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([stored]),
          }),
        }),
      });

      const result = await service.getStorageConfig();

      expect(result).toEqual({ provider: StorageProvider.PICGO, enabled: true, baseUrl: '/media' });
    });

    it('should return null when record exists but JSON is invalid', async () => {
      const stored = { value: 'this-is-not-json' };

      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([stored]),
          }),
        }),
      });

      const result = await service.getStorageConfig();

      expect(result).toBeNull();
    });
  });

  describe('updateStorageConfig', () => {
    it('should insert new record when none exists and return newConfig (LOCAL)', async () => {
      // Mock current config read inside updateStorageConfig
      vi.spyOn(service, 'getStorageConfig').mockResolvedValue({
        provider: StorageProvider.LOCAL,
        enabled: true,
      } as any);

      // existing check: select().from().where().limit(1) -> []
      mockDb.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const dto: UpdateStorageConfigDto = {
        provider: StorageProvider.LOCAL,
        // intentionally do not pass enabled to verify it falls back to current enabled
      } as any;

      const result = await service.updateStorageConfig(dto);

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });

      // verify insert path
      expect(mockDb.db.insert).toHaveBeenCalledTimes(1);
      expect(mockDb.db.values).toHaveBeenCalledTimes(1);

      const [[valuesArg]] = mockDb.db.values.mock.calls;
      expect(valuesArg).toMatchObject({ key: 'storage_config', value: expect.any(String) });
      const saved = JSON.parse(valuesArg.value);
      expect(saved).toEqual({
        provider: StorageProvider.LOCAL,
        enabled: true,
        localPath: undefined,
        baseUrl: undefined,
        picgoConfig: undefined,
      });
    });

    it('should update existing record when found and return newConfig (PICGO with config)', async () => {
      // Mock current config read
      vi.spyOn(service, 'getStorageConfig').mockResolvedValue({
        provider: StorageProvider.LOCAL,
        enabled: false, // ensure fallback works when dto.enabled is undefined
      } as any);

      // existing check -> found
      const existing = [
        { value: JSON.stringify({ provider: StorageProvider.LOCAL, enabled: true }) },
      ];
      mockDb.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(existing),
          }),
        }),
      });

      const dto: UpdateStorageConfigDto = {
        provider: StorageProvider.PICGO,
        // enabled not provided => should fallback to current (false)
        picgoConfig: { uploader: 'smms', config: { token: 'xxx', folder: 'blog' } },
      } as any;

      const result = await service.updateStorageConfig(dto);

      expect(result).toEqual({
        provider: StorageProvider.PICGO,
        enabled: false,
        picgoConfig: { uploader: 'smms', config: { token: 'xxx', folder: 'blog' } },
      });

      // verify update path
      expect(mockDb.db.update).toHaveBeenCalledTimes(1);
      expect(mockDb.db.set).toHaveBeenCalledTimes(1);
      const [[setArg]] = mockDb.db.set.mock.calls;
      expect(setArg).toMatchObject({ value: expect.any(String), updatedAt: expect.any(String) });
      // updatedAt is ISO string
      expect(typeof setArg.updatedAt).toBe('string');
      expect(() => new Date(setArg.updatedAt).toISOString()).not.toThrow();
      const saved = JSON.parse(setArg.value);
      expect(saved).toEqual({
        provider: StorageProvider.PICGO,
        enabled: false,
        localPath: undefined,
        baseUrl: undefined,
        picgoConfig: { uploader: 'smms', config: { token: 'xxx', folder: 'blog' } },
      });
    });

    it('should not include picgoConfig when provider is LOCAL even if provided in dto', async () => {
      vi.spyOn(service, 'getStorageConfig').mockResolvedValue({
        provider: StorageProvider.PICGO,
        enabled: true,
      } as any);

      // existing check -> found
      mockDb.db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: '{}' }]),
          }),
        }),
      });

      const dto: UpdateStorageConfigDto = {
        provider: StorageProvider.LOCAL,
        enabled: true,
        // even if provided, should be ignored when provider is LOCAL
        picgoConfig: { uploader: 'whatever', config: { a: 1 } },
      } as any;

      const result = await service.updateStorageConfig(dto);

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });

      const [[setArg]] = mockDb.db.set.mock.calls;
      const saved = JSON.parse(setArg.value);
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
    it('should return default when no record exists', async () => {
      mockDb.db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getFullStorageConfig();

      expect(result).toEqual({ provider: StorageProvider.LOCAL, enabled: true });
    });
  });
});
