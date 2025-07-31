import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MediaController } from './media.controller';
import { MediaService } from './services/media.service';
import { ImageProcessingService } from './services/image-processing.service';
import { StorageConfigService } from './services/storage-config.service';
import { StorageFactoryService } from './services/storage-factory.service';
import { LocalStorageService } from './services/storages/local-storage.service';
import { PicgoStorageService } from './services/storages/picgo-storage.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    ImageProcessingService,
    StorageConfigService,
    StorageFactoryService,
    LocalStorageService,
    PicgoStorageService,
  ],
  exports: [MediaService, ImageProcessingService],
})
export class MediaModule {}
