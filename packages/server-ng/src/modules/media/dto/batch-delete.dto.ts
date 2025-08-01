import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

export const BatchDeleteSchema = z.object({
  ids: z.array(commonSchemas.id).min(1, '至少需要选择一个文件').describe('要删除的文件 ID 列表'),
});

export class BatchDeleteDto extends createZodDto(BatchDeleteSchema) {}
