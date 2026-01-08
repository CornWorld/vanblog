import { Readable } from 'stream';

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
  UploadedFiles,
  ParseIntPipe,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { staticFiles } from '@vanblog/shared/drizzle';
import { memoryStorage } from 'multer';

import { normalizeMediaProcessingOverride } from '../../shared/contracts';
import { Perm } from '../auth/permissions.decorator';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { BatchDeleteSchema } from './dto/batch-delete.dto';
import {
  CompleteChunkUploadSchema,
  InitiateChunkUploadSchema,
  UploadChunkSchema,
} from './dto/chunk-upload.dto';
import { ListStaticFilesSchema } from './dto/list-static-files.dto';
import {
  MediaProcessingSettings,
  MEDIA_PROCESSING_CONFIG_KEY,
  MediaProcessingSettingsSchema,
  MediaProcessingOverrideFromString,
} from './dto/media-settings.dto';
import { StorageConfigResponseDto, UpdateStorageConfigSchema } from './dto/storage-config.dto';
import { UploadFileSchema, UploadFile } from './dto/upload-file.dto';
import {
  ImageProcessingQueueService,
  type QueueTask,
} from './services/image-processing-queue.service';
import { ImageProcessingService } from './services/image-processing.service';
import { MediaService } from './services/media.service';
import { StorageConfigService } from './services/storage-config.service';

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
    private readonly imageProcessingQueueService: ImageProcessingQueueService,
    private readonly storageConfigService: StorageConfigService,
    private readonly settingCore: SettingCoreService,
  ) {}

  private async getMediaProcessingConfig(): Promise<MediaProcessingSettings> {
    // Use SettingCore with Schema - jsonb() column handles JSON deserialization
    const fallback = MediaProcessingSettingsSchema.parse({});
    const cfg = await this.settingCore.getConfig<MediaProcessingSettings>(
      MEDIA_PROCESSING_CONFIG_KEY,
      fallback,
      MediaProcessingSettingsSchema,
    );

    return cfg ?? fallback;
  }

  // Merge request-time override into global config, using Zod to parse JSON strings
  private mergeConfigOverride(
    base: MediaProcessingSettings,
    override?: unknown,
  ): MediaProcessingSettings {
    if (override == null) return base;

    // Use Zod schema to parse (handles JSON strings automatically)
    const parsed = MediaProcessingOverrideFromString.parse(override);
    if (!parsed) return base;

    const normalizedOverride = normalizeMediaProcessingOverride(parsed);
    return {
      compress: { ...base.compress, ...normalizedOverride.compress },
      watermark: { ...base.watermark, ...normalizedOverride.watermark },
    };
  }

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
    @Body() raw: unknown,
  ): Promise<
    | typeof staticFiles.$inferSelect
    | (typeof staticFiles.$inferSelect & { taskId: number; status: string })
  > {
    const uploadFileDto = UploadFileSchema.parse(raw);
    const globalConfig = await this.getMediaProcessingConfig();
    const config = this.mergeConfigOverride(globalConfig, uploadFileDto.processing);

    // 如果启用异步处理且是图片文件（非SVG）
    if (
      uploadFileDto.async &&
      file.mimetype.startsWith('image/') &&
      file.mimetype !== 'image/svg+xml' &&
      (config.watermark.enabled || config.compress.enabled)
    ) {
      // 先上传原始文件
      const uploadedFile = await this.mediaService.uploadFile(
        file,
        uploadFileDto.filename,
        uploadFileDto.provider,
      );

      // 添加到处理队列
      const processingOptions = {
        watermark: config.watermark.enabled
          ? {
              text: config.watermark.text,
              position: config.watermark.position,
              opacity: config.watermark.opacity,
            }
          : undefined,
        compress: config.compress.enabled
          ? {
              quality: config.compress.quality,
              maxWidth: config.compress.maxWidth,
              maxHeight: config.compress.maxHeight,
              format: config.compress.format,
              progressive: config.compress.progressive,
              optimizeForWeb: config.compress.optimizeForWeb,
              removeMetadata: config.compress.removeMetadata,
              fit: config.compress.fit,
            }
          : undefined,
      };

      const task = await this.imageProcessingQueueService.addTask(
        uploadedFile.id,
        processingOptions,
        file.buffer,
      );

      return {
        ...uploadedFile,
        taskId: task.id,
        status: 'processing',
      } as typeof staticFiles.$inferSelect & { taskId: number; status: string };
    }

    // 同步处理（原有逻辑）
    let processedBuffer = file.buffer;

    // 针对图片类型执行处理（水印 -> 压缩），SVG 跳过
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
      // 水印（受全局/覆盖配置控制）
      if (config.watermark.enabled && config.watermark.text) {
        processedBuffer = await this.imageProcessingService.addWatermark(processedBuffer, {
          text: config.watermark.text,
          position: config.watermark.position,
          opacity: config.watermark.opacity,
        });
      }

      // 压缩（受全局/覆盖配置控制）
      if (config.compress.enabled) {
        const result = await this.imageProcessingService.compressImage(processedBuffer, {
          quality: config.compress.quality,
          maxWidth: config.compress.maxWidth,
          maxHeight: config.compress.maxHeight,
          format: config.compress.format,
          progressive: config.compress.progressive,
          optimizeForWeb: config.compress.optimizeForWeb,
          removeMetadata: config.compress.removeMetadata,
          fit: config.compress.fit,
        });
        processedBuffer = result.buffer;
      }
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
  async listFiles(@Query() raw: unknown): Promise<{
    items: (typeof staticFiles.$inferSelect)[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const query = ListStaticFilesSchema.parse(raw);
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
  @HttpCode(200)
  @Perm('media', ['delete'])
  @ApiOperation({ summary: '批量删除文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async batchDelete(@Body() raw: unknown): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    const dto = BatchDeleteSchema.parse(raw);
    return this.mediaService.deleteFiles(dto.ids);
  }

  // 多文件上传：使用内存缓冲，支持并发
  @Post('upload-multiple')
  @Perm('media', ['create'])
  @ApiOperation({ summary: '批量上传多个文件' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: '待上传文件列表',
        },
        provider: { type: 'string', description: '存储提供方（可选）' },
        processing: {
          oneOf: [{ type: 'object' }, { type: 'string', description: 'JSON 字符串' }],
          description: '处理配置覆盖（可选，JSON 对象或字符串）',
        },
      },
      required: ['files'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: { provider?: string; processing?: unknown },
  ): Promise<Array<typeof staticFiles.$inferSelect>> {
    const global = await this.getMediaProcessingConfig();
    const config = this.mergeConfigOverride(global, body.processing);

    const results: Array<typeof staticFiles.$inferSelect> = [];
    for (const file of files) {
      let { buffer } = file;
      if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') {
        if (config.watermark.enabled && config.watermark.text) {
          buffer = await this.imageProcessingService.addWatermark(buffer, {
            text: config.watermark.text,
            position: config.watermark.position,
            opacity: config.watermark.opacity,
          });
        }
        if (config.compress.enabled) {
          const { buffer: out } = await this.imageProcessingService.compressImage(buffer, {
            quality: config.compress.quality,
            maxWidth: config.compress.maxWidth,
            maxHeight: config.compress.maxHeight,
            format: config.compress.format,
            progressive: config.compress.progressive,
            optimizeForWeb: config.compress.optimizeForWeb,
            removeMetadata: config.compress.removeMetadata,
            fit: config.compress.fit,
          });
          buffer = out;
        }
      }

      const processedFile = { ...file, buffer, size: buffer.length };
      const saved = await this.mediaService.uploadFile(
        processedFile,
        file.originalname,
        body.provider,
      );
      results.push(saved);
    }

    return results;
  }

  @Post('upload/initiate')
  @Perm('media', ['create'])
  @ApiOperation({ summary: '初始化分片上传会话' })
  @ApiConsumes('application/json')
  @ApiResponse({ status: 200, description: '会话创建成功' })
  async initiateChunkUpload(@Body() raw: unknown): Promise<{
    uploadId: string;
    uploaded: boolean[];
    totalChunks: number;
  }> {
    const dto = InitiateChunkUploadSchema.parse(raw);
    return this.mediaService.initiateChunkUpload(dto);
  }

  @Post('upload/chunk')
  @Perm('media', ['create'])
  @ApiOperation({ summary: '上传分片（已上传文件块，不做流式处理）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '当前分片二进制内容' },
        uploadId: { type: 'string', description: '上传会话 ID' },
        index: { type: 'integer', minimum: 0, description: '分片索引（从 0 开始）' },
      },
      required: ['file', 'uploadId', 'index'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadChunk(
    @UploadedFile() file: Express.Multer.File,
    @Body() raw: unknown,
  ): Promise<{ index: number; size: number }> {
    const dto = UploadChunkSchema.parse(raw);
    return this.mediaService.uploadChunk({ uploadId: dto.uploadId, index: dto.index, file });
  }

  @Post('upload/complete')
  @Perm('media', ['create'])
  @ApiOperation({ summary: '完成分片上传并合并，作为常规上传入库' })
  @ApiConsumes('application/json')
  @ApiResponse({ status: 201, description: '合并并入库成功' })
  async completeChunkUpload(@Body() raw: unknown): Promise<typeof staticFiles.$inferSelect> {
    const dto = CompleteChunkUploadSchema.parse(raw);
    const { buffer: mergedBuffer, meta } = await this.mediaService.mergeChunks(dto.uploadId);

    const config = this.mergeConfigOverride(await this.getMediaProcessingConfig(), dto.processing);

    let outBuffer = mergedBuffer;
    if (meta.mimeType?.startsWith('image/') && meta.mimeType !== 'image/svg+xml') {
      if (config.watermark.enabled && config.watermark.text) {
        outBuffer = await this.imageProcessingService.addWatermark(outBuffer, {
          text: config.watermark.text,
          position: config.watermark.position,
          opacity: config.watermark.opacity,
        });
      }
      if (config.compress.enabled) {
        const { buffer } = await this.imageProcessingService.compressImage(outBuffer, {
          quality: config.compress.quality,
          maxWidth: config.compress.maxWidth,
          maxHeight: config.compress.maxHeight,
          format: config.compress.format,
          progressive: config.compress.progressive,
          optimizeForWeb: config.compress.optimizeForWeb,
          removeMetadata: config.compress.removeMetadata,
          fit: config.compress.fit,
        });
        outBuffer = buffer;
      }
    }

    const processedFile = {
      buffer: outBuffer,
      size: outBuffer.length,
      originalname: dto.filename ?? meta.filename,
      mimetype: meta.mimeType ?? 'application/octet-stream',
      fieldname: 'file',
      encoding: '7bit',
      stream: Readable.from(outBuffer),
      destination: '',
      filename: '',
      path: '',
    } as Express.Multer.File;

    // 当 provider 未提供时，避免传递 undefined 作为第三个参数
    const saved = meta.provider
      ? await this.mediaService.uploadFile(
          processedFile,
          dto.filename ?? meta.filename,
          meta.provider,
        )
      : await this.mediaService.uploadFile(processedFile, dto.filename ?? meta.filename);

    await this.mediaService.cleanupChunks(dto.uploadId);

    return saved;
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
  async getStorageConfig(): Promise<StorageConfigResponseDto | null> {
    return this.storageConfigService.getStorageConfig();
  }

  @Post('storage-config')
  @Perm('setting', ['update'])
  @ApiOperation({ summary: '更新存储配置' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateStorageConfig(@Body() raw: unknown): Promise<StorageConfigResponseDto> {
    const updateDto = UpdateStorageConfigSchema.parse(raw);
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
        processing: {
          oneOf: [{ type: 'object' }, { type: 'string', description: 'JSON 字符串' }],
          description: '处理配置覆盖（可选，JSON 对象或字符串）',
        },
      },
      required: ['dataUrl'],
    },
  })
  @ApiResponse({ status: 201, description: '上传成功' })
  async uploadFromClipboard(
    @Body() body: { dataUrl: string; filename?: string; processing?: unknown },
  ): Promise<typeof staticFiles.$inferSelect> {
    const match = body.dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) {
      throw new BadRequestException('Invalid data URL');
    }

    const [, mimeType, base64] = match;
    const buffer: Buffer = Buffer.from(base64, 'base64');

    const global = await this.getMediaProcessingConfig();
    const config = this.mergeConfigOverride(global, body.processing);

    let outBuffer = buffer;
    if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') {
      if (config.watermark.enabled && config.watermark.text) {
        outBuffer = await this.imageProcessingService.addWatermark(outBuffer, {
          text: config.watermark.text,
          position: config.watermark.position,
          opacity: config.watermark.opacity,
        });
      }
      if (config.compress.enabled) {
        const { buffer: out } = await this.imageProcessingService.compressImage(outBuffer, {
          quality: config.compress.quality,
          maxWidth: config.compress.maxWidth,
          maxHeight: config.compress.maxHeight,
          format: config.compress.format,
          progressive: config.compress.progressive,
          optimizeForWeb: config.compress.optimizeForWeb,
          removeMetadata: config.compress.removeMetadata,
          fit: config.compress.fit,
        });
        outBuffer = out;
      }
    }

    const filename =
      body.filename ?? `clipboard-${String(Date.now())}.${this.extFromMime(mimeType)}`;

    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: mimeType,
      buffer: outBuffer,
      size: outBuffer.length,
      stream: Readable.from(outBuffer),
      destination: '',
      filename: '',
      path: '',
    };

    const saved = await this.mediaService.uploadFile(file, filename);
    return saved;
  }

  /**
   * 获取队列任务状态
   *
   * 根据任务ID查询图片处理队列中的任务状态。
   *
   * @param taskId 任务ID
   * @returns 任务状态信息
   */
  @Get('queue/task/:taskId')
  @Perm('media', ['read'])
  @ApiOperation({ summary: '获取队列任务状态' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTaskStatus(@Param('taskId', ParseIntPipe) taskId: number): Promise<QueueTask> {
    const task = await this.imageProcessingQueueService.getTaskStatus(taskId);
    if (!task) {
      throw new BadRequestException('任务不存在');
    }
    return task;
  }

  /**
   * 获取文件的所有队列任务
   *
   * 根据文件ID查询该文件的所有处理任务。
   *
   * @param fileId 文件ID
   * @returns 任务列表
   */
  @Get('queue/file/:fileId')
  @Perm('media', ['read'])
  @ApiOperation({ summary: '获取文件的所有队列任务' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFileQueueTasks(@Param('fileId', ParseIntPipe) fileId: number): Promise<QueueTask[]> {
    return await this.imageProcessingQueueService.getTasksByFileId(fileId);
  }

  /**
   * 获取队列统计信息
   *
   * 获取图片处理队列的统计信息，包括各状态任务数量。
   *
   * @returns 队列统计信息
   */
  @Get('queue/stats')
  @Perm('media', ['read'])
  @ApiOperation({ summary: '获取队列统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    return await this.imageProcessingQueueService.getQueueStats();
  }

  private extFromMime(mime: string): string {
    // 最小可用映射，非图片类型回退为 bin
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
    };
    const known = map[mime];
    if (typeof known === 'string') {
      return known;
    }
    const slash = mime.indexOf('/');
    return slash > 0 ? mime.slice(slash + 1).replace(/\+xml$/, '') : 'bin';
  }
}
