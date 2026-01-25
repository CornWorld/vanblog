import { c } from '@vanblog/shared';
import { z } from 'zod';

export const BatchDeleteSchema = z.object({
  ids: z
    .array(c.id)
    .min(1, '至少需要选择一个文件')
    .max(100, '一次最多只能删除100个文件')
    .describe('要删除的文件 ID 列表'),
});

export type BatchDeleteDto = z.infer<typeof BatchDeleteSchema>;
