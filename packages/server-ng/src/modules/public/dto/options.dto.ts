import { z } from 'zod';

import { dataSchemas } from '@vanblog/shared/drizzle';
import { ArticleListResponseSchema } from '../../article/dto/article.dto';
import { CategorySchema } from '../../category/dto/category.dto';
import { TagSchema } from '../../tag/dto/tag.dto';

// 可选的字段类型，对应 include 查询参数支持的值
const INCLUDE_OPTIONS = [
  'articles',
  'categories',
  'tags',
  'siteMeta', // Bootstrap 接口中已有的 siteInfo 字段
  'navigation',
  'friendLinks',
  'walineConfig',
] as const;

// include 查询参数的 Schema
export const OptionsQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [] as string[];
      return val
        .split(',')
        .map((s) => s.trim())
        .filter((item) => INCLUDE_OPTIONS.includes(item as (typeof INCLUDE_OPTIONS)[number]));
    })
    .refine((val) => val.length <= 10, { message: 'include 参数不能超过 10 个字段' }),
});

// Options 响应的 Schema - 所有字段都是可选的，按需返回
export const OptionsResponseSchema = z.object({
  articles: ArticleListResponseSchema.optional(),
  categories: z
    .array(
      CategorySchema.pick({ name: true, slug: true, description: true }) as unknown as z.ZodType,
    )
    .optional(),
  tags: z.array(TagSchema.pick({ name: true, slug: true }) as unknown as z.ZodType).optional(),
  siteMeta: z
    .object({
      title: z.string(),
      description: z.string(),
      author: z.string(),
      keywords: z.array(z.string()),
    })
    .optional(),
  navigation: dataSchemas.navigationArray.optional(),
  friendLinks: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        description: z.string().optional(),
        avatar: z.string().optional(),
      }),
    )
    .optional(),
  walineConfig: z
    .object({
      serverURL: z.string().optional(),
    })
    .optional(),
});

export type OptionsQueryDto = z.infer<typeof OptionsQuerySchema>;
export type OptionsResponseDto = z.infer<typeof OptionsResponseSchema>;

// 导出字段选项供类型检查使用
export { INCLUDE_OPTIONS };
export type IncludeOption = (typeof INCLUDE_OPTIONS)[number];
