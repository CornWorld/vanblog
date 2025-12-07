import { initContract } from '@ts-rest/core';
import { z } from 'zod';

// Media DTOs - 先用 z.any()，后续精确化
export const BatchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export const ListStaticFilesSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
  keyword: z.string().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
  sortBy: z.enum(['name', 'size', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

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
  processing: z.any().optional(),
});

export const StorageConfigResponseSchema = z.object({
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

export const UpdateStorageConfigSchema = z.object({
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

export const createMediaContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    list: {
      method: 'GET',
      path: '/v2/admin/media',
      query: ListStaticFilesSchema,
      responses: { 200: z.any() },
      summary: 'List media files',
    },
    getById: {
      method: 'GET',
      path: '/v2/admin/media/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.any() },
      summary: 'Get media by ID',
    },
    deleteById: {
      method: 'DELETE',
      path: '/v2/admin/media/:id',
      pathParams: z.object({ id: z.string() }),
      responses: { 200: z.object({ success: z.boolean(), message: z.string() }) },
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
      body: z.any(),
      responses: { 201: z.any() },
      summary: 'Upload file',
    },
    uploadMultiple: {
      method: 'POST',
      path: '/v2/admin/media/upload-multiple',
      body: z.any(),
      responses: { 201: z.any() },
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
      responses: { 201: z.any() },
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
      responses: { 200: z.any() },
      summary: 'Export all media',
    },
    getStorageConfig: {
      method: 'GET',
      path: '/v2/admin/media/storage-config',
      responses: { 200: StorageConfigResponseSchema.nullable() },
      summary: 'Get storage config',
    },
    updateStorageConfig: {
      method: 'POST',
      path: '/v2/admin/media/storage-config',
      body: UpdateStorageConfigSchema,
      responses: { 200: StorageConfigResponseSchema },
      summary: 'Update storage config',
    },
    uploadClipboard: {
      method: 'POST',
      path: '/v2/admin/media/upload-clipboard',
      body: z.any(),
      responses: { 201: z.any() },
      summary: 'Upload clipboard',
    },
    getTaskStatus: {
      method: 'GET',
      path: '/v2/admin/media/queue/task/:taskId',
      pathParams: z.object({ taskId: z.string() }),
      responses: { 200: z.any() },
      summary: 'Get task status',
    },
    getFileQueueTasks: {
      method: 'GET',
      path: '/v2/admin/media/queue/file/:fileId',
      pathParams: z.object({ fileId: z.string() }),
      responses: { 200: z.array(z.any()) },
      summary: 'Get file queue tasks',
    },
    getQueueStats: {
      method: 'GET',
      path: '/v2/admin/media/queue/stats',
      responses: {
        200: z.object({
          pending: z.number(),
          processing: z.number(),
          completed: z.number(),
          failed: z.number(),
        }),
      },
      summary: 'Get queue stats',
    },
  });
