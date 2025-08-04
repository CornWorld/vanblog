import { createZodDto } from 'nestjs-zod';
import { updatePipelineSchema } from '../../../database';

// 更新管道 Schema - 使用 drizzle-zod 生成的 schema
export const UpdatePipelineSchema = updatePipelineSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export class UpdatePipelineDto extends createZodDto(UpdatePipelineSchema) {}
