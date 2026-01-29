/**
 * @file plugin-http.controller.ts
 *
 * 插件 HTTP 动态路由控制器
 *
 * 处理所有插件注册的 HTTP 路由：
 * - 路由前缀：`/api/v2/plugins/{pluginId}/*`
 * - 支持 ts-rest 契约路由
 * - 支持原始 HTTP 路由
 *
 * **工作流程**：
 * 1. 接收请求：`/api/v2/plugins/my-plugin/books`
 * 2. 从注册表查找 `my-plugin` 的路由
 * 3. 匹配路径和方法
 * 4. 执行对应的处理器
 * 5. 返回响应
 */

import {
  All,
  Controller,
  Param,
  Req,
  Res,
  Logger,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  PluginHttpRegistryService,
  type HttpMethod,
} from '../services/plugin-http-registry.service';
import { TsRestRouter, type RequestData } from '../utils/ts-rest-router.util';

import type { Request, Response } from 'express';

@Controller('api/v2/plugins')
export class PluginHttpController {
  private readonly logger = new Logger(PluginHttpController.name);

  constructor(private readonly httpRegistry: PluginHttpRegistryService) {}

  /**
   * 处理所有插件 HTTP 请求
   *
   * 路由模式：`/api/v2/plugins/:pluginId/*`
   *
   * @param pluginId - 插件 ID
   * @param req - Express Request
   * @param res - Express Response
   */
  @All(':pluginId/*')
  @UseGuards(JwtAuthGuard)
  async handlePluginRoute(
    @Param('pluginId') pluginId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // 提取插件路径（去除 `/api/v2/plugins/{pluginId}` 前缀）
      const fullPath = req.path; // 例如：/api/v2/plugins/my-plugin/books
      const pluginPath = fullPath.replace(`/api/v2/plugins/${pluginId}`, ''); // 提取：/books

      const method = req.method.toUpperCase() as HttpMethod;

      this.logger.debug(`[${pluginId}] ${method} ${pluginPath}`);

      // ========== 1. 查找契约路由 ==========

      const contractRoutes = this.httpRegistry.findContractRoutes(pluginId);

      for (const contractRoute of contractRoutes) {
        try {
          // 创建 ts-rest 路由器
          const router = new TsRestRouter(pluginId, contractRoute.contract, contractRoute.handlers);

          // 准备请求数据
          const requestData: RequestData = {
            params: req.params,
            query: req.query as Record<string, any>,
            body: req.body,
            headers: req.headers as Record<string, string>,
          };

          // 尝试匹配和处理
          const response = await router.handleRequest(method, pluginPath, requestData);

          if (response) {
            // 找到匹配的契约路由
            this.logger.debug(
              `[${pluginId}] Contract route handled: ${method} ${pluginPath} → ${response.status}`,
            );

            // 设置响应头
            if (response.headers) {
              for (const [key, value] of Object.entries(response.headers)) {
                res.setHeader(key, value);
              }
            }

            // 发送响应
            res.status(response.status).json(response.body);
            return;
          }
        } catch (error) {
          this.logger.error(`[${pluginId}] 契约路由处理失败`, error);
        }
      }

      // ========== 2. 查找原始路由 ==========

      const rawRoute = this.httpRegistry.findRawRoute(pluginId, method, pluginPath);

      if (rawRoute) {
        this.logger.debug(`[${pluginId}] 找到匹配的原始路由: ${method} ${pluginPath}`);

        try {
          // 执行原始处理器
          await rawRoute.handler(req, res);

          // 如果处理器没有发送响应，发送默认响应
          if (!res.headersSent) {
            res.status(200).json({ success: true });
          }

          return;
        } catch (error) {
          this.logger.error(`[${pluginId}] 原始路由处理失败`, error);

          if (!res.headersSent) {
            throw new HttpException(
              {
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                message: '插件路由处理失败',
                error: error instanceof Error ? error.message : 'Unknown error',
              },
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }

          return;
        }
      }

      // ========== 3. 未找到路由 ==========

      this.logger.warn(`[${pluginId}] 未找到匹配的路由: ${method} ${pluginPath}`);

      if (!res.headersSent) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `插件路由未找到`,
            path: fullPath,
            pluginId,
          },
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      this.logger.error(`[${pluginId}] 插件路由处理异常`, error);

      if (!res.headersSent) {
        if (error instanceof HttpException) {
          throw error;
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: '插件路由处理失败',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /**
   * 获取插件路由列表（调试用）
   *
   * GET /api/v2/plugins/:pluginId/_routes
   *
   * @param pluginId - 插件 ID
   */
  @All(':pluginId/_routes')
  @UseGuards(JwtAuthGuard)
  async getPluginRoutes(@Param('pluginId') pluginId: string): Promise<any> {
    const routes = this.httpRegistry.getPluginRoutes(pluginId);

    return {
      pluginId,
      routeCount: routes.length,
      routes: routes.map((route) => {
        if (route.type === 'contract') {
          return {
            type: 'contract',
            pluginId: route.pluginId,
            contractKeys: Object.keys(route.handlers),
          };
        } else {
          return {
            type: 'raw',
            pluginId: route.pluginId,
            method: route.method,
            path: route.path,
          };
        }
      }),
    };
  }

  /**
   * 获取所有插件路由（调试用）
   *
   * GET /api/v2/plugins/_all-routes
   */
  @All('_all-routes')
  @UseGuards(JwtAuthGuard)
  async getAllPluginRoutes(): Promise<any> {
    const pluginIds = this.httpRegistry.getAllPluginIds();

    return {
      totalPlugins: pluginIds.length,
      plugins: pluginIds.map((pluginId) => ({
        pluginId,
        routeCount: this.httpRegistry.getPluginRoutes(pluginId).length,
      })),
    };
  }
}
