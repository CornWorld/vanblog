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
  email: z.string().describe('Email address').pipe(z.email('Invalid email format')),

  url: z.string().describe('URL address').pipe(z.url('Invalid URL format')),

  hexColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color format')
    .describe('Hexadecimal color code'),
};

// 导出类型
export type CommonSchemas = typeof commonSchemas;
