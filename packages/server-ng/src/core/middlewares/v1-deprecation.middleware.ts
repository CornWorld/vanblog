import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';

import { LoggerService } from '../logger/logger.service';

import type { Request, Response, NextFunction } from 'express';

/**
 * V1 API 废弃警告中间件
 *
 * 检测访问 v1 API 的请求并返回废弃警告，阻止访问并提供迁移建议。
 */
@Injectable()
export class V1DeprecationMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const url = req.originalUrl;

    // 检测是否访问 v1 API 路径
    // 匹配形如 /api/v1/* 的路径
    if (this.isV1ApiPath(url)) {
      this.logger.warn(
        `Deprecated V1 API access attempt: ${req.method} ${url} from ${req.ip ?? 'unknown'}`,
        'V1DeprecationMiddleware',
      );

      // 返回 410 Gone 状态码，表示资源已永久移除
      throw new HttpException(
        {
          statusCode: HttpStatus.GONE,
          error: 'Gone',
          message: 'V1 API has been permanently removed',
          details: {
            deprecatedEndpoint: url,
            removalDate: '2024-01-20',
            migrationGuide: this.getMigrationSuggestion(url),
            documentation: '/api/docs',
          },
        },
        HttpStatus.GONE,
      );
    }

    next();
  }

  /**
   * 检测 URL 是否为 v1 API 路径
   */
  private isV1ApiPath(url: string): boolean {
    // 匹配 /api/v1/ 开头的路径
    // 使用 startsWith 以满足 lint 规则
    return url.startsWith('/api/v1/');
  }

  /**
   * 根据访问的 v1 路径提供对应的 v2 迁移建议
   */
  private getMigrationSuggestion(v1Path: string): string {
    // 提取路径的核心部分（去除查询参数）
    const [pathOnly] = v1Path.split('?');
    const pathSegments = pathOnly.replace('/api/v1/', '').split('/');
    const [controller, action] = pathSegments as [string, string];

    // 根据不同的控制器和操作提供迁移建议
    switch (controller) {
      case 'public':
        return this.getPublicEndpointMigration(action, pathSegments);
      case 'auth':
        return this.getAuthEndpointMigration(action);
      default:
        return 'Please refer to /api/docs for the complete V2 API documentation';
    }
  }

  /**
   * 获取 public 端点的迁移建议
   */
  private getPublicEndpointMigration(action: string, pathSegments: string[]): string {
    const migrationMap: Partial<Record<string, string>> = {
      getByOption: 'Use separate endpoints: GET /api/v2/articles, /api/v2/categories, /api/v2/tags',
      searchArticle: 'Use: GET /api/v2/articles/search?keyword={keyword}&page={page}&limit={limit}',
      getArticleByIdOrPathname:
        'Use: GET /api/v2/articles/{id} or implement pathname support in V2',
      getArticleWithPassword: 'Use: POST /api/v2/articles/{id}/verify-password',
      getArticlesByTagName:
        'Use: GET /api/v2/tags to find tag ID, then GET /api/v2/tags/{id}/articles',
      getArticlesByCategory:
        'Use: GET /api/v2/categories to find category ID, then GET /api/v2/categories/{id}/articles',
      getArticlesByTag: 'Use: GET /api/v2/tags/{id}/articles',
      addViewer: 'Use: POST /api/v2/article/{id}/view or POST /api/v2/analytics/record',
      getViewer: 'Use: GET /api/v2/admin/analytics/overview (requires authentication)',
      getViewerByArticleIdOrPathname:
        'Use: GET /api/v2/admin/analytics/article/{id} (requires authentication)',
      getAllCustomPages: 'Use: GET /api/v2/public/customPage/all',
      getCustomPageByPath: 'Use: GET /api/v2/public/customPage?path={pathname}',
      getTimeLineInfo: 'Use: GET /api/v2/public/timeline',
      getMeta: 'Use: GET /api/v2/public/bootstrap',
      getBuildMeta: 'Use: GET /api/v2/public/bootstrap',
    };

    const suggestion = migrationMap[action];
    if (suggestion !== undefined) {
      return suggestion;
    }

    // 对于包含参数的路径，尝试匹配基础操作
    if (pathSegments.length > 2) {
      const [, baseAction] = pathSegments;
      const baseSuggestion = migrationMap[baseAction];
      if (baseSuggestion !== undefined) {
        return baseSuggestion;
      }
    }

    return 'This public endpoint may have an equivalent in V2. Check /api/docs for available endpoints';
  }

  /**
   * 获取 auth 端点的迁移建议
   */
  private getAuthEndpointMigration(action: string): string {
    const migrationMap: Partial<Record<string, string>> = {
      login: 'Use: POST /api/v2/auth/login',
      logout: 'Use: POST /api/v2/auth/logout',
      profile: 'Use: GET /api/v2/auth/profile',
      logs: 'Login logs are available through the admin analytics endpoints',
    };

    return migrationMap[action] ?? 'Check /api/docs for V2 authentication endpoints';
  }
}
