import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { selectTagSchema, insertTagSchema, updateTagSchema } from '../../../database';

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
  items: z.array(TagWithCountSchema as unknown as z.ZodType),
  total: z.number(),
});

export class CreateTagDto extends createZodDto(CreateTagSchema) {}
export class UpdateTagDto extends createZodDto(UpdateTagSchema) {}
export class TagDto extends createZodDto(TagSchema) {}
export class TagWithCountDto extends createZodDto(TagWithCountSchema) {}
export class TagListResponseDto extends createZodDto(TagListResponseSchema) {}
