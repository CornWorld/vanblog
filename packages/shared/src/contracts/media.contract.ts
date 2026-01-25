import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { StaticFile, PaginationQuery, DeleteResponse } from '../runtime/schema.js';

// Media list response
export const StaticFileList = z.object({
  items: z.array(StaticFile),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

// Media query
export const MediaQuery = PaginationQuery.extend({
  keyword: z.string().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
});

// Batch delete schema
export const BatchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

// Chunk upload schemas
export const InitiateChunkUploadSchema = z.object({
  filename: z.string().min(1),
  totalSize: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
  totalChunks: z.number().int().positive(),
  mimeType: z.string().optional(),
  provider: z.string().optional(),
  uploadId: z.string().optional(),
});

export const UploadChunkSchema = z.object({
  uploadId: z.string().min(1),
  index: z.number().int().nonnegative(),
});

export const CompleteChunkUploadSchema = z.object({
  uploadId: z.string().min(1),
  filename: z.string().optional(),
  provider: z.string().optional(),
  processing: z.unknown().optional(),
});

// Storage config
export const StorageConfig = z.object({
  provider: z.enum(['local', 'picgo']),
  enabled: z.boolean().optional(),
  localPath: z.string().optional(),
  baseUrl: z.string().optional(),
  picgoConfig: z
    .object({
      uploader: z.string(),
      config: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

// Upload response
export const UploadResponse = z.object({
  id: z.number(),
  filename: z.string(),
  path: z.string(),
  url: z.string(),
  size: z.number(),
  mimeType: z.string().optional(),
});

// Queue stats
export const QueueStats = z.object({
  pending: z.number(),
  processing: z.number(),
  completed: z.number(),
  failed: z.number(),
});

// Task status
export const TaskStatus = z.object({
  id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const createMediaContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    list: {
      method: 'GET',
      path: '/v2/admin/media',
      query: MediaQuery,
      responses: { 200: StaticFileList },
      summary: 'List media files',
    },
    getById: {
      method: 'GET',
      path: '/v2/admin/media/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: StaticFile },
      summary: 'Get media by ID',
    },
    deleteById: {
      method: 'DELETE',
      path: '/v2/admin/media/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: DeleteResponse.extend({ message: z.string() }) },
      summary: 'Delete media by ID',
    },
    batchDelete: {
      method: 'POST',
      path: '/v2/admin/media/batch-delete',
      body: BatchDeleteSchema,
      responses: {
        200: z.object({ success: z.boolean(), deletedCount: z.number(), message: z.string() }),
      },
      summary: 'Batch delete media',
    },
    uploadFile: {
      method: 'POST',
      path: '/v2/admin/media/upload',
      body: z.unknown(),
      responses: { 201: UploadResponse },
      summary: 'Upload file',
    },
    uploadMultiple: {
      method: 'POST',
      path: '/v2/admin/media/upload-multiple',
      body: z.unknown(),
      responses: { 201: z.array(UploadResponse) },
      summary: 'Upload multiple files',
    },
    initiateChunkUpload: {
      method: 'POST',
      path: '/v2/admin/media/upload/initiate',
      body: InitiateChunkUploadSchema,
      responses: {
        200: z.object({
          uploadId: z.string(),
          uploaded: z.array(z.boolean()),
          totalChunks: z.number(),
        }),
      },
      summary: 'Initiate chunk upload',
    },
    uploadChunk: {
      method: 'POST',
      path: '/v2/admin/media/upload/chunk',
      body: UploadChunkSchema,
      responses: { 200: z.object({ index: z.number(), size: z.number() }) },
      summary: 'Upload chunk',
    },
    completeChunkUpload: {
      method: 'POST',
      path: '/v2/admin/media/upload/complete',
      body: CompleteChunkUploadSchema,
      responses: { 201: UploadResponse },
      summary: 'Complete chunk upload',
    },
    scanArticles: {
      method: 'POST',
      path: '/v2/admin/media/scan-articles',
      body: z.object({}).optional(),
      responses: { 200: z.object({ scanned: z.number(), added: z.number() }) },
      summary: 'Scan articles',
    },
    exportAll: {
      method: 'GET',
      path: '/v2/admin/media/export/all',
      responses: { 200: z.array(StaticFile) },
      summary: 'Export all media',
    },
    getStorageConfig: {
      method: 'GET',
      path: '/v2/admin/media/storage-config',
      responses: { 200: StorageConfig.nullable() },
      summary: 'Get storage config',
    },
    updateStorageConfig: {
      method: 'POST',
      path: '/v2/admin/media/storage-config',
      body: StorageConfig,
      responses: { 200: StorageConfig },
      summary: 'Update storage config',
    },
    uploadClipboard: {
      method: 'POST',
      path: '/v2/admin/media/upload-clipboard',
      body: z.unknown(),
      responses: { 201: UploadResponse },
      summary: 'Upload clipboard',
    },
    getTaskStatus: {
      method: 'GET',
      path: '/v2/admin/media/queue/task/:taskId',
      pathParams: z.object({ taskId: z.string() }),
      responses: { 200: TaskStatus },
      summary: 'Get task status',
    },
    getFileQueueTasks: {
      method: 'GET',
      path: '/v2/admin/media/queue/file/:fileId',
      pathParams: z.object({ fileId: z.string() }),
      responses: { 200: z.array(TaskStatus) },
      summary: 'Get file queue tasks',
    },
    getQueueStats: {
      method: 'GET',
      path: '/v2/admin/media/queue/stats',
      responses: { 200: QueueStats },
      summary: 'Get queue stats',
    },
  });
