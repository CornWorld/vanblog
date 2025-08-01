import { z } from 'zod';

// 常用的验证规则
export const commonSchemas = {
  id: z.number().int().positive('ID must be a positive integer').describe('Unique identifier'),

  nonEmptyString: z.string().min(1, 'String cannot be empty').describe('Non-empty string value'),

  positiveInt: z
    .number()
    .int()
    .positive('Must be a positive integer')
    .describe('Positive integer value'),

  nonNegativeInt: z
    .number()
    .int()
    .min(0, 'Must be a non-negative integer')
    .describe('Non-negative integer value'),

  // 分页相关
  page: z
    .number()
    .int()
    .min(1, 'Page must be at least 1')
    .describe('Page number for pagination')
    .default(1),

  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100, 'Page size must be between 1 and 100')
    .describe('Number of items per page')
    .default(10),

  // 格式验证
  email: z.string().pipe(z.email('Invalid email format')).describe('Email address'),

  url: z.string().pipe(z.url('Invalid URL format')).describe('URL address'),

  hexColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color format')
    .describe('Hexadecimal color code'),

  // JSON 数据解析相关
  stringArray: z.array(z.string()).describe('Array of strings'),

  jsonString: z.string().transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON string' });
      return z.NEVER;
    }
  }),
};

// 通用的 JSON 解析函数
export function safeParseJson<T>(
  jsonString: string | null | undefined,
  schema: z.ZodSchema<T>,
): T | null {
  if (!jsonString) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonString);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// 常用的数据结构 schema
export const dataSchemas = {
  // 标签数组
  tagsArray: z.array(z.string()),

  // 权限数组
  permissionsArray: z.array(z.string()),

  // 通用对象
  genericObject: z.record(z.string(), z.unknown()),
};

// 导出类型
export type CommonSchemas = typeof commonSchemas;
export type DataSchemas = typeof dataSchemas;
