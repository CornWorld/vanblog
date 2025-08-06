import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UploadFileSchema = z.object({
  file: z.any().describe('要上传的文件'),
  filename: z.string().optional().describe('自定义文件名'),
  provider: z.string().optional().default('local').describe('存储提供商'),
});

export class UploadFileDto extends createZodDto(UploadFileSchema) {
  file!: Express.Multer.File;
}

// Class for Swagger documentation
export class UploadFile {
  file!: Express.Multer.File;
  filename?: string;
  provider?: string;
}
