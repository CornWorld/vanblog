import { z } from 'zod';

import {
  selectCategorySchema,
  insertCategorySchema,
  updateCategorySchema,
} from '../../../database';

// 基础分类 Schema - 使用 drizzle-zod 生成的 schema
export const CategorySchema = selectCategorySchema;

// 创建分类 Schema - 使用 drizzle-zod 生成的 schema
export const CreateCategorySchema = insertCategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 更新分类 Schema - 使用 drizzle-zod 生成的 schema
export const UpdateCategorySchema = updateCategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// 带文章数量的分类 Schema
export const CategoryWithCountSchema = CategorySchema.extend({
  articleCount: z.number().default(0),
});

// 分类列表响应 Schema
export const CategoryListResponseSchema = z.object({
  items: z.array(CategoryWithCountSchema),
  total: z.number(),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;
export type CategoryDto = z.infer<typeof CategorySchema>;
export type CategoryWithCountDto = z.infer<typeof CategoryWithCountSchema>;
export type CategoryListResponseDto = {
  items: CategoryWithCountDto[];
  total: number;
};
