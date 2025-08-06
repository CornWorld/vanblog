import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import { siteMeta } from '../../../database/schema';
import { safeParseJson, dataSchemas } from '../../../shared/zod';
import {
  UpdateStorageConfigDto,
  StorageConfigResponseDto,
  StorageProvider,
} from '../dto/storage-config.dto';

const STORAGE_CONFIG_KEY = 'storage_config';

@Injectable()
export class StorageConfigService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: LibSQLDatabase,
  ) {}

  async getStorageConfig(): Promise<StorageConfigResponseDto> {
    const result = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, STORAGE_CONFIG_KEY))
      .limit(1);

    if (result.length === 0) {
      return {
        provider: StorageProvider.LOCAL,
        enabled: true,
      };
    }

    const config = safeParseJson(
      result[0].value ?? '{}',
      dataSchemas.genericObject,
    ) as unknown as StorageConfigResponseDto;
    return config;
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
    };

    const existing = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, STORAGE_CONFIG_KEY))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(siteMeta)
        .set({
          value: JSON.stringify(fullConfig),
          updatedAt: new Date(),
        })
        .where(eq(siteMeta.key, STORAGE_CONFIG_KEY));
    } else {
      await this.db.insert(siteMeta).values({
        key: STORAGE_CONFIG_KEY,
        value: JSON.stringify(fullConfig),
      });
    }

    return newConfig;
  }

  async getFullStorageConfig(): Promise<StorageConfigResponseDto> {
    const result = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, STORAGE_CONFIG_KEY))
      .limit(1);

    if (result.length === 0) {
      return {
        provider: StorageProvider.LOCAL,
        enabled: true,
      };
    }

    return safeParseJson(
      result[0].value ?? '{}',
      dataSchemas.genericObject,
    ) as unknown as StorageConfigResponseDto;
  }
}
