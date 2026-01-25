import { selectTagSchema, insertTagSchema, updateTagSchema } from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 基础标签 Schema - 使用 drizzle-zod 生成的 schema
export const TagSchema = selectTagSchema;

// 创建标签 Schema - 使用 drizzle-zod 生成的 schema
export const CreateTagSchema = insertTagSchema.omit({
  id: true,
  createdAt: true,
});

// 更新标签 Schema - 使用 drizzle-zod 生成的 schema
export const UpdateTagSchema = updateTagSchema.omit({
  id: true,
  createdAt: true,
});

// 带文章数量的标签 Schema
export const TagWithCountSchema = TagSchema.extend({
  articleCount: z.number().default(0),
});

// 标签列表响应 Schema
export const TagListResponseSchema = z.object({
  items: z.array(TagWithCountSchema),
  total: z.number(),
});

export type CreateTagDto = z.infer<typeof CreateTagSchema>;
export type UpdateTagDto = z.infer<typeof UpdateTagSchema>;
export type TagDto = z.infer<typeof TagSchema>;
export type TagWithCountDto = z.infer<typeof TagWithCountSchema>;
export type TagListResponseDto = z.infer<typeof TagListResponseSchema>;
