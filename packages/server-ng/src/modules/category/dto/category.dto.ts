import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

// 基础分类 Schema
export const CategorySchema = z.object({
  id: commonSchemas.id,
  name: z.string(),
  description: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 创建分类 Schema
export const CreateCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空'),
  description: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
});

// 更新分类 Schema
export const UpdateCategorySchema = CreateCategorySchema.partial();

// 带文章数量的分类 Schema
export const CategoryWithCountSchema = CategorySchema.extend({
  articleCount: z.number().default(0),
});

// 分类列表响应 Schema
export const CategoryListResponseSchema = z.object({
  items: z.array(CategoryWithCountSchema),
  total: z.number(),
});

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
export class CategoryDto extends createZodDto(CategorySchema) {}
export class CategoryWithCountDto extends createZodDto(CategoryWithCountSchema) {}
export class CategoryListResponseDto extends createZodDto(CategoryListResponseSchema) {}
