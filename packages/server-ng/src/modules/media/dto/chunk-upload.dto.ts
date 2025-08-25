import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const InitiateChunkUploadSchema = z.object({
  filename: z.string().min(1),
  totalSize: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
  totalChunks: z.number().int().positive(),
  mimeType: z.string().optional(),
  provider: z.string().optional(),
  uploadId: z.string().optional(),
});
export class InitiateChunkUploadDto extends createZodDto(InitiateChunkUploadSchema) {}

export const UploadChunkSchema = z.object({
  uploadId: z.string().min(1),
  index: z.number().int().nonnegative(),
});
export class UploadChunkDto extends createZodDto(UploadChunkSchema) {}

export const CompleteChunkUploadSchema = z.object({
  uploadId: z.string().min(1),
  filename: z.string().optional(),
  provider: z.string().optional(),
});
export class CompleteChunkUploadDto extends createZodDto(CompleteChunkUploadSchema) {}
