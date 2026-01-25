/**
 * @file plugin-http-registry.service.ts
 *
 * 插件 HTTP 路由注册表服务
 *
 * 管理插件注册的所有 HTTP 路由（ts-rest contracts + raw HTTP handlers）
 *
 * **设计理念**：
 * 1. 插件通过 `api.http.contract()` 或 `api.http.get/post()` 注册路由
 * 2. 路由信息存储在全局注册表中
 * 3. PluginHttpController 在运行时动态处理请求
 * 4. 路由自动加前缀：`/api/v2/plugins/{pluginId}/`
 *
 * **路由类型**：
 * - **Contract Routes**: ts-rest 契约路由（推荐，类型安全）
 * - **Raw Routes**: 原始 HTTP 路由（不推荐，但支持）
 */

import { Injectable, Logger } from '@nestjs/common';

import type { AppRouter } from '@ts-rest/core';
import type { RequestHandler } from '@vanblog/shared/plugin';

// ============================================================
// 类型定义
// ============================================================

/**
 * HTTP 方法
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * ts-rest 契约路由
 */
export interface ContractRoute {
  type: 'contract';
  pluginId: string;
  contract: AppRouter;
  handlers: Record<string, any>;
}

/**
 * 原始 HTTP 路由
 */
export interface RawRoute {
  type: 'raw';
  pluginId: string;
  method: HttpMethod;
  path: string;
  handler: RequestHandler;
}

/**
 * 路由注册项
 */
export type RouteEntry = ContractRoute | RawRoute;

// ============================================================
// 插件 HTTP 路由注册表服务
// ============================================================

@Injectable()
export class PluginHttpRegistryService {
  private readonly logger = new Logger(PluginHttpRegistryService.name);

  /**
   * 所有插件的路由注册表
   *
   * Key: pluginId
   * Value: 该插件的所有路由
   */
  private readonly routeRegistry = new Map<string, RouteEntry[]>();

  // ========== 契约路由注册 ==========

  /**
   * 注册 ts-rest 契约路由
   *
   * @param pluginId - 插件 ID
   * @param contract - ts-rest 契约定义
   * @param handlers - 契约处理器
   */
  registerContract(pluginId: string, contract: AppRouter, handlers: Record<string, any>): void {
    this.logger.log(`[${pluginId}] 注册 ts-rest 契约路由`);

    const routes = this.routeRegistry.get(pluginId) || [];
    routes.push({
      type: 'contract',
      pluginId,
      contract,
      handlers,
    });

    this.routeRegistry.set(pluginId, routes);
  }

  // ========== 原始路由注册 ==========

  /**
   * 注册原始 HTTP 路由
   *
   * @param pluginId - 插件 ID
   * @param method - HTTP 方法
   * @param path - 路由路径
   * @param handler - 请求处理器
   */
  registerRawRoute(
    pluginId: string,
    method: HttpMethod,
    path: string,
    handler: RequestHandler,
  ): void {
    this.logger.log(`[${pluginId}] 注册原始路由: ${method} ${path}`);

    const routes = this.routeRegistry.get(pluginId) || [];
    routes.push({
      type: 'raw',
      pluginId,
      method,
      path,
      handler,
    });

    this.routeRegistry.set(pluginId, routes);
  }

  // ========== 路由查询 ==========

  /**
   * 获取插件的所有路由
   *
   * @param pluginId - 插件 ID
   * @returns 路由列表
   */
  getPluginRoutes(pluginId: string): RouteEntry[] {
    return this.routeRegistry.get(pluginId) || [];
  }

  /**
   * 获取所有已注册的插件 ID
   */
  getAllPluginIds(): string[] {
    return Array.from(this.routeRegistry.keys());
  }

  /**
   * 获取所有路由（调试用）
   */
  getAllRoutes(): Map<string, RouteEntry[]> {
    return this.routeRegistry;
  }

  /**
   * 查找匹配的原始路由
   *
   * @param pluginId - 插件 ID
   * @param method - HTTP 方法
   * @param path - 路由路径
   * @returns 匹配的路由（未找到返回 null）
   */
  findRawRoute(pluginId: string, method: HttpMethod, path: string): RawRoute | null {
    const routes = this.routeRegistry.get(pluginId) || [];

    for (const route of routes) {
      if (route.type === 'raw' && route.method === method && route.path === path) {
        return route;
      }
    }

    return null;
  }

  /**
   * 查找匹配的契约路由
   *
   * @param pluginId - 插件 ID
   * @returns 所有契约路由
   */
  findContractRoutes(pluginId: string): ContractRoute[] {
    const routes = this.routeRegistry.get(pluginId) || [];
    return routes.filter((route): route is ContractRoute => route.type === 'contract');
  }

  // ========== 清理 ==========

  /**
   * 清除插件的所有路由
   *
   * @param pluginId - 插件 ID
   */
  clearPluginRoutes(pluginId: string): void {
    this.logger.log(`[${pluginId}] 清除所有路由`);
    this.routeRegistry.delete(pluginId);
  }

  /**
   * 清除所有路由（测试用）
   */
  clearAllRoutes(): void {
    this.logger.warn('清除所有插件路由');
    this.routeRegistry.clear();
  }
}
