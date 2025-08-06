import { createZodDto } from 'nestjs-zod';

import { insertPipelineSchema } from '../../../database';

// 创建管道 Schema - 使用 drizzle-zod 生成的 schema
export const CreatePipelineSchema = insertPipelineSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export class CreatePipelineDto extends createZodDto(CreatePipelineSchema) {}
