import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

import { Mock } from '@test/mock';
import { StorageProvider } from '../dto/storage-config.dto';

import { StorageConfigService } from './storage-config.service';
import { StorageFactoryService } from './storage-factory.service';
import { LocalStorageService } from './storages/local-storage.service';
import { PicgoStorageService } from './storages/picgo-storage.service';

describe('StorageFactoryService', () => {
  let service: StorageFactoryService;
  let storageConfigService: StorageConfigService;
  let localStorageService: LocalStorageService;
  let picgoStorageService: PicgoStorageService;

  beforeEach(async () => {
    const mockStorageConfigService = {
      getFullStorageConfig: vi.fn(),
      getStorageConfig: vi.fn(),
    };

    const mockLocalStorageService = Mock.storage();
    const mockPicgoStorageService = {
      ...Mock.storage(),
      configure: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageFactoryService,
        {
          provide: StorageConfigService,
          useValue: mockStorageConfigService,
        },
        {
          provide: LocalStorageService,
          useValue: mockLocalStorageService,
        },
        {
          provide: PicgoStorageService,
          useValue: mockPicgoStorageService,
        },
      ],
    }).compile();

    service = module.get<StorageFactoryService>(StorageFactoryService);
    storageConfigService = module.get<StorageConfigService>(StorageConfigService);
    localStorageService = module.get<LocalStorageService>(LocalStorageService);
    picgoStorageService = module.get<PicgoStorageService>(PicgoStorageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStorageService', () => {
    it('should return local storage when storage is disabled', async () => {
      vi.mocked(storageConfigService.getFullStorageConfig).mockResolvedValue({
        provider: StorageProvider.PICGO,
        enabled: false,
      });

      const result = await service.getStorageService();

      expect(result).toBe(localStorageService);
      expect(storageConfigService.getFullStorageConfig).toHaveBeenCalledOnce();
    });

    it('should return local storage when provider is not found', async () => {
      vi.mocked(storageConfigService.getFullStorageConfig).mockResolvedValue({
        provider: 'unknown' as StorageProvider,
        enabled: true,
      });

      const result = await service.getStorageService();

      expect(result).toBe(localStorageService);
    });

    it('should return local storage when provider is LOCAL', async () => {
      vi.mocked(storageConfigService.getFullStorageConfig).mockResolvedValue({
        provider: StorageProvider.LOCAL,
        enabled: true,
      });

      const result = await service.getStorageService();

      expect(result).toBe(localStorageService);
    });

    it('should return picgo storage when provider is PICGO', async () => {
      vi.mocked(storageConfigService.getFullStorageConfig).mockResolvedValue({
        provider: StorageProvider.PICGO,
        enabled: true,
      });

      const result = await service.getStorageService();

      expect(result).toBe(picgoStorageService);
    });

    it('should configure picgo service when provider is PICGO with config', async () => {
      const picgoConfig = {
        uploader: 'test-uploader',
        config: { key: 'value' },
      };

      vi.mocked(storageConfigService.getFullStorageConfig).mockResolvedValue({
        provider: StorageProvider.PICGO,
        enabled: true,
        picgoConfig,
      });

      const result = await service.getStorageService();

      expect(result).toBe(picgoStorageService);
      expect((picgoStorageService as any).configure).toHaveBeenCalledWith(picgoConfig.config);
    });

    it('should not configure picgo service when picgoConfig is missing', async () => {
      vi.mocked(storageConfigService.getFullStorageConfig).mockResolvedValue({
        provider: StorageProvider.PICGO,
        enabled: true,
      });

      const result = await service.getStorageService();

      expect(result).toBe(picgoStorageService);
      expect((picgoStorageService as any).configure).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentProvider', () => {
    it('should return current provider from config', async () => {
      vi.mocked(storageConfigService.getStorageConfig).mockResolvedValue({
        provider: StorageProvider.PICGO,
        enabled: true,
      });

      const result = await service.getCurrentProvider();

      expect(result).toBe(StorageProvider.PICGO);
      expect(storageConfigService.getStorageConfig).toHaveBeenCalledOnce();
    });

    it('should return LOCAL provider when config returns LOCAL', async () => {
      vi.mocked(storageConfigService.getStorageConfig).mockResolvedValue({
        provider: StorageProvider.LOCAL,
        enabled: true,
      });

      const result = await service.getCurrentProvider();

      expect(result).toBe(StorageProvider.LOCAL);
    });
  });
});
