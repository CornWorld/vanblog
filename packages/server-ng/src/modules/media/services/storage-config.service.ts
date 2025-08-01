import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { siteMeta } from '../../../database/schema';
import {
  UpdateStorageConfigDto,
  StorageConfigResponseDto,
  StorageProvider,
} from '../dto/storage-config.dto';
import { safeParseJson, dataSchemas } from '../../../shared/zod';

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
      enabled: updateDto.enabled ?? currentConfig.enabled,
    };

    // 清除之前的配置
    delete (newConfig as unknown as Record<string, unknown>).picgoConfig;

    switch (updateDto.provider) {
      case StorageProvider.PICGO:
        if (updateDto.picgoConfig) {
          (newConfig as unknown as Record<string, unknown>).picgoConfig = updateDto.picgoConfig;
        }
        break;
      case StorageProvider.LOCAL:
        // 本地存储不需要额外配置
        break;
    }

    // 保存完整配置
    const fullConfig: Record<string, unknown> = {
      provider: newConfig.provider,
      enabled: newConfig.enabled,
      picgoConfig: updateDto.picgoConfig,
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
