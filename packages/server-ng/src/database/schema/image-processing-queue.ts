import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const imageProcessingQueue = sqliteTable('image_processing_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileId: integer('file_id').notNull(),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] })
    .notNull()
    .default('pending'),
  priority: integer('priority').notNull().default(0), // 高数值 = 高优先级
  processingConfig: text('processing_config', { mode: 'json' }), // JSON 配置
  originalBuffer: text('original_buffer'), // Base64 编码的原始文件
  processedBuffer: text('processed_buffer'), // Base64 编码的处理后文件
  errorMessage: text('error_message'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

export type ImageProcessingQueueInsert = typeof imageProcessingQueue.$inferInsert;
export type ImageProcessingQueueSelect = typeof imageProcessingQueue.$inferSelect;
