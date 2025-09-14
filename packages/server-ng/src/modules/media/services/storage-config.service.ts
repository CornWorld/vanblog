import { Injectable } from '@nestjs/common';

import { SettingRegistryService } from '../../setting/services/setting-registry.service';
import {
  UpdateStorageConfigDto,
  StorageConfigResponseDto,
  StorageProvider,
  STORAGE_CONFIG_KEY,
} from '../dto/storage-config.dto';

@Injectable()
export class StorageConfigService {
  constructor(private readonly registry: SettingRegistryService) {}

  async getStorageConfig(): Promise<StorageConfigResponseDto> {
    const stored = await this.registry.getConfig<StorageConfigResponseDto>(STORAGE_CONFIG_KEY);
    // Provide safe default to guarantee non-null return
    return (
      stored ?? {
        provider: StorageProvider.LOCAL,
        enabled: true,
      }
    );
  }

  async updateStorageConfig(updateDto: UpdateStorageConfigDto): Promise<StorageConfigResponseDto> {
    const currentConfig = await this.getStorageConfig();

    const newConfig: StorageConfigResponseDto = {
      provider: updateDto.provider,
      enabled: typeof updateDto.enabled === 'boolean' ? updateDto.enabled : currentConfig.enabled,
      localPath: typeof updateDto.localPath === 'string' ? updateDto.localPath : undefined,
      baseUrl: typeof updateDto.baseUrl === 'string' ? updateDto.baseUrl : undefined,
    };

    // 根据存储提供商设置相应配置
    switch (updateDto.provider) {
      case StorageProvider.PICGO:
        if (updateDto.picgoConfig && typeof updateDto.picgoConfig === 'object') {
          newConfig.picgoConfig = updateDto.picgoConfig;
        }
        break;
      case StorageProvider.LOCAL:
        // 本地存储不需要额外配置
        break;
    }

    // 保存完整配置
    const fullConfig = {
      provider: newConfig.provider,
      enabled: newConfig.enabled,
      localPath: newConfig.localPath,
      baseUrl: newConfig.baseUrl,
      picgoConfig: newConfig.picgoConfig,
    } satisfies StorageConfigResponseDto;

    await this.registry.updateConfig(STORAGE_CONFIG_KEY, fullConfig);

    return newConfig;
  }

  async getFullStorageConfig(): Promise<StorageConfigResponseDto> {
    const stored = await this.registry.getConfig<StorageConfigResponseDto>(STORAGE_CONFIG_KEY);
    return (
      stored ?? {
        provider: StorageProvider.LOCAL,
        enabled: true,
      }
    );
  }
}
