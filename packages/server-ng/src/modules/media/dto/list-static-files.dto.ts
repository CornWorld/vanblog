import { c } from '@vanblog/shared';
import { z } from 'zod';

export const ListStaticFilesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), // coerce for query params
  pageSize: z.coerce.number().int().min(1).max(100).default(10), // coerce for query params
  keyword: z.string().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
  sortBy: z.enum(['name', 'size', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListStaticFilesDto = z.infer<typeof ListStaticFilesSchema>;
