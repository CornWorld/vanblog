import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Timeline 文章对象
export const TimelineArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  pathname: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  author: z.string().nullable(),
  top: z.number().nullable(),
  hidden: z.boolean(),
  private: z.boolean(),
  viewer: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Timeline 响应结构：{"2024": [...], "2023": [...]}
export const TimelineResponseSchema = z.record(z.string(), z.array(TimelineArticleSchema));

// Timeline 查询参数（仅供未来扩展）
export const TimelineQuerySchema = z.object({
  includeHidden: z.boolean().optional(),
});

export class TimelineQueryDto extends createZodDto(TimelineQuerySchema) {}
export class TimelineResponseDto extends createZodDto(TimelineResponseSchema) {}
