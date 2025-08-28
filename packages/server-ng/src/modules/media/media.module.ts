import { Module } from '@nestjs/common';

import { LoggerModule } from '../../core/logger/logger.module';
import { DatabaseModule } from '../../database/database.module';
import { PermissionModule } from '../permission/permission.module';
import { SettingRegistryService } from '../setting/services/setting-registry.service';
import { SettingModule } from '../setting/setting.module';

import { PicgoPluginsController } from './controllers/picgo-plugins.controller';
import {
  MEDIA_PROCESSING_CONFIG_KEY,
  MediaProcessingSettingsSchema,
} from './dto/media-settings.dto';
import { MediaController } from './media.controller';
import { ImageProcessingService } from './services/image-processing.service';
import { MediaService } from './services/media.service';
import { StorageConfigService } from './services/storage-config.service';
import { StorageFactoryService } from './services/storage-factory.service';
import { LocalStorageService } from './services/storages/local-storage.service';
import { PicgoStorageService } from './services/storages/picgo-storage.service';

@Module({
  imports: [
    LoggerModule,
    DatabaseModule,
    SettingModule,
    PermissionModule.forFeature(['media:create', 'media:read', 'media:delete']),
  ],
  controllers: [MediaController, PicgoPluginsController],
  providers: [
    MediaService,
    ImageProcessingService,
    StorageConfigService,
    StorageFactoryService,
    LocalStorageService,
    PicgoStorageService,
    {
      provide: 'MEDIA_PROCESSING_CONFIG_REGISTRATION',
      inject: [SettingRegistryService],
      useFactory: (registry: SettingRegistryService) => {
        registry.registerConfig({
          key: MEDIA_PROCESSING_CONFIG_KEY,
          defaultValue: MediaProcessingSettingsSchema.parse({}),
          validator: (value: unknown) => MediaProcessingSettingsSchema.safeParse(value).success,
          description: 'Global media processing settings (compression, watermark, format, etc.)',
        });
        return true;
      },
    },
  ],
  exports: [MediaService, ImageProcessingService],
})
export class MediaModule {}
