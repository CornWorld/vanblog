import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { eq, and, lt, desc } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../../database';
import {
  imageProcessingQueue,
  type ImageProcessingQueueInsert,
  type ImageProcessingQueueSelect,
} from '../../../database/schema/image-processing-queue';

import { ImageProcessingService, type ImageProcessingOptions } from './image-processing.service';

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
    this.startQueueProcessor();
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
          startedAt: new Date().toISOString(),
          attempts: task.attempts + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(imageProcessingQueue.id, task.id));

      // 处理图片
      const originalBuffer = Buffer.from(task.originalBuffer ?? '', 'base64');
      const processingConfig: ImageProcessingOptions =
        typeof task.processingConfig === 'string'
          ? (JSON.parse(task.processingConfig) as ImageProcessingOptions)
          : { quality: 80 };

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
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(imageProcessingQueue.id, task.id));
    } catch (error) {
      // 更新任务状态为失败
      await this.db
        .update(imageProcessingQueue)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
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
    return {
      id: task.id,
      fileId: task.fileId,
      status: task.status,
      priority: task.priority,
      processingConfig:
        typeof task.processingConfig === 'string'
          ? (JSON.parse(task.processingConfig) as ImageProcessingOptions)
          : null,
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
