import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// 导航项类型定义
export type NavigationItem = {
  id?: number;
  name: string;
  url: string;
  icon?: string;
  target: '_self' | '_blank';
  order: number;
  children?: NavigationItem[];
};

// 导航项 Schema
export const NavigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
  z.object({
    id: z.number().optional(),
    name: z.string().min(1, '导航名称不能为空'),
    url: z.string().min(1, '导航链接不能为空'),
    icon: z.string().optional(),
    target: z.enum(['_self', '_blank']).default('_self'),
    order: z.number().default(0),
    children: z.array(NavigationItemSchema).optional(),
  }),
);

// 更新导航 Schema
export const UpdateNavigationSchema = z.object({
  items: z.array(NavigationItemSchema),
});

// 导航响应 Schema
export const NavigationResponseSchema = z.object({
  items: z.array(NavigationItemSchema),
});

export class NavigationItemDto extends createZodDto(NavigationItemSchema) {}
export class UpdateNavigationDto extends createZodDto(UpdateNavigationSchema) {}
