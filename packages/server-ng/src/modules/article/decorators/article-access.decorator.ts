import { SetMetadata } from '@nestjs/common';

/**
 * 文章访问权限装饰器
 *
 * 用于标记需要文章访问令牌验证的端点。
 * 当控制器方法使用此装饰器时，ArticleAccessGuard 将验证请求中的访问令牌。
 *
 * @example
 * ```typescript
 * @Get(':id/content')
 * @RequireArticleAccess()
 * async getPrivateContent(@Param('id') id: number) {
 *   // 只有提供有效访问令牌的请求才能访问此端点
 * }
 * ```
 */
export const ARTICLE_ACCESS_KEY = 'article_access';

/**
 * 要求文章访问权限的装饰器
 *
 * 标记端点需要有效的文章访问令牌才能访问。
 * 通常用于获取私有文章内容的端点。
 */
export const RequireArticleAccess = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ARTICLE_ACCESS_KEY, true);
