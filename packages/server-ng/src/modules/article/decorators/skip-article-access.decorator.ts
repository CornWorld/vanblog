import { SetMetadata } from '@nestjs/common';

/**
 * 跳过文章访问权限验证装饰器
 *
 * 用于标记不需要文章访问令牌验证的端点。
 * 当控制器方法使用此装饰器时，ArticleAccessGuard 将跳过验证。
 *
 * @example
 * ```typescript
 * @Get('grouped-by-category')
 * @SkipArticleAccess()
 * async getGroupedByCategory() {
 *   // 此端点不需要文章访问令牌验证
 * }
 * ```
 */
export const SKIP_ARTICLE_ACCESS_KEY = 'skip_article_access';

/**
 * 跳过文章访问权限验证的装饰器
 *
 * 标记端点不需要文章访问令牌验证。
 * 通常用于公共API端点，如分组查询等。
 */
export const SkipArticleAccess = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(SKIP_ARTICLE_ACCESS_KEY, true);
