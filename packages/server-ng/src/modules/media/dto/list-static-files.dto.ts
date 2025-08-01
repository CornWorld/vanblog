import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

export const ListStaticFilesSchema = z.object({
  page: commonSchemas.page,
  pageSize: commonSchemas.pageSize,
  keyword: z.string().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
  sortBy: z.enum(['name', 'size', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class ListStaticFilesDto extends createZodDto(ListStaticFilesSchema) {}
