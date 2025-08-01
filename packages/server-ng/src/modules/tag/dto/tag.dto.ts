import { z } from 'zod';
import { commonSchemas } from '../../../shared/zod';

// 基础标签 Schema
export const TagSchema = z.object({
  id: commonSchemas.id,
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 创建标签 Schema
export const CreateTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空'),
  description: z.string().optional(),
  color: z.string().optional(),
});

// 更新标签 Schema
export const UpdateTagSchema = CreateTagSchema.partial();

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
