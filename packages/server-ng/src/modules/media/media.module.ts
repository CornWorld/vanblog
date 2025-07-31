import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MediaController } from './media.controller';
import { MediaService } from './services/media.service';
import { ImageProcessingService } from './services/image-processing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MediaController],
  providers: [MediaService, ImageProcessingService],
  exports: [MediaService, ImageProcessingService],
})
export class MediaModule {}
