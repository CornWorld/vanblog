/**
 * @file resource-registration.util.ts
 *
 * 声明式资源注册工具
 *
 * 根据 Zod Schema 自动生成：
 * - Drizzle 表
 * - HTTP 路由
 * - CRUD 处理器
 * - Hook 集成
 */

import { Logger } from '@nestjs/common';

import type { Database } from '../../../database';
import type { DrizzleTable, ResourceOptions, ResourceHooks } from '@vanblog/shared/plugin';
import type { Request, Response } from 'express';
import type { z } from 'zod';

const logger = new Logger('ResourceRegistration');

/**
 * 注册资源的上下文
 */
export interface ResourceRegistrationContext {
  pluginId: string;
  resourceName: string;
  table: DrizzleTable;
  schema: z.ZodType;
  db: Database;
  httpRegistry: any;
  hooks?: ResourceHooks<any>;
}

/**
 * 注册声明式资源
 *
 * @param context - 注册上下文
 * @param options - 资源选项
 */
export async function registerResource(
  context: ResourceRegistrationContext,
  options: ResourceOptions<any>,
): Promise<void> {
  const { pluginId, resourceName, table, db, httpRegistry } = context;

  logger.log(`[${pluginId}] 注册资源: ${resourceName}`);

  // 使用 options.hooks
  const hooks = options.hooks;

  // 默认启用所有端点
  const endpoints = {
    list: options.endpoints?.list !== false,
    get: options.endpoints?.get !== false,
    create: options.endpoints?.create !== false,
    update: options.endpoints?.update !== false,
    delete: options.endpoints?.delete !== false,
  };

  // 注册 LIST 端点
  if (endpoints.list) {
    httpRegistry.registerRawRoute(
      pluginId,
      'GET',
      `/${resourceName}`,
      createListHandler(table, db),
    );
    logger.debug(`[${pluginId}] 注册端点: GET /${resourceName}`);
  }

  // 注册 GET 端点
  if (endpoints.get) {
    httpRegistry.registerRawRoute(
      pluginId,
      'GET',
      `/${resourceName}/:id`,
      createGetHandler(table, db),
    );
    logger.debug(`[${pluginId}] 注册端点: GET /${resourceName}/:id`);
  }

  // 注册 CREATE 端点
  if (endpoints.create) {
    httpRegistry.registerRawRoute(
      pluginId,
      'POST',
      `/${resourceName}`,
      createCreateHandler(table, db, options.schema, hooks),
    );
    logger.debug(`[${pluginId}] 注册端点: POST /${resourceName}`);
  }

  // 注册 UPDATE 端点
  if (endpoints.update) {
    httpRegistry.registerRawRoute(
      pluginId,
      'PATCH',
      `/${resourceName}/:id`,
      createUpdateHandler(table, db, options.schema, hooks),
    );
    logger.debug(`[${pluginId}] 注册端点: PATCH /${resourceName}/:id`);
  }

  // 注册 DELETE 端点
  if (endpoints.delete) {
    httpRegistry.registerRawRoute(
      pluginId,
      'DELETE',
      `/${resourceName}/:id`,
      createDeleteHandler(table, db, hooks),
    );
    logger.debug(`[${pluginId}] 注册端点: DELETE /${resourceName}/:id`);
  }

  logger.log(`[${pluginId}] 资源 '${resourceName}' 注册完成`);
}

/**
 * 创建 LIST 处理器
 */
function createListHandler(table: DrizzleTable, db: Database) {
  return async (req: Request, res: Response) => {
    try {
      // 动态导入 drizzle-orm
      const drizzleOrm = await import('drizzle-orm');

      // 解析查询参数
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // 查询数据
      const items = await db.select().from(table).limit(limit).offset(offset);

      // 查询总数
      const countResult = await db.select({ count: drizzleOrm.sql`COUNT(*)` }).from(table);

      const total = Number(countResult[0]?.count || 0);

      res.json({
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('LIST 处理器错误', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * 创建 GET 处理器
 */
function createGetHandler(table: DrizzleTable, db: Database) {
  return async (req: Request, res: Response) => {
    try {
      const { eq } = await import('drizzle-orm');

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // 查询单个资源
      // 注意：这里假设表有 id 字段
      const items = await db.select().from(table).where(eq(table.id, id)).limit(1);

      if (items.length === 0) {
        res.status(404).json({ error: 'Not Found' });
        return;
      }

      res.json(items[0]);
    } catch (error) {
      logger.error('GET 处理器错误', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * 创建 CREATE 处理器
 */
function createCreateHandler(
  table: DrizzleTable,
  db: Database,
  schema: z.ZodType,
  hooks?: ResourceHooks<any>,
) {
  return async (req: Request, res: Response) => {
    try {
      let data = req.body;

      // 验证数据
      try {
        data = schema.parse(data);
      } catch (error) {
        res.status(400).json({
          error: 'Validation Error',
          details: error,
        });
        return;
      }

      // 执行 beforeCreate hook
      if (hooks?.beforeCreate) {
        data = await hooks.beforeCreate(data);
      }

      // 插入数据
      const result = (await db.insert(table).values(data).returning()) as any[];

      const created = result[0];

      // 执行 afterCreate hook
      if (hooks?.afterCreate) {
        await hooks.afterCreate(created);
      }

      res.status(201).json(created);
    } catch (error) {
      logger.error('CREATE 处理器错误', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * 创建 UPDATE 处理器
 */
function createUpdateHandler(
  table: DrizzleTable,
  db: Database,
  schema: z.ZodType,
  hooks?: ResourceHooks<any>,
) {
  return async (req: Request, res: Response) => {
    try {
      const { eq } = await import('drizzle-orm');

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      let data = req.body;

      // 验证数据（使用 partial schema）
      try {
        data = (schema as any).partial().parse(data);
      } catch (error) {
        res.status(400).json({
          error: 'Validation Error',
          details: error,
        });
        return;
      }

      // 执行 beforeUpdate hook
      if (hooks?.beforeUpdate) {
        data = await hooks.beforeUpdate(id, data);
      }

      // 更新数据
      const result = (await db
        .update(table)
        .set(data)
        .where(eq(table.id, id))
        .returning()) as any[];

      if (result.length === 0) {
        res.status(404).json({ error: 'Not Found' });
        return;
      }

      const updated = result[0];

      // 执行 afterUpdate hook
      if (hooks?.afterUpdate) {
        await hooks.afterUpdate(updated);
      }

      res.json(updated);
    } catch (error) {
      logger.error('UPDATE 处理器错误', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * 创建 DELETE 处理器
 */
function createDeleteHandler(table: DrizzleTable, db: Database, hooks?: ResourceHooks<any>) {
  return async (req: Request, res: Response) => {
    try {
      const { eq } = await import('drizzle-orm');

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      // 执行 beforeDelete hook
      if (hooks?.beforeDelete) {
        await hooks.beforeDelete(id);
      }

      // 删除数据
      const result = (await db.delete(table).where(eq(table.id, id)).returning()) as any[];

      if (result.length === 0) {
        res.status(404).json({ error: 'Not Found' });
        return;
      }

      // 执行 afterDelete hook
      if (hooks?.afterDelete) {
        await hooks.afterDelete(id);
      }

      res.status(204).send();
    } catch (error) {
      logger.error('DELETE 处理器错误', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
