import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './services/media.service';
import { ImageProcessingService } from './services/image-processing.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { ListStaticFilesDto } from './dto/list-static-files.dto';
import { BatchDeleteDto } from './dto/batch-delete.dto';
import { memoryStorage } from 'multer';
import { staticFiles } from '../../db/schema';

interface WatermarkBody {
  watermarkText?: string;
  watermarkPosition?: string;
  watermarkOpacity?: string;
  filename?: string;
  provider?: string;
}

@ApiTags('媒体资源')
@Controller('api/v2/admin/media')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: '上传文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFileDto })
  @ApiResponse({ status: 201, description: '文件上传成功' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)) {
          callback(new BadRequestException('只支持图片格式文件'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
  ): Promise<typeof staticFiles.$inferSelect> {
    let processedBuffer = file.buffer;

    // 压缩图片
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
      processedBuffer = await this.imageProcessingService.compressImage(file.buffer, {
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1080,
      });
    }

    // 更新文件对象
    const processedFile = {
      ...file,
      buffer: processedBuffer,
      size: processedBuffer.length,
    };

    return this.mediaService.uploadFile(
      processedFile,
      uploadFileDto.filename,
      uploadFileDto.provider,
    );
  }

  @Post('upload-with-watermark')
  @ApiOperation({ summary: '上传文件并添加水印' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '文件上传成功' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async uploadFileWithWatermark(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: WatermarkBody,
  ): Promise<typeof staticFiles.$inferSelect> {
    let processedBuffer = file.buffer;

    // 添加水印
    if (body.watermarkText) {
      processedBuffer = await this.imageProcessingService.addWatermark(processedBuffer, {
        text: body.watermarkText,
        position:
          (body.watermarkPosition as
            | 'center'
            | 'northwest'
            | 'northeast'
            | 'southwest'
            | 'southeast'
            | undefined) ?? 'southeast',
        opacity: body.watermarkOpacity ? parseFloat(body.watermarkOpacity) : 0.5,
      });
    }

    // 压缩图片
    processedBuffer = await this.imageProcessingService.compressImage(processedBuffer, {
      quality: 85,
      maxWidth: 1920,
      maxHeight: 1080,
    });

    const processedFile = {
      ...file,
      buffer: processedBuffer,
      size: processedBuffer.length,
    };

    return this.mediaService.uploadFile(processedFile, body.filename, body.provider);
  }

  @Get()
  @ApiOperation({ summary: '获取文件列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async listFiles(@Query() query: ListStaticFilesDto): Promise<{
    items: (typeof staticFiles.$inferSelect)[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.mediaService.listFiles(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个文件信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFile(@Param('id', ParseIntPipe) id: number): Promise<typeof staticFiles.$inferSelect> {
    return this.mediaService.getFileById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除单个文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteFile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.mediaService.deleteFile(id);
  }

  @Post('batch-delete')
  @ApiOperation({ summary: '批量删除文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async batchDelete(@Body() batchDeleteDto: BatchDeleteDto): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    return this.mediaService.deleteFiles(batchDeleteDto.ids);
  }

  @Post('scan-articles')
  @ApiOperation({ summary: '扫描文章中的图片' })
  @ApiResponse({ status: 200, description: '扫描完成' })
  async scanArticleImages(): Promise<{ scanned: number; added: number }> {
    return this.mediaService.scanArticleImages();
  }

  @Get('export/all')
  @ApiOperation({ summary: '导出所有图片信息' })
  @ApiResponse({ status: 200, description: '导出成功' })
  async exportAllImages(): Promise<{
    total: number;
    files: Array<{
      id: number;
      filename: string;
      path: string;
      size: number;
      mimeType: string | null;
      createdAt: Date | null;
    }>;
  }> {
    return this.mediaService.exportAllImages();
  }
}
