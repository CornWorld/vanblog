import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import {
  imageProcessingQueue,
  type ImageProcessingQueueInsert,
  type ImageProcessingQueueSelect,
} from '@vanblog/shared/drizzle';
import { eq, and, lt, desc } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../../database';

import { ImageProcessingService, type ImageProcessingOptions } from './image-processing.service';

// Define schemas for JSON validation (jsonb() column type already handles deserialization)
const ImageProcessingOptionsSchema = z.object({
  watermark: z
    .object({
      text: z.string(),
      position: z.string().optional(),
      opacity: z.number().optional(),
    })
    .optional(),
  compress: z
    .object({
      quality: z.number().optional(),
      maxWidth: z.number().optional(),
      maxHeight: z.number().optional(),
      format: z.string().optional(),
      progressive: z.boolean().optional(),
      optimizeForWeb: z.boolean().optional(),
      removeMetadata: z.boolean().optional(),
      fit: z.string().optional(),
    })
    .optional(),
  quality: z.number().optional(),
});

export interface QueueTask {
  id: number;
  fileId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  processingConfig: ImageProcessingOptions | null;
  originalBuffer: string | null;
  processedBuffer: string | null;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

@Injectable()
export class ImageProcessingQueueService implements OnModuleInit, OnModuleDestroy {
  private queueTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  onModuleInit(): void {
    // TODO: Fix column name mismatch between 'processingConfig' and 'processing_config'
    // Temporarily disable queue processor
    // this.startQueueProcessor();
  }

  onModuleDestroy(): void {
    this.stopQueueProcessor();
  }

  private startQueueProcessor(): void {
    this.queueTimer = setInterval(() => {
      if (!this.isProcessing) {
        void this.processQueue();
      }
    }, 5000); // 每5秒检查一次队列
  }

  private stopQueueProcessor(): void {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }
  }

  async addTask(
    fileId: number,
    processingConfig: ImageProcessingOptions,
    originalBuffer: Buffer,
    priority = 0,
  ): Promise<QueueTask> {
    const taskData: ImageProcessingQueueInsert = {
      fileId,
      status: 'pending',
      priority,
      processingConfig: JSON.stringify(processingConfig),
      originalBuffer: originalBuffer.toString('base64'),
      attempts: 0,
      maxAttempts: 3,
      createdAt: dayjs().format(),
      updatedAt: dayjs().format(),
    };

    const result = await this.db.insert(imageProcessingQueue).values(taskData).returning();

    return this.mapToQueueTask(result[0]);
  }

  async getTaskStatus(taskId: number): Promise<QueueTask | null> {
    const result = await this.db
      .select()
      .from(imageProcessingQueue)
      .where(eq(imageProcessingQueue.id, taskId))
      .limit(1);

    return result.length > 0 ? this.mapToQueueTask(result[0]) : null;
  }

  async getTasksByFileId(fileId: number): Promise<QueueTask[]> {
    const result = await this.db
      .select()
      .from(imageProcessingQueue)
      .where(eq(imageProcessingQueue.fileId, fileId))
      .orderBy(desc(imageProcessingQueue.createdAt));

    return result.map((task) => this.mapToQueueTask(task));
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      const pendingTasks = await this.db
        .select()
        .from(imageProcessingQueue)
        .where(
          and(
            eq(imageProcessingQueue.status, 'pending'),
            lt(imageProcessingQueue.attempts, imageProcessingQueue.maxAttempts),
          ),
        )
        .orderBy(desc(imageProcessingQueue.priority), imageProcessingQueue.createdAt)
        .limit(5);

      for (const task of pendingTasks) {
        await this.processTask(task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(task: ImageProcessingQueueSelect): Promise<void> {
    try {
      // 更新任务状态为处理中
      await this.db
        .update(imageProcessingQueue)
        .set({
          status: 'processing',
          startedAt: dayjs().format(),
          attempts: task.attempts + 1,
          updatedAt: dayjs().format(),
        })
        .where(eq(imageProcessingQueue.id, task.id));

      // 处理图片 - 使用 Zod Schema 安全解析配置
      const originalBuffer = Buffer.from(task.originalBuffer ?? '', 'base64');
      const defaultConfig: ImageProcessingOptions = { quality: 80 };

      // WORKAROUND: jsonb() fromDriver() may not be called in SELECT
      // Manually parse if it's a string
      let configValue = task.processingConfig;
      if (typeof configValue === 'string') {
        try {
          configValue = JSON.parse(configValue);
        } catch {
          configValue = null;
        }
      }

      const parsed = ImageProcessingOptionsSchema.safeParse(configValue);
      const processingConfig: ImageProcessingOptions = parsed.success
        ? (parsed.data as ImageProcessingOptions)
        : defaultConfig;

      const result = await this.imageProcessingService.compressImage(
        originalBuffer,
        processingConfig,
      );

      // 更新任务状态为完成
      await this.db
        .update(imageProcessingQueue)
        .set({
          status: 'completed',
          processedBuffer: result.buffer.toString('base64'),
          completedAt: dayjs().format(),
          updatedAt: dayjs().format(),
        })
        .where(eq(imageProcessingQueue.id, task.id));
    } catch (error) {
      // 更新任务状态为失败
      await this.db
        .update(imageProcessingQueue)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          updatedAt: dayjs().format(),
        })
        .where(eq(imageProcessingQueue.id, task.id));
    }
  }

  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stats = await this.db
      .select({
        status: imageProcessingQueue.status,
        count: imageProcessingQueue.id,
      })
      .from(imageProcessingQueue);

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const stat of stats) {
      if (stat.status in result) {
        result[stat.status]++;
      }
    }

    return result;
  }

  private mapToQueueTask(task: ImageProcessingQueueSelect): QueueTask {
    // WORKAROUND: jsonb() fromDriver() not called in .returning()
    // Manually parse if it's a string
    let configValue = task.processingConfig;
    if (typeof configValue === 'string') {
      try {
        configValue = JSON.parse(configValue);
      } catch {
        configValue = null;
      }
    }

    // Use Zod Schema to safely parse processingConfig
    const parsed = ImageProcessingOptionsSchema.safeParse(configValue);

    return {
      id: task.id,
      fileId: task.fileId,
      status: task.status,
      priority: task.priority,
      processingConfig: parsed.success ? (parsed.data as ImageProcessingOptions) : null,
      originalBuffer: task.originalBuffer,
      processedBuffer: task.processedBuffer,
      errorMessage: task.errorMessage,
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    };
  }
}
