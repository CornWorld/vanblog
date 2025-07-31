import { Injectable } from '@nestjs/common';
import { StorageService } from '../interfaces/storage.interface';
import { StorageConfigService } from './storage-config.service';
import { LocalStorageService } from './storages/local-storage.service';
import { PicgoStorageService } from './storages/picgo-storage.service';
import { StorageProvider } from '../dto/storage-config.dto';

@Injectable()
export class StorageFactoryService {
  private readonly storageServices: Map<StorageProvider, StorageService> = new Map();

  constructor(
    private readonly storageConfigService: StorageConfigService,
    private readonly localStorageService: LocalStorageService,
    private readonly picgoStorageService: PicgoStorageService,
  ) {
    this.storageServices.set(StorageProvider.LOCAL, this.localStorageService);
    this.storageServices.set(StorageProvider.PICGO, this.picgoStorageService);
  }

  async getStorageService(): Promise<StorageService> {
    const config = await this.storageConfigService.getFullStorageConfig();

    if (!config.enabled) {
      return this.localStorageService;
    }

    const service = this.storageServices.get(config.provider);
    if (!service) {
      return this.localStorageService;
    }

    // 配置 PicGo 服务
    if (config.provider === StorageProvider.PICGO && config.picgoConfig) {
      if (config.picgoConfig.config) {
        (service as PicgoStorageService).configure(config.picgoConfig.config);
      }

      if (config.picgoConfig.plugins) {
        const plugins = config.picgoConfig.plugins.split(',').map((plugin) => plugin.trim());
        await (service as PicgoStorageService).installPlugins(plugins);
      }
    }

    return service;
  }

  async getCurrentProvider(): Promise<StorageProvider> {
    const config = await this.storageConfigService.getStorageConfig();
    return config.provider;
  }
}
