import { describe, it, expect } from 'vitest';
import {
  InitiateChunkUploadSchema,
  UploadChunkSchema,
  CompleteChunkUploadSchema,
} from './chunk-upload.dto';

describe('ChunkUploadDto', () => {
  describe('InitiateChunkUploadSchema validation', () => {
    it('should accept valid chunk upload initiation data', () => {
      const validData = {
        filename: 'large-file.mp4',
        totalSize: 104857600, // 100MB
        chunkSize: 5242880, // 5MB
        totalChunks: 20,
      };

      const result = InitiateChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toBe('large-file.mp4');
        expect(result.data.totalSize).toBe(104857600);
        expect(result.data.chunkSize).toBe(5242880);
        expect(result.data.totalChunks).toBe(20);
      }
    });

    it('should accept optional mimeType', () => {
      const validData = {
        filename: 'video.mp4',
        totalSize: 1000000,
        chunkSize: 100000,
        totalChunks: 10,
        mimeType: 'video/mp4',
      };

      const result = InitiateChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mimeType).toBe('video/mp4');
      }
    });

    it('should accept optional provider', () => {
      const validData = {
        filename: 'image.jpg',
        totalSize: 500000,
        chunkSize: 50000,
        totalChunks: 10,
        provider: 'aws-s3',
      };

      const result = InitiateChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('aws-s3');
      }
    });

    it('should accept optional uploadId', () => {
      const validData = {
        filename: 'document.pdf',
        totalSize: 2000000,
        chunkSize: 200000,
        totalChunks: 10,
        uploadId: 'existing-upload-123',
      };

      const result = InitiateChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.uploadId).toBe('existing-upload-123');
      }
    });

    it('should reject empty filename', () => {
      const invalidData = {
        filename: '',
        totalSize: 1000000,
        chunkSize: 100000,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject zero totalSize', () => {
      const invalidData = {
        filename: 'file.txt',
        totalSize: 0,
        chunkSize: 100000,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative totalSize', () => {
      const invalidData = {
        filename: 'file.txt',
        totalSize: -1000,
        chunkSize: 100000,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject zero chunkSize', () => {
      const invalidData = {
        filename: 'file.txt',
        totalSize: 1000000,
        chunkSize: 0,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject zero totalChunks', () => {
      const invalidData = {
        filename: 'file.txt',
        totalSize: 1000000,
        chunkSize: 100000,
        totalChunks: 0,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer totalSize', () => {
      const invalidData = {
        filename: 'file.txt',
        totalSize: 1000000.5,
        chunkSize: 100000,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer chunkSize', () => {
      const invalidData = {
        filename: 'file.txt',
        totalSize: 1000000,
        chunkSize: 100000.5,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer totalChunks', () => {
      const invalidData = {
        filename: 'file.txt',
        totalSize: 1000000,
        chunkSize: 100000,
        totalChunks: 10.5,
      };

      const result = InitiateChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept unicode in filename', () => {
      const validData = {
        filename: '文件名.mp4',
        totalSize: 1000000,
        chunkSize: 100000,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept filename with spaces', () => {
      const validData = {
        filename: 'my video file.mp4',
        totalSize: 1000000,
        chunkSize: 100000,
        totalChunks: 10,
      };

      const result = InitiateChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept very large file sizes', () => {
      const validData = {
        filename: 'huge-file.dat',
        totalSize: 10737418240, // 10GB
        chunkSize: 10485760, // 10MB
        totalChunks: 1024,
      };

      const result = InitiateChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('UploadChunkSchema validation', () => {
    it('should accept valid chunk upload data', () => {
      const validData = {
        uploadId: 'upload-123',
        index: 5,
      };

      const result = UploadChunkSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.uploadId).toBe('upload-123');
        expect(result.data.index).toBe(5);
      }
    });

    it('should accept index 0', () => {
      const validData = {
        uploadId: 'upload-456',
        index: 0,
      };

      const result = UploadChunkSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.index).toBe(0);
      }
    });

    it('should accept large index', () => {
      const validData = {
        uploadId: 'upload-789',
        index: 9999,
      };

      const result = UploadChunkSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.index).toBe(9999);
      }
    });

    it('should reject empty uploadId', () => {
      const invalidData = {
        uploadId: '',
        index: 0,
      };

      const result = UploadChunkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative index', () => {
      const invalidData = {
        uploadId: 'upload-123',
        index: -1,
      };

      const result = UploadChunkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer index', () => {
      const invalidData = {
        uploadId: 'upload-123',
        index: 5.5,
      };

      const result = UploadChunkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing uploadId', () => {
      const invalidData = {
        index: 0,
      };

      const result = UploadChunkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing index', () => {
      const invalidData = {
        uploadId: 'upload-123',
      };

      const result = UploadChunkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('CompleteChunkUploadSchema validation', () => {
    it('should accept valid completion data', () => {
      const validData = {
        uploadId: 'upload-123',
      };

      const result = CompleteChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.uploadId).toBe('upload-123');
      }
    });

    it('should accept optional filename', () => {
      const validData = {
        uploadId: 'upload-456',
        filename: 'final-name.mp4',
      };

      const result = CompleteChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toBe('final-name.mp4');
      }
    });

    it('should accept optional provider', () => {
      const validData = {
        uploadId: 'upload-789',
        provider: 'local',
      };

      const result = CompleteChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toBe('local');
      }
    });

    it('should accept optional processing as object', () => {
      const validData = {
        uploadId: 'upload-abc',
        processing: {
          compress: {
            enabled: true,
            quality: 80,
          },
        },
      };

      const result = CompleteChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept optional processing as string', () => {
      const validData = {
        uploadId: 'upload-def',
        processing: 'default',
      };

      const result = CompleteChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.processing).toBe('default');
      }
    });

    it('should accept all optional fields', () => {
      const validData = {
        uploadId: 'upload-ghi',
        filename: 'completed-file.mov',
        provider: 's3',
        processing: 'compress',
      };

      const result = CompleteChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty uploadId', () => {
      const invalidData = {
        uploadId: '',
      };

      const result = CompleteChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing uploadId', () => {
      const invalidData = {
        filename: 'file.mp4',
      };

      const result = CompleteChunkUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should handle undefined optional fields', () => {
      const validData = {
        uploadId: 'upload-123',
        filename: undefined,
        provider: undefined,
        processing: undefined,
      };

      const result = CompleteChunkUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
