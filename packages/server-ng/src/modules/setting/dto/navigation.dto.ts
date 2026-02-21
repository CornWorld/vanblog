import { z } from 'zod';

export interface NavItemType {
  id?: number;
  name: string;
  path: string;
  icon?: string;
  external?: boolean;
  children?: NavItemType[];
}

export const NavigationItemSchema: z.ZodType<NavItemType> = z.lazy(() =>
  z.object({
    id: z.number().optional(),
    name: z.string().min(1, '导航名称不能为空'),
    path: z.string().min(1, '导航链接不能为空'),
    icon: z.string().optional(),
    external: z.boolean().optional(),
    children: z.array(NavigationItemSchema).optional(),
  }),
);

export type NavigationItem = NavItemType;

// 更新导航 Schema
export const UpdateNavigationSchema = z.object({
  items: z.array(NavigationItemSchema),
});

// 导航响应 Schema
export const NavigationResponseSchema = z.object({
  items: z.array(NavigationItemSchema),
});

export type NavigationItemDto = z.infer<typeof NavigationItemSchema>;
export type UpdateNavigationDto = z.infer<typeof UpdateNavigationSchema>;
