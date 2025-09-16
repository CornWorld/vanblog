import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { MediaProcessingOverrideSchema } from './media-settings.dto';

export const UploadFileSchema = z.object({
  file: z.unknown().describe('要上传的文件'),
  filename: z.string().optional().describe('自定义文件名'),
  provider: z.string().optional().default('local').describe('存储提供商'),
  // multipart/form-data 可传 JSON 字符串或对象
  processing: z
    .union([MediaProcessingOverrideSchema, z.string()])
    .optional()
    .describe('处理配置覆盖（JSON 对象或字符串）'),
  async: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val ?? false;
    })
    .describe('是否使用异步处理队列'),
});

export class UploadFileDto extends createZodDto(UploadFileSchema) {
  file!: Express.Multer.File;
  filename?: string;
  provider!: string;
  processing?: z.infer<typeof MediaProcessingOverrideSchema> | string;
}

// Class for Swagger documentation
export class UploadFile {
  file!: Express.Multer.File;
  filename?: string;
  provider?: string;
  processing?: unknown;
}
