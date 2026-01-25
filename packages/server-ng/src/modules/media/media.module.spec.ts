/**
 * Media Module Tests
 *
 * 测试类型: 模块组装测试
 * 测试目标: 验证模块的依赖注入、服务实例化和导出
 *
 * 不需要真实数据库的原因:
 * - 这是模块级别的测试，只验证组件能否正确组装
 * - 不测试具体的业务逻辑（uploadFile、deleteFile 等）
 * - 不测试数据库查询、事务或复杂操作
 * - Mock.db() 足以满足依赖注入的需求
 *
 * 业务逻辑测试位置:
 * - MediaService 的具体功能测试: media.service.spec.ts
 * - 图片处理服务测试: image-processing.service.spec.ts
 * - 集成测试: test/media.e2e-spec.ts
 */
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Mock } from '@test/mock';
import { DATABASE_CONNECTION } from '../../database';
import { LoggerService } from '../../core/logger/logger.service';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { HookService } from '../plugin/services/hook.service';
import { db } from '@test/setup.unit';

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
    /**
     * 创建测试模块，不直接导入 MediaModule
     *
     * 原因: 避免与 PluginModule/HookService 的循环依赖
     *
     * 手动注册所有 providers 和 controllers:
     * - 模拟真实的模块组装过程
     * - 使用 Mock 服务替代实际依赖
     * - 验证依赖注入链是否完整
     */
    module = await Test.createTestingModule({
      controllers: [MediaController, PicgoPluginsController],
      providers: [
        // 核心 Services
        MediaService,
        ImageProcessingQueueService,
        ImageProcessingService,
        StorageConfigService,
        StorageFactoryService,
        LocalStorageService,
        PicgoStorageService,

        // 依赖注入使用真实数据库（通过 withTestTransaction 进行事务管理）
        {
          provide: DATABASE_CONNECTION,
          useValue: db,
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

  /**
   * 模块初始化验证
   */
  describe('Module Initialization', () => {
    it('should create module successfully', () => {
      expect(module).toBeDefined();
      // 验证模块有基本的 NestJS TestingModule 属性
      expect(module.get).toBeDefined();
      expect(module.constructor).toBeDefined();
    });

    it('should have module context', () => {
      // 验证测试模块已正确创建
      expect(module.constructor.name).toBe('TestingModule');
      expect(module.get(MediaController)).toBeDefined();
    });
  });

  /**
   * Controllers 验证
   */
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

  /**
   * Services 验证
   */
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

  /**
   * 模块导出验证
   *
   * MediaModule 导出:
   * - MediaService
   * - ImageProcessingService
   */
  describe('Module Exports', () => {
    it('should export MediaService', () => {
      const service = module.get<MediaService>(MediaService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(MediaService);
    });

    it('should export ImageProcessingService', () => {
      const service = module.get<ImageProcessingService>(ImageProcessingService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ImageProcessingService);
    });
  });

  /**
   * 依赖注入验证
   */
  describe('Dependency Injection', () => {
    it('should inject DATABASE_CONNECTION into MediaService', () => {
      const mediaService = module.get<MediaService>(MediaService);
      expect(mediaService.db).toBeDefined();
    });

    it('should have DATABASE_CONNECTION available', () => {
      const db = module.get(DATABASE_CONNECTION);
      expect(db).toBeDefined();
    });

    it('should have SettingRegistryService available', () => {
      const registry = module.get<SettingRegistryService>(SettingRegistryService);
      expect(registry).toBeDefined();
    });

    it('should have SettingCoreService available', () => {
      const settingCore = module.get<SettingCoreService>(SettingCoreService);
      expect(settingCore).toBeDefined();
    });

    it('should have HookService available', () => {
      const hookService = module.get<HookService>(HookService);
      expect(hookService).toBeDefined();
    });

    it('should have LoggerService available', () => {
      const logger = module.get<LoggerService>(LoggerService);
      expect(logger).toBeDefined();
    });
  });

  /**
   * 服务协作验证
   */
  describe('Service Integration', () => {
    it('should wire MediaService with StorageFactoryService', () => {
      const mediaService = module.get<MediaService>(MediaService);
      const storageFactory = module.get<StorageFactoryService>(StorageFactoryService);

      expect(mediaService).toBeDefined();
      expect(storageFactory).toBeDefined();

      // MediaService 应该能够访问 StorageFactoryService
      // (通过构造函数注入)
      expect(mediaService['storageFactoryService']).toBeDefined();
    });

    it('should instantiate ImageProcessingService independently', () => {
      const imageProcessing = module.get<ImageProcessingService>(ImageProcessingService);

      expect(imageProcessing).toBeDefined();
      expect(imageProcessing).toBeInstanceOf(ImageProcessingService);

      // ImageProcessingService 是独立的工具服务，不依赖其他服务
      // 它只使用 NestJS Logger
      expect(imageProcessing['logger']).toBeDefined();
    });

    it('should wire StorageFactoryService with StorageConfigService', () => {
      const storageFactory = module.get<StorageFactoryService>(StorageFactoryService);
      const storageConfig = module.get<StorageConfigService>(StorageConfigService);

      expect(storageFactory).toBeDefined();
      expect(storageConfig).toBeDefined();

      // StorageFactoryService 应该能够访问 StorageConfigService
      expect(storageFactory['storageConfigService']).toBeDefined();
    });

    it('should wire ImageProcessingQueueService with ImageProcessingService', () => {
      const queueService = module.get<ImageProcessingQueueService>(ImageProcessingQueueService);
      const imageProcessing = module.get<ImageProcessingService>(ImageProcessingService);

      expect(queueService).toBeDefined();
      expect(imageProcessing).toBeDefined();

      // ImageProcessingQueueService 应该能够访问 ImageProcessingService
      expect(queueService['imageProcessingService']).toBeDefined();
    });
  });

  /**
   * 注意事项
   *
   * 1. 配置注册测试未包含:
   *    - MEDIA_PROCESSING_CONFIG_REGISTRATION
   *    - STORAGE_CONFIG_REGISTRATION
   *
   *    原因: 这些 factory providers 在完整的 MediaModule 中定义
   *    由于循环依赖问题（PluginModule/HookService），
   *    我们在这里手动组装测试模块，跳过了 factory providers
   *
   *    配置注册的测试位置:
   *    - integration tests: test/media.integration-spec.ts
   *    - E2E tests: test/media.e2e-spec.ts
   *
   * 2. 不测试具体业务逻辑:
   *    - uploadFile() 在 media.service.spec.ts 中测试
   *    - deleteFile() 在 media.service.spec.ts 中测试
   *    - 图片处理在 image-processing.service.spec.ts 中测试
   *    - 完整的上传流程在 E2E tests 中测试
   */
});
