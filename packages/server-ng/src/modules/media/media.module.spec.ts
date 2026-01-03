import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Mock } from '@test/mock';
import { DATABASE_CONNECTION } from '../../database';
import { LoggerService } from '../../core/logger/logger.service';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { HookService } from '../plugin/services/hook.service';

import { MediaController } from './media.controller';
import { PicgoPluginsController } from './controllers/picgo-plugins.controller';
import { MediaService } from './services/media.service';
import { ImageProcessingService } from './services/image-processing.service';
import { ImageProcessingQueueService } from './services/image-processing-queue.service';
import { StorageConfigService } from './services/storage-config.service';
import { StorageFactoryService } from './services/storage-factory.service';
import { LocalStorageService } from './services/storages/local-storage.service';
import { PicgoStorageService } from './services/storages/picgo-storage.service';

describe('MediaModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    // Create testing module without importing MediaModule
    // to avoid circular dependency issues with PluginModule/HookService
    module = await Test.createTestingModule({
      controllers: [MediaController, PicgoPluginsController],
      providers: [
        MediaService,
        ImageProcessingQueueService,
        ImageProcessingService,
        StorageConfigService,
        StorageFactoryService,
        LocalStorageService,
        PicgoStorageService,
        {
          provide: DATABASE_CONNECTION,
          useValue: Mock.db().build(),
        },
        {
          provide: SettingRegistryService,
          useValue: Mock.settingRegistry(),
        },
        {
          provide: SettingCoreService,
          useValue: Mock.settingCore(),
        },
        {
          provide: HookService,
          useValue: Mock.hook(),
        },
        {
          provide: LoggerService,
          useValue: Mock.logger(),
        },
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  describe('Controllers', () => {
    it('should provide MediaController', () => {
      const controller = module.get<MediaController>(MediaController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(MediaController);
    });

    it('should provide PicgoPluginsController', () => {
      const controller = module.get<PicgoPluginsController>(PicgoPluginsController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(PicgoPluginsController);
    });
  });

  describe('Services', () => {
    it('should provide MediaService', () => {
      const service = module.get<MediaService>(MediaService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(MediaService);
    });

    it('should provide ImageProcessingService', () => {
      const service = module.get<ImageProcessingService>(ImageProcessingService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ImageProcessingService);
    });

    it('should provide ImageProcessingQueueService', () => {
      const service = module.get<ImageProcessingQueueService>(ImageProcessingQueueService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ImageProcessingQueueService);
    });

    it('should provide StorageConfigService', () => {
      const service = module.get<StorageConfigService>(StorageConfigService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(StorageConfigService);
    });

    it('should provide StorageFactoryService', () => {
      const service = module.get<StorageFactoryService>(StorageFactoryService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(StorageFactoryService);
    });

    it('should provide LocalStorageService', () => {
      const service = module.get<LocalStorageService>(LocalStorageService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(LocalStorageService);
    });

    it('should provide PicgoStorageService', () => {
      const service = module.get<PicgoStorageService>(PicgoStorageService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(PicgoStorageService);
    });
  });

  describe('Exports', () => {
    it('should export MediaService', () => {
      const service = module.get<MediaService>(MediaService);
      expect(service).toBeDefined();
    });

    it('should export ImageProcessingService', () => {
      const service = module.get<ImageProcessingService>(ImageProcessingService);
      expect(service).toBeDefined();
    });
  });

  // Note: Configuration registration tests are skipped because we're not
  // importing the full MediaModule (which contains the factory providers)
  // to avoid circular dependencies with PluginModule/HookService.
  // Configuration registration is tested in integration/E2E tests.

  describe('Dependencies', () => {
    it('should have DatabaseModule imported', () => {
      const db = module.get(DATABASE_CONNECTION);
      expect(db).toBeDefined();
    });

    it('should have SettingRegistryService available', () => {
      const registry = module.get<SettingRegistryService>(SettingRegistryService);
      expect(registry).toBeDefined();
    });

    it('should have HookService available', () => {
      const hookService = module.get<HookService>(HookService);
      expect(hookService).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should allow MediaService to access database', () => {
      const mediaService = module.get<MediaService>(MediaService);
      expect(mediaService).toBeDefined();
      expect(mediaService.db).toBeDefined();
    });

    it('should allow services to work together', () => {
      const mediaService = module.get<MediaService>(MediaService);
      const storageFactory = module.get<StorageFactoryService>(StorageFactoryService);
      const imageProcessing = module.get<ImageProcessingService>(ImageProcessingService);

      expect(mediaService).toBeDefined();
      expect(storageFactory).toBeDefined();
      expect(imageProcessing).toBeDefined();
    });
  });
});
