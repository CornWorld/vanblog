/**
 * @file ts-rest-router.util.ts
 *
 * ts-rest 契约路由匹配与执行工具
 *
 * 功能：
 * - 解析 ts-rest 契约定义
 * - 匹配请求路径与契约路由
 * - 提取路径参数、查询参数、请求体
 * - 执行处理器并返回响应
 */

import { Logger } from '@nestjs/common';

import type { AppRoute, AppRouter } from '@ts-rest/core';

// ============================================================
// 类型定义
// ============================================================

/**
 * 路径参数提取结果
 */
export interface PathParams {
  [key: string]: string;
}

/**
 * 路由匹配结果
 */
export interface RouteMatch {
  routeKey: string;
  route: AppRoute;
  params: PathParams;
}

/**
 * 请求数据
 */
export interface RequestData {
  params: PathParams;
  query: Record<string, any>;
  body: any;
  headers: Record<string, string>;
}

// ============================================================
// 路径匹配工具
// ============================================================

/**
 * 将 ts-rest 路径模式转换为正则表达式
 *
 * 例如：
 * - `/books` → `/books`
 * - `/books/:id` → `/books/([^/]+)`
 * - `/books/:id/reviews/:reviewId` → `/books/([^/]+)/reviews/([^/]+)`
 *
 * @param pattern - ts-rest 路径模式
 * @returns 正则表达式和参数名列表
 */
export function pathToRegex(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  // 提取参数名
  const regexPattern = pattern.replace(/:([^/]+)/g, (_, paramName) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  const regex = new RegExp(`^${regexPattern}$`);

  return { regex, paramNames };
}

/**
 * 匹配路径并提取参数
 *
 * @param path - 实际请求路径
 * @param pattern - ts-rest 路径模式
 * @returns 匹配结果（包含参数）或 null
 */
export function matchPath(path: string, pattern: string): PathParams | null {
  const { regex, paramNames } = pathToRegex(pattern);
  const match = path.match(regex);

  if (!match) {
    return null;
  }

  const params: PathParams = {};

  // 提取参数值（match[0] 是完整匹配，从 match[1] 开始是捕获组）
  for (let i = 0; i < paramNames.length; i++) {
    params[paramNames[i]] = match[i + 1];
  }

  return params;
}

// ============================================================
// 契约路由解析
// ============================================================

/**
 * 从契约中提取所有路由定义
 *
 * @param contract - ts-rest 契约
 * @returns 路由定义数组
 */
export function extractRoutes(contract: AppRouter): Array<{ key: string; route: AppRoute }> {
  const routes: Array<{ key: string; route: AppRoute }> = [];

  function traverse(obj: any, prefix: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        // 检查是否是路由定义（有 method 和 path）
        if ('method' in value && 'path' in value) {
          routes.push({
            key: prefix + key,
            route: value as AppRoute,
          });
        } else {
          // 递归遍历嵌套对象
          traverse(value, `${prefix}${key}.`);
        }
      }
    }
  }

  traverse(contract);

  return routes;
}

/**
 * 匹配请求到契约路由
 *
 * @param contract - ts-rest 契约
 * @param method - HTTP 方法
 * @param path - 请求路径
 * @returns 匹配结果或 null
 */
export function matchContractRoute(
  contract: AppRouter,
  method: string,
  path: string,
): RouteMatch | null {
  const routes = extractRoutes(contract);

  for (const { key, route } of routes) {
    // 检查 HTTP 方法
    if (route.method.toUpperCase() !== method.toUpperCase()) {
      continue;
    }

    // 匹配路径
    const params = matchPath(path, route.path);

    if (params !== null) {
      return {
        routeKey: key,
        route,
        params,
      };
    }
  }

  return null;
}

// ============================================================
// 处理器执行
// ============================================================

/**
 * 执行契约处理器
 *
 * @param handler - 处理器函数
 * @param requestData - 请求数据
 * @returns 处理器响应
 */
export async function executeContractHandler(
  handler: (request: any) => Promise<any>,
  requestData: RequestData,
): Promise<{ status: number; body: any; headers?: Record<string, string> }> {
  try {
    const response = await handler({
      params: requestData.params,
      query: requestData.query,
      body: requestData.body,
      headers: requestData.headers,
    });

    return response;
  } catch (error) {
    // 处理器执行失败，返回 500 错误
    return {
      status: 500,
      body: {
        message: 'Internal Server Error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// ============================================================
// ts-rest 路由器类
// ============================================================

/**
 * ts-rest 路由器
 *
 * 管理契约路由的匹配和执行
 */
export class TsRestRouter {
  private readonly logger = new Logger(TsRestRouter.name);

  constructor(
    private readonly pluginId: string,
    private readonly contract: AppRouter,
    private readonly handlers: Record<string, any>,
  ) {}

  /**
   * 处理请求
   *
   * @param method - HTTP 方法
   * @param path - 请求路径
   * @param requestData - 请求数据
   * @returns 响应或 null（未匹配）
   */
  async handleRequest(
    method: string,
    path: string,
    requestData: RequestData,
  ): Promise<{ status: number; body: any; headers?: Record<string, string> } | null> {
    // 1. 匹配路由
    const match = matchContractRoute(this.contract, method, path);

    if (!match) {
      this.logger.debug(`[${this.pluginId}] No contract route matched: ${method} ${path}`);
      return null;
    }

    this.logger.debug(
      `[${this.pluginId}] Matched contract route: ${match.routeKey} (${method} ${path})`,
    );

    // 2. 获取处理器
    const handler = this.getHandler(match.routeKey);

    if (!handler) {
      this.logger.error(`[${this.pluginId}] Handler not found for route: ${match.routeKey}`);
      return {
        status: 500,
        body: {
          message: 'Internal Server Error',
          error: `Handler not found for route: ${match.routeKey}`,
        },
      };
    }

    // 3. 合并路径参数
    const fullRequestData: RequestData = {
      ...requestData,
      params: { ...requestData.params, ...match.params },
    };

    // 4. 执行处理器
    try {
      const response = await executeContractHandler(handler, fullRequestData);

      this.logger.debug(
        `[${this.pluginId}] Handler executed successfully: ${match.routeKey} → ${response.status}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`[${this.pluginId}] Handler execution failed: ${match.routeKey}`, error);

      return {
        status: 500,
        body: {
          message: 'Internal Server Error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * 获取处理器
   *
   * 支持嵌套路径（如 "user.getProfile"）
   *
   * @param routeKey - 路由键
   * @returns 处理器函数或 undefined
   */
  private getHandler(routeKey: string): ((request: any) => Promise<any>) | undefined {
    const parts = routeKey.split('.');
    let current = this.handlers;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return typeof current === 'function' ? (current as any) : undefined;
  }

  /**
   * 列出所有路由
   */
  listRoutes(): Array<{ key: string; method: string; path: string }> {
    const routes = extractRoutes(this.contract);

    return routes.map(({ key, route }) => ({
      key,
      method: route.method,
      path: route.path,
    }));
  }
}
