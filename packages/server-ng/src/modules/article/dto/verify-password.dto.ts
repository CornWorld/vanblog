import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { commonSchemas } from '../../../shared/zod';

/**
 * 文章密码验证请求 Schema
 *
 * 用于验证私有文章的访问密码
 */
export const VerifyArticlePasswordSchema = z.object({
  password: commonSchemas.nonEmptyString.describe('Password for private article'),
});

/**
 * 文章访问响应 Schema
 *
 * 包含验证结果、访问令牌和错误信息
 */
export const ArticleAccessResponseSchema = z.object({
  success: z.boolean().describe('Whether access is granted'),
  token: z.string().optional().describe('Access token for the article'),
  message: z.string().optional().describe('Error message if access is denied'),
  expiresAt: z.string().optional().describe('Token expiration time'),
});

/**
 * 文章密码验证 DTO
 */
export class VerifyArticlePasswordDto extends createZodDto(VerifyArticlePasswordSchema) {}

/**
 * 文章访问响应 DTO
 */
export class ArticleAccessResponseDto extends createZodDto(ArticleAccessResponseSchema) {}

/**
 * Swagger 文档类
 */
export class ArticleAccessResponse {
  success!: boolean;
  token?: string;
  message?: string;
  expiresAt?: string;
}
