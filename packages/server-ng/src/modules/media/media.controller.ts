import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import dayjs from 'dayjs';
import { memoryStorage } from 'multer';
import { ZodValidationPipe } from 'nestjs-zod';

import { staticFiles } from '../../database/schema';
import { Perm } from '../auth/permissions.decorator';

import { BatchDeleteDto, BatchDeleteSchema } from './dto/batch-delete.dto';
import { ListStaticFilesDto } from './dto/list-static-files.dto';
import {
  UpdateStorageConfigDto,
  StorageConfigResponseDto,
  UpdateStorageConfigSchema,
} from './dto/storage-config.dto';
import { UploadFileDto, UploadFile } from './dto/upload-file.dto';
import { ImageProcessingService } from './services/image-processing.service';
import { MediaService } from './services/media.service';
import { StorageConfigService } from './services/storage-config.service';

interface WatermarkBody {
  watermarkText?: string;
  watermarkPosition?: string;
  watermarkOpacity?: string;
  filename?: string;
  provider?: string;
}

/**
 * 媒体文件管理控制器
 *
 * 提供文件上传、下载、删除、批量操作等媒体文件管理功能。
 * 支持图片水印处理、存储配置管理和文章图片扫描等高级功能。
 */
@ApiTags('Media')
@Controller({ path: 'admin/media', version: '2' })
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly storageConfigService: StorageConfigService,
  ) {}

  /**
   * 上传文件
   *
   * 上传单个文件到服务器，支持多种文件类型，最大文件大小 50MB。
   *
   * @param file 上传的文件对象
   * @param uploadFileDto 上传文件的配置信息
   * @returns 上传成功的文件信息
   */
  @Post('upload')
  @Perm('media', ['create'])
  @ApiOperation({ summary: '上传文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFile })
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
      const result = await this.imageProcessingService.compressImage(file.buffer, {
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1080,
      });
      processedBuffer = result.buffer;
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

  /**
   * 上传文件并添加水印
   *
   * 上传图片文件并自动添加文字水印，支持自定义水印文本、位置和透明度。
   *
   * @param file 上传的图片文件
   * @param body 水印配置信息
   * @returns 处理后的文件信息
   */
  @Post('upload-with-watermark')
  @Perm('media', ['create'])
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
    const result = await this.imageProcessingService.compressImage(processedBuffer, {
      quality: 85,
      maxWidth: 1920,
      maxHeight: 1080,
    });
    processedBuffer = result.buffer;

    const processedFile = {
      ...file,
      buffer: processedBuffer,
      size: processedBuffer.length,
    };

    return this.mediaService.uploadFile(processedFile, body.filename, body.provider);
  }

  /**
   * 获取文件列表
   *
   * 分页查询文件列表，支持按文件名、类型等条件过滤。
   *
   * @param query 查询参数，包含分页和过滤条件
   * @returns 分页的文件列表
   */
  @Get()
  @Perm('media', ['read'])
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

  /**
   * 获取单个文件信息
   *
   * 根据文件 ID 获取文件的详细信息。
   *
   * @param id 文件 ID
   * @returns 文件详细信息
   */
  @Get(':id')
  @Perm('media', ['read'])
  @ApiOperation({ summary: '获取单个文件信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFile(@Param('id', ParseIntPipe) id: number): Promise<typeof staticFiles.$inferSelect> {
    return this.mediaService.getFileById(id);
  }

  /**
   * 删除单个文件
   *
   * 根据文件 ID 删除指定文件，同时清理存储空间。
   *
   * @param id 文件 ID
   * @returns 删除操作结果
   */
  @Delete(':id')
  @Perm('media', ['delete'])
  @ApiOperation({ summary: '删除单个文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteFile(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.mediaService.deleteFile(id);
  }

  /**
   * 批量删除文件
   *
   * 根据文件 ID 列表批量删除多个文件，提高删除效率。
   *
   * @param batchDeleteDto 包含要删除的文件 ID 列表
   * @returns 批量删除操作结果，包含删除数量
   */
  @Post('batch-delete')
  @Perm('media', ['delete'])
  @ApiOperation({ summary: '批量删除文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async batchDelete(
    @Body(new ZodValidationPipe(BatchDeleteSchema)) batchDeleteDto: BatchDeleteDto,
  ): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    return this.mediaService.deleteFiles(batchDeleteDto.ids);
  }

  /**
   * 扫描文章中的图片
   *
   * 扫描所有文章内容，自动发现并添加文章中引用的图片到媒体库。
   *
   * @returns 扫描结果，包含扫描数量和新增数量
   */
  @Post('scan-articles')
  @Perm('media', ['create'])
  @ApiOperation({ summary: '扫描文章中的图片' })
  @ApiResponse({ status: 200, description: '扫描完成' })
  async scanArticleImages(): Promise<{ scanned: number; added: number }> {
    return this.mediaService.scanArticleImages();
  }

  /**
   * 导出所有图片信息
   *
   * 导出媒体库中所有文件的详细信息，用于备份或迁移。
   *
   * @returns 包含所有文件信息的导出数据
   */
  @Get('export/all')
  @Perm('media', ['read'])
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
      createdAt: string | null;
    }>;
  }> {
    return this.mediaService.exportAllImages();
  }

  @Get('storage-config')
  @Perm('setting', ['read'])
  @ApiOperation({ summary: '获取存储配置' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStorageConfig(): Promise<StorageConfigResponseDto> {
    return this.storageConfigService.getStorageConfig();
  }

  @Post('storage-config')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: '更新存储配置' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateStorageConfig(
    @Body(new ZodValidationPipe(UpdateStorageConfigSchema)) updateDto: UpdateStorageConfigDto,
  ): Promise<StorageConfigResponseDto> {
    return this.storageConfigService.updateStorageConfig(updateDto);
  }

  /**
   * 从剪贴板上传图片
   *
   * 接收 Base64 格式的图片数据，将剪贴板中的图片直接上传到服务器。
   *
   * @param body 包含 Base64 图片数据和可选文件名
   * @returns 上传成功的文件信息
   */
  @Post('upload-clipboard')
  @Perm('media', ['create'])
  @ApiOperation({ summary: '从剪贴板上传图片' })
  @ApiConsumes('application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        dataUrl: {
          type: 'string',
          description: 'Base64 格式的图片数据',
        },
        filename: {
          type: 'string',
          description: '文件名',
        },
      },
      required: ['dataUrl'],
    },
  })
  @ApiResponse({ status: 201, description: '上传成功' })
  async uploadFromClipboard(
    @Body() body: { dataUrl: string; filename?: string },
  ): Promise<typeof staticFiles.$inferSelect> {
    const matches = body.dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new BadRequestException('Invalid data URL format');
    }

    const [, mimeType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');

    const ext = mimeType.split('/')[1] ?? 'png';
    const filename = body.filename ?? `clipboard-${dayjs().valueOf()}.${ext}`;

    const file: Express.Multer.File = {
      fieldname: 'clipboard',
      originalname: filename,
      encoding: '7bit',
      mimetype: mimeType,
      buffer,
      size: buffer.length,
    } as Express.Multer.File;

    let processedBuffer = buffer;

    // 压缩图片
    if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
      const result = await this.imageProcessingService.compressImage(buffer, {
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1080,
      });
      processedBuffer = result.buffer;
    }

    const processedFile = {
      ...file,
      buffer: processedBuffer,
      size: processedBuffer.length,
    };

    return this.mediaService.uploadFile(processedFile, filename);
  }
}
