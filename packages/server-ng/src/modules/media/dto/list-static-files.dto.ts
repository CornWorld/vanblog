import { c } from '@vanblog/shared';
import { z } from 'zod';

export const ListStaticFilesSchema = z.object({
  page: c.page,
  pageSize: c.pageSize,
  keyword: z.string().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
  sortBy: z.enum(['name', 'size', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListStaticFilesDto = z.infer<typeof ListStaticFilesSchema>;
