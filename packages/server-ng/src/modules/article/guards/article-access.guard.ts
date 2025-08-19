import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { ARTICLE_ACCESS_KEY } from '../decorators/article-access.decorator';

/**
 * 文章访问令牌载荷接口
 *
 * 定义了文章访问令牌中包含的信息结构
 */
interface ArticleAccessPayload {
  articleId: number;
  articleTitle: string;
  pathname: string;
  type: string;
  userId: number | null;
  isAnonymous: boolean;
  iat?: number;
  exp?: number;
}

/**
 * 扩展的请求接口
 *
 * 在原有 Request 接口基础上添加文章访问信息
 */
interface RequestWithArticleAccess extends Request {
  articleAccess?: {
    articleId: number;
    articleTitle: string;
    pathname: string;
    userId: number | null;
    isAnonymous: boolean;
  };
  user?: {
    id: number;
    username: string;
    type: string;
  };
}

@Injectable()
export class ArticleAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * 验证文章访问权限
   *
   * 检查请求是否包含有效的文章访问令牌。
   * 如果令牌有效，将文章信息添加到请求对象中。
   *
   * @param context 执行上下文
   * @returns 是否允许访问
   * @throws {UnauthorizedException} 当令牌无效或过期时
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithArticleAccess>();

    // 检查是否需要文章访问验证
    const requiresAccess = this.checkIfRequiresAccess(context);
    if (!requiresAccess) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Article access token required');
    }

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET ?? 'default-secret',
      ) as ArticleAccessPayload;

      // 验证令牌类型
      if (payload.type !== 'article-access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // 验证用户绑定（如果令牌绑定了用户）
      if (!payload.isAnonymous && payload.userId) {
        // 如果令牌绑定了用户，验证当前请求的用户是否匹配
        const currentUser = request.user;
        if (!currentUser || currentUser.id !== payload.userId) {
          throw new UnauthorizedException('Token is bound to a different user');
        }
      }

      // 将文章信息添加到请求对象中
      request.articleAccess = {
        articleId: payload.articleId,
        articleTitle: payload.articleTitle,
        pathname: payload.pathname,
        userId: payload.userId,
        isAnonymous: payload.isAnonymous,
      };

      return true;
    } catch (_error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * 检查当前端点是否需要文章访问验证
   *
   * @param context 执行上下文
   * @returns 是否需要验证
   */
  private checkIfRequiresAccess(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(ARTICLE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  /**
   * 从请求头中提取访问令牌
   *
   * @param request HTTP 请求对象
   * @returns 提取的令牌或 undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
