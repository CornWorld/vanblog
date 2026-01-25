import { z } from 'zod';

import { MediaProcessingOverrideSchema } from './media-settings.dto';

export const InitiateChunkUploadSchema = z.object({
  filename: z.string().min(1),
  totalSize: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
  totalChunks: z.number().int().positive(),
  mimeType: z.string().optional(),
  provider: z.string().optional(),
  uploadId: z.string().optional(),
});
export type InitiateChunkUploadDto = z.infer<typeof InitiateChunkUploadSchema>;

export const UploadChunkSchema = z.object({
  uploadId: z.string().min(1),
  index: z.number().int().nonnegative(),
});
export type UploadChunkDto = z.infer<typeof UploadChunkSchema>;

export const CompleteChunkUploadSchema = z.object({
  uploadId: z.string().min(1),
  filename: z.string().optional(),
  provider: z.string().optional(),
  processing: z.union([MediaProcessingOverrideSchema, z.string()]).optional(),
});
export type CompleteChunkUploadDto = z.infer<typeof CompleteChunkUploadSchema>;
