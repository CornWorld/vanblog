import { z } from 'zod';

// 通用的 JSON 解析函数
export function safeParseJson<T>(
  jsonString: string | null | undefined,
  schema: z.ZodType<T>,
): T | null {
  if (!jsonString) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(jsonString);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// 导航项严格递归类型
export type NavigationNode = {
  name: string;
  path: string;
  icon?: string;
  external?: boolean;
  children?: NavigationNode[];
};

// 导航项递归 Schema
const NavigationNodeSchema: z.ZodType<NavigationNode> = z.lazy(() =>
  z.object({
    name: z.string().min(1, 'Navigation name cannot be empty'),
    path: z.string().min(1, 'Navigation path cannot be empty'),
    icon: z.string().optional(),
    external: z.boolean().optional(),
    children: z.array(NavigationNodeSchema).optional(),
  }),
);

// 常用的数据结构 schema
export const dataSchemas = {
  // 标签数组
  tagsArray: z.array(z.string()),

  // 权限数组
  permissionsArray: z.array(z.string()),

  // 通用对象
  genericObject: z.record(z.string(), z.unknown()),

  // 导航数组
  navigationArray: z.array(NavigationNodeSchema),
};

// 导出类型
export type DataSchemas = typeof dataSchemas;
