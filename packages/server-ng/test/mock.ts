import { dayjs } from '@vanblog/shared';
import { Test } from '@nestjs/testing';
import { vi, type Mock as VitestMock } from 'vitest';

import { DATABASE_CONNECTION } from '../src/database';
import { StorageProvider } from '../src/modules/media/dto/storage-config.dto';
import { ArticleService } from '../src/modules/article/article.service';
import { CategoryService } from '../src/modules/category/category.service';
import { CommentService } from '../src/modules/comment/comment.service';
import { PluginDataValidator } from '../src/modules/plugin/services/plugin-data.validator';
import { PluginRegistryService } from '../src/modules/plugin/services/plugin-registry.service';
import { SettingCoreService } from '../src/modules/setting/services/setting-core.service';
import { TagService } from '../src/modules/tag/tag.service';
import { StatisticsService } from '../src/shared/services/statistics.service';
import { QueryOptimizerService } from '../src/shared/services/query-optimizer.service';

// Import test data factories from fixtures/test-data.ts
// These are used in the Mock object below
import {
  createMockAnalytics,
  createMockWebhook,
  createMockPermissionGroup,
} from './fixtures/test-data';

import type { ConfigService } from '../src/config/config.service';
import type { Database } from '../src/database';
import type {
  StorageService,
  UploadResult,
} from '../src/modules/media/interfaces/storage.interface';
import type { StorageFactoryService } from '../src/modules/media/services/storage-factory.service';
import { HookService } from '../src/modules/plugin/services/hook.service';

import { generateTestId } from './test-utils';

/**
 * ID 生成器 - 为测试数据生成唯一 ID
 * 使用共享的 generateTestId() 确保跨文件的 ID 唯一性
 */
function generateUniqueId(prefix: string = ''): number {
  const id = generateTestId();
  return parseInt(`${prefix}${String(id)}`.slice(-10));
}

/**
 * 类型安全的数据库查询链 Mock 接口
 * 定义完整的 Drizzle ORM 链式调用签名
 */
interface MockQueryChain<T = any> {
  where: ReturnType<typeof vi.fn> & ((condition: any) => MockQueryChain<T>);
  orderBy: ReturnType<typeof vi.fn> & ((order: any) => MockQueryChain<T>);
  limit: ReturnType<typeof vi.fn> & ((count: number) => MockQueryChain<T>);
  offset: ReturnType<typeof vi.fn> & ((count: number) => MockQueryChain<T>);
  groupBy: ReturnType<typeof vi.fn> & ((columns: any) => MockQueryChain<T>);
  having: ReturnType<typeof vi.fn> & ((condition: any) => MockQueryChain<T>);
  innerJoin: ReturnType<typeof vi.fn> & ((table: any, condition: any) => MockQueryChain<T>);
  leftJoin: ReturnType<typeof vi.fn> & ((table: any, condition: any) => MockQueryChain<T>);
  rightJoin: ReturnType<typeof vi.fn> & ((table: any, condition: any) => MockQueryChain<T>);
  union: ReturnType<typeof vi.fn> & ((query: any) => MockQueryChain<T>);
  unionAll: ReturnType<typeof vi.fn> & ((query: any) => MockQueryChain<T>);
  with: ReturnType<typeof vi.fn> & ((alias: string, query: any) => MockQueryChain<T>);
  withRecursive: ReturnType<typeof vi.fn> & ((alias: string, query: any) => MockQueryChain<T>);
  as: ReturnType<typeof vi.fn> & ((alias: string) => MockQueryChain<T>);
  distinct: ReturnType<typeof vi.fn> & (() => MockQueryChain<T>);
  distinctOn: ReturnType<typeof vi.fn> & ((columns: any) => MockQueryChain<T>);
  for: ReturnType<typeof vi.fn> & ((lockStrength: any) => MockQueryChain<T>);
  $dynamic: ReturnType<typeof vi.fn> & (() => MockQueryChain<T>);
  get: ReturnType<typeof vi.fn> & (() => Promise<T | null>);
  all: ReturnType<typeof vi.fn> & (() => Promise<T[]>);
}

/**
 * 类型安全的 INSERT/UPDATE/DELETE returning 结果
 * 同时支持数组访问和 .get()/.all() 方法
 */
interface MockReturningResult<T = any> extends Array<T> {
  get: ReturnType<typeof vi.fn> & (() => Promise<T>);
  all: ReturnType<typeof vi.fn> & (() => Promise<T[]>);
}

/**
 * 类型安全的 INSERT 操作链
 * @internal - 预留用于未来类型增强
 */
// interface MockInsertChain<T = any> {
//   values: ReturnType<typeof vi.fn> & ((values: any) => {
//     returning: ReturnType<typeof vi.fn> & (() => MockReturningResult<T>);
//     onConflictDoUpdate: ReturnType<typeof vi.fn> & ((config: any) => {
//       returning: ReturnType<typeof vi.fn> & (() => MockReturningResult<T>);
//     });
//     onConflictDoNothing: ReturnType<typeof vi.fn> & ((config?: any) => {
//       returning: ReturnType<typeof vi.fn> & (() => MockReturningResult<T>);
//     });
//   });
// }

/**
 * 类型安全的 UPDATE 操作链
 * @internal - 预留用于未来类型增强
 */
// interface MockUpdateChain<T = any> {
//   set: ReturnType<typeof vi.fn> & ((values: any) => {
//     where: ReturnType<typeof vi.fn> & ((condition: any) => {
//       returning: ReturnType<typeof vi.fn> & (() => MockReturningResult<T>);
//     });
//     returning: ReturnType<typeof vi.fn> & (() => MockReturningResult<T>);
//   });
// }

/**
 * 类型安全的 DELETE 操作链
 * @internal - 预留用于未来类型增强
 */
// interface MockDeleteChain<T = any> {
//   where: ReturnType<typeof vi.fn> & ((condition: any) => {
//     returning: ReturnType<typeof vi.fn> & (() => MockReturningResult<T>);
//   });
//   returning: ReturnType<typeof vi.fn> & (() => MockReturningResult<T>);
// }

/**
 * 创建Mock数据库实例的工厂函数
 * 返回实现Database接口的Mock对象，支持完整的Drizzle ORM链式调用
 *
 * @example
 * const db = createDatabaseMock();
 * db.select().from(articles).where(eq(articles.id, 1));
 */
export function createDatabaseMock(): Database {
  const createChainMock = (data: unknown[] = []): any => {
    const chainMock: any = {
      where: vi.fn(),
      get: vi.fn().mockResolvedValue(data[0] ?? null),
      all: vi.fn().mockResolvedValue(data),
      orderBy: vi.fn(),
      limit: vi.fn(),
      offset: vi.fn(),
      groupBy: vi.fn(),
      having: vi.fn(),
      innerJoin: vi.fn(),
      leftJoin: vi.fn(),
      rightJoin: vi.fn(),
      union: vi.fn(),
      unionAll: vi.fn(),
      with: vi.fn(),
      withRecursive: vi.fn(),
      as: vi.fn(),
      distinct: vi.fn(),
      distinctOn: vi.fn(),
      for: vi.fn(),
      $dynamic: vi.fn(),
    };

    // 设置where方法返回包含get和all的对象（支持链式调用）
    chainMock.where.mockReturnValue({
      get: vi.fn().mockResolvedValue(data[0] ?? null),
      all: vi.fn().mockResolvedValue(data),
      limit: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(data[0] ?? null),
        all: vi.fn().mockResolvedValue(data),
      }),
      offset: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(data[0] ?? null),
        all: vi.fn().mockResolvedValue(data),
      }),
      orderBy: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(data[0] ?? null),
        all: vi.fn().mockResolvedValue(data),
      }),
    });

    // 设置其他方法都返回自身以支持链式调用
    Object.keys(chainMock).forEach((key) => {
      if (!['where', 'get', 'all'].includes(key)) {
        chainMock[key].mockReturnValue(chainMock);
      }
    });

    return chainMock;
  };

  const mockDb: any = {
    select: vi.fn().mockImplementation(() => {
      const fromMock = vi.fn().mockImplementation((_table: unknown) => {
        return createChainMock();
      });
      return { from: fromMock };
    }),
    from: vi.fn().mockImplementation(() => createChainMock()),
    where: vi.fn().mockImplementation(() => createChainMock()),
    orderBy: vi.fn().mockImplementation(() => createChainMock()),
    limit: vi.fn().mockImplementation(() => createChainMock()),
    offset: vi.fn().mockImplementation(() => createChainMock()),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    values: vi.fn().mockResolvedValue(undefined),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })),
    set: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
    delete: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([]),
    })),
    onConflictDoUpdate: vi.fn().mockImplementation(function (this: any) {
      return this;
    }),
    groupBy: vi.fn().mockImplementation(() => createChainMock()),
    count: vi.fn().mockImplementation(() => createChainMock()),
    innerJoin: vi.fn().mockImplementation(() => createChainMock()),
    leftJoin: vi.fn().mockImplementation(() => createChainMock()),
    rightJoin: vi.fn().mockImplementation(() => createChainMock()),
    having: vi.fn().mockImplementation(() => createChainMock()),
    union: vi.fn().mockImplementation(() => createChainMock()),
    unionAll: vi.fn().mockImplementation(() => createChainMock()),
    with: vi.fn().mockImplementation(() => createChainMock()),
    withRecursive: vi.fn().mockImplementation(() => createChainMock()),
    as: vi.fn().mockImplementation(() => createChainMock()),
    distinct: vi.fn().mockImplementation(() => createChainMock()),
    distinctOn: vi.fn().mockImplementation(() => createChainMock()),
    for: vi.fn().mockImplementation(() => createChainMock()),
    $dynamic: vi.fn().mockImplementation(() => createChainMock()),
    transaction: vi.fn().mockImplementation(async function (
      this: any,
      callback: (tx: any) => Promise<any>,
    ) {
      return await callback(this);
    }),
    run: vi.fn().mockResolvedValue(undefined),
  };

  return mockDb as Database;
}

/**
 * 数据库Mock工具类（Builder 模式）
 * 提供流畅的API来配置Mock数据库的查询结果
 *
 * @template TSelect - SELECT 查询返回的数据类型
 * @template TInsert - INSERT 操作返回的数据类型
 * @template TUpdate - UPDATE 操作返回的数据类型
 * @template TDelete - DELETE 操作返回的数据类型
 *
 * @example
 * // 基础用法
 * const dbMock = new DatabaseMockBuilder();
 * dbMock
 *   .setQueryResult([{ id: 1, title: 'Test' }])
 *   .setInsertResult([{ id: 1 }]);
 * const db = dbMock.build();
 *
 * @example
 * // 类型安全用法
 * interface Article { id: number; title: string; }
 * const dbMock = new DatabaseMockBuilder<Article, Article, Article, Article>();
 * dbMock.setQueryResult([{ id: 1, title: 'Test' }]); // 类型检查
 * const result = await db.select().from(articles).get(); // result: Article | null
 */
export class DatabaseMockBuilder<TSelect = any, TInsert = any, TUpdate = any, TDelete = any> {
  private mockDb: Record<string, ReturnType<typeof vi.fn>> = {};

  constructor() {
    this.createMockDb();
  }

  /**
   * 获取Mock数据库实例（仅供内部使用）
   * @internal
   */
  get db(): Record<string, ReturnType<typeof vi.fn>> {
    return this.mockDb;
  }

  /**
   * 设置查询结果
   * 创建完整的 SELECT 查询链 Mock：select().from().where().limit().orderBy().get()/all()
   *
   * @param data - 查询结果数据数组
   * @returns this - 支持链式调用
   *
   * @example
   * const dbMock = new DatabaseMockBuilder<Article>();
   * dbMock.setQueryResult([{ id: 1, title: 'Test' }]);
   *
   * // 支持以下所有查询模式：
   * await db.select().from(articles).get();
   * await db.select().from(articles).where(eq(...)).all();
   * await db.select().from(articles).where(...).limit(10).get();
   * await db.select().from(articles).orderBy(...).where(...).get();
   * await db.select().from(articles).where(...).orderBy(...).limit(10).offset(5).get();
   */
  setQueryResult(data: TSelect[]): this {
    // 创建完整的链式调用Mock，支持任意顺序的方法调用
    const createChainMock = (resultData: TSelect[]): MockQueryChain<TSelect> => {
      const chainMock: any = {
        where: vi.fn(),
        get: vi.fn().mockResolvedValue(resultData[0] ?? null),
        all: vi.fn().mockResolvedValue(resultData),
        orderBy: vi.fn(),
        limit: vi.fn(),
        offset: vi.fn(),
        groupBy: vi.fn(),
        having: vi.fn(),
        innerJoin: vi.fn(),
        leftJoin: vi.fn(),
        rightJoin: vi.fn(),
        union: vi.fn(),
        unionAll: vi.fn(),
        with: vi.fn(),
        withRecursive: vi.fn(),
        as: vi.fn(),
        distinct: vi.fn(),
        distinctOn: vi.fn(),
        for: vi.fn(),
        $dynamic: vi.fn(),
        // Make the chain thenable (Promise-like) so it can be awaited directly
        // This allows: await db.select().from(table).where(...) to work
        then: vi.fn().mockImplementation((resolve) => {
          return Promise.resolve(resultData).then(resolve);
        }),
        catch: vi.fn().mockImplementation((reject) => {
          return Promise.resolve(resultData).catch(reject);
        }),
      };

      // 设置所有非终止方法返回自身以支持链式调用
      Object.keys(chainMock).forEach((key) => {
        if (!['get', 'all', 'then', 'catch'].includes(key)) {
          chainMock[key].mockReturnValue(chainMock);
        }
      });

      return chainMock;
    };

    // 重置并设置 select 方法
    this.mockDb.select.mockReset();
    this.mockDb.select.mockImplementation(() => {
      const fromMock = vi.fn();

      fromMock.mockImplementation((_table) => {
        return createChainMock(data);
      });

      return { from: fromMock };
    });

    // 设置直接的 from() 调用（支持 db.from(table).where()... 模式）
    this.mockDb.from.mockReturnValue(createChainMock(data));

    return this;
  }

  /**
   * 设置插入结果
   * 创建完整的 INSERT 操作链 Mock：insert().values().returning()
   *
   * @param data - 插入后返回的数据（通常包含生成的 ID）
   * @returns this - 支持链式调用
   *
   * @example
   * const dbMock = new DatabaseMockBuilder<any, Article>();
   * dbMock.setInsertResult([{ id: 1, title: 'New Article' }]);
   *
   * // 支持以下操作模式：
   * await db.insert(articles).values({ title: 'Test' }).returning();
   * const [result] = await db.insert(articles).values({ title: 'Test' }).returning();
   * const result = await db.insert(articles).values({ title: 'Test' }).returning().get();
   */
  setInsertResult(data: TInsert[]): this {
    // 创建支持多种访问方式的返回值 Mock
    const returningMock = Object.create(Array.prototype) as MockReturningResult<TInsert>;
    Object.assign(returningMock, data);
    returningMock.length = data.length;
    returningMock.get = vi.fn().mockResolvedValue(data[0]); // .get() 返回第一项
    returningMock.all = vi.fn().mockResolvedValue(data); // .all() 返回所有项

    // 创建 values mock（需要在top-level可访问，以便测试可以检查调用）
    const valuesMock = vi.fn();
    valuesMock.mockImplementation((_values) => {
      // 同时调用 top-level values mock 以便测试可以检查
      const valuesFunc = this.mockDb.values as any;
      if (typeof valuesFunc === 'function') {
        valuesFunc(_values);
      }
      return {
        returning: vi.fn().mockReturnValue(returningMock),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(returningMock),
        }),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(returningMock),
        }),
      };
    });

    // 重置 insert 方法并设置完整链
    this.mockDb.insert.mockReset();
    this.mockDb.insert.mockImplementation(() => {
      return { values: valuesMock };
    });

    // 设置独立的 returning Mock（用于某些简化场景）
    this.mockDb.returning.mockReturnValue(returningMock);

    return this;
  }

  /**
   * 设置更新结果
   * 创建完整的 UPDATE 操作链 Mock：update().set().where().returning()
   *
   * @param data - 更新后返回的数据
   * @returns this - 支持链式调用
   *
   * @example
   * const dbMock = new DatabaseMockBuilder<any, any, Article>();
   * dbMock.setUpdateResult([{ id: 1, title: 'Updated Title' }]);
   *
   * // 支持以下操作模式：
   * await db.update(articles).set({ title: 'New' }).where(eq(articles.id, 1)).returning();
   * const [result] = await db.update(articles).set({ title: 'New' }).where(...).returning();
   * const result = await db.update(articles).set({ title: 'New' }).returning().get();
   */
  setUpdateResult(data: TUpdate[]): this {
    // 创建支持多种访问方式的返回值 Mock
    const returningMock = Object.create(Array.prototype) as MockReturningResult<TUpdate>;
    Object.assign(returningMock, data);
    returningMock.length = data.length;
    returningMock.get = vi.fn().mockResolvedValue(data[0]);
    returningMock.all = vi.fn().mockResolvedValue(data);

    // 创建 set mock（需要在top-level可访问，以便测试可以检查调用）
    const setMock = vi.fn();
    setMock.mockImplementation((_values) => {
      // 同时调用 top-level set mock 以便测试可以检查
      const setFunc = this.mockDb.set as any;
      if (typeof setFunc === 'function') {
        setFunc(_values);
      }

      const whereMock = vi.fn();
      whereMock.mockReturnValue({
        returning: vi.fn().mockReturnValue(returningMock),
      });

      return {
        where: whereMock,
        returning: vi.fn().mockReturnValue(returningMock),
      };
    });

    // 重置 update 方法并设置完整链
    this.mockDb.update.mockReset();
    this.mockDb.update.mockImplementation(() => {
      return { set: setMock };
    });

    // 设置独立的 returning Mock（用于某些简化场景）
    this.mockDb.returning.mockResolvedValue(data);

    return this;
  }

  /**
   * 设置删除结果
   * 创建完整的 DELETE 操作链 Mock：delete().where().returning()
   *
   * @param data - 删除后返回的数据，或删除的行数（number）
   * @returns this - 支持链式调用
   *
   * @example
   * const dbMock = new DatabaseMockBuilder<any, any, any, Article>();
   * dbMock.setDeleteResult([{ id: 1 }]); // 返回被删除的记录
   * // 或
   * dbMock.setDeleteResult(3); // 删除了 3 行
   *
   * // 支持以下操作模式：
   * await db.delete(articles).where(eq(articles.id, 1)).returning();
   * const [result] = await db.delete(articles).where(...).returning();
   * const result = await db.delete(articles).returning().get();
   */
  setDeleteResult(data: TDelete[] | number = 1): this {
    // 处理数字参数：创建对应数量的默认对象
    const resultData: TDelete[] = Array.isArray(data)
      ? data
      : Array(data)
          .fill({})
          .map((_, index) => ({ id: index + 1 }) as TDelete);

    // 创建支持多种访问方式的返回值 Mock
    const returningMock = Object.create(Array.prototype) as MockReturningResult<TDelete>;
    Object.assign(returningMock, resultData);
    returningMock.length = resultData.length;
    returningMock.get = vi.fn().mockResolvedValue(resultData[0]);
    returningMock.all = vi.fn().mockResolvedValue(resultData);

    // 重置 delete 方法并设置完整链
    this.mockDb.delete.mockReset();
    this.mockDb.delete.mockImplementation(() => {
      const whereMock = vi.fn();

      whereMock.mockReturnValue({
        returning: vi.fn().mockReturnValue(returningMock),
      });

      return {
        where: whereMock,
        returning: vi.fn().mockReturnValue(returningMock),
      };
    });

    // 设置独立的 returning Mock（用于某些简化场景）
    this.mockDb.returning.mockResolvedValue(resultData);

    return this;
  }

  /**
   * 设置计数结果
   * 创建完整的 COUNT 查询链 Mock：select({ count: count() }).from().where().get()
   *
   * @param count - 计数结果
   * @returns this - 支持链式调用
   *
   * @example
   * const dbMock = new DatabaseMockBuilder();
   * dbMock.setCountResult(42);
   *
   * // 支持以下查询模式：
   * await db.select({ count: count() }).from(articles).get();
   * await db.select({ count: count() }).from(articles).where(eq(...)).get();
   */
  setCountResult(count: number): this {
    const countResult = [{ count }];

    // 创建支持 COUNT 查询的链式 Mock
    const createCountChainMock = (): any => {
      const chainMock: any = {
        where: vi.fn(),
        get: vi.fn().mockResolvedValue({ count }),
        all: vi.fn().mockResolvedValue(countResult),
        orderBy: vi.fn(),
        limit: vi.fn(),
        offset: vi.fn(),
        groupBy: vi.fn(),
        having: vi.fn(),
        innerJoin: vi.fn(),
        leftJoin: vi.fn(),
        rightJoin: vi.fn(),
        // Make the chain thenable (Promise-like) for COUNT queries
        then: vi.fn().mockImplementation((resolve) => {
          return Promise.resolve(countResult).then(resolve);
        }),
        catch: vi.fn().mockImplementation((reject) => {
          return Promise.resolve(countResult).catch(reject);
        }),
      };

      // 设置所有非终止方法返回自身以支持链式调用
      Object.keys(chainMock).forEach((key) => {
        if (!['get', 'all', 'then', 'catch'].includes(key)) {
          chainMock[key].mockReturnValue(chainMock);
        }
      });

      return chainMock;
    };

    // 同时支持 select({ count: count() }) 和现有的模式
    this.mockDb.select.mockReset();
    this.mockDb.select.mockImplementation(() => {
      const fromMock = vi.fn();
      fromMock.mockImplementation((_table) => {
        return createCountChainMock();
      });
      return { from: fromMock };
    });

    return this;
  }

  /**
   * 设置事务行为
   * @param shouldSucceed 事务是否应该成功
   * @param mockTx 可选的事务对象 mock
   * @returns this
   */
  setTransactionBehavior(shouldSucceed = true, mockTx?: Record<string, unknown>): this {
    const transactionMock = mockTx ?? this.mockDb;

    if (shouldSucceed) {
      // 成功的事务：执行回调并返回结果
      this.mockDb.transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return await callback(transactionMock);
      });
    } else {
      // 失败的事务：抛出错误
      this.mockDb.transaction.mockRejectedValue(new Error('Transaction failed'));
    }

    return this;
  }

  /**
   * 构建Mock数据库实例
   */
  build(): any {
    return this.mockDb;
  }

  /**
   * 重置所有Mock
   */
  reset(): this {
    this.createMockDb();
    return this;
  }

  private createMockDb(): void {
    this.mockDb = {
      select: vi.fn(),
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
      offset: vi.fn(),
      insert: vi.fn(),
      values: vi.fn(),
      returning: vi.fn(),
      update: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      onConflictDoUpdate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
      innerJoin: vi.fn(),
      leftJoin: vi.fn(),
      rightJoin: vi.fn(),
      having: vi.fn(),
      union: vi.fn(),
      unionAll: vi.fn(),
      with: vi.fn(),
      withRecursive: vi.fn(),
      as: vi.fn(),
      distinct: vi.fn(),
      distinctOn: vi.fn(),
      for: vi.fn(),
      $dynamic: vi.fn(),
      transaction: vi.fn(),
    };

    // 设置链式调用
    Object.keys(this.mockDb).forEach((key) => {
      if (key !== 'transaction') {
        this.mockDb[key].mockReturnValue(this.mockDb);
      }
    });

    // 设置 transaction 的默认行为
    this.setTransactionBehavior(true);
  }
}

/**
 * 服务Mock工具类
 * 提供常用服务的Mock配置
 */

/**
 * 创建Logger Mock
 * 提供NestJS Logger接口的所有方法
 */
export function createLoggerMock(): any {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    info: vi.fn(),
  };
}

/**
 * 创建ExecutionContext Mock
 * 提供NestJS ExecutionContext接口的所有方法
 * 用于Guards、Interceptors等测试
 *
 * @example
 * const context = createExecutionContextMock({
 *   request: { user: { id: 1, type: 'admin' }, headers: { 'x-csrf-token': 'abc' } },
 *   response: { locals: { customData: 'test' } }
 * });
 */
export function createExecutionContextMock(overrides: any = {}): any {
  const mockRequest = { user: {}, headers: {}, ...overrides.request };
  const mockResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    send: vi.fn(),
    ...overrides.response,
  };

  return {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(mockRequest),
      getResponse: vi.fn().mockReturnValue(mockResponse),
    }),
    getHandler: vi.fn().mockReturnValue(overrides.handler ?? vi.fn()),
    getClass: vi.fn().mockReturnValue(overrides.class ?? vi.fn()),
    getType: vi.fn().mockReturnValue('http'),
    getArgs: vi.fn().mockReturnValue([mockRequest, mockResponse]),
    getArgByIndex: vi.fn().mockImplementation((index: number) => {
      const args = [mockRequest, mockResponse];
      return args[index];
    }),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
    ...overrides,
  } as any;
}

/**
 * 创建ModuleRef Mock
 * 提供NestJS ModuleRef接口的所有方法
 * 用于动态模块加载测试
 *
 * @example
 * const moduleRef = createModuleRefMock();
 * moduleRef.get.mockReturnValue(myService);
 */
export function createModuleRefMock(): any {
  return {
    get: vi.fn(),
    resolve: vi.fn(),
    create: vi.fn(),
    registerRequestByContextId: vi.fn(),
    introspect: vi.fn(),
  };
}

/**
 * 创建Reflector Mock
 * 提供NestJS Reflector接口的所有方法
 * 用于元数据反射测试
 *
 * @example
 * const reflector = createReflectorMock();
 * reflector.get.mockReturnValue(['admin', 'editor']);
 */
export function createReflectorMock(): any {
  return {
    get: vi.fn(),
    getAll: vi.fn(),
    getAllAndMerge: vi.fn(),
    getAllAndOverride: vi.fn(),
  };
}

/**
 * 创建 JwtService Mock
 * Returns a mock JwtService with sign and verify methods
 */
export function createJwtServiceMock(): any {
  return {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn().mockReturnValue({ sub: 1, username: 'test' }),
    decode: vi.fn().mockReturnValue({ sub: 1, username: 'test' }),
  };
}

/**
 * Mocked HookService type - all methods are Vitest mocks with .mock property
 * Use `as any` when providing to NestJS: `{ provide: HookService, useValue: mockHookService as any }`
 */
export type MockedHookService = {
  [K in keyof HookService]: HookService[K] extends (...args: any[]) => any
    ? VitestMock
    : HookService[K];
};

/**
 * 创建HookService Mock
 * Returns a properly typed mock with Vitest's .mock properties accessible
 */
export function createHookServiceMock(): MockedHookService {
  return {
    addAction: vi.fn(),
    addFilter: vi.fn(),
    removeAction: vi.fn(),
    removeFilter: vi.fn(),
    doAction: vi.fn().mockResolvedValue(undefined),
    applyFilters: vi
      .fn()
      .mockImplementation(async (_: string, data: unknown) => Promise.resolve(data)),
    hasAction: vi.fn().mockReturnValue(false),
    hasFilter: vi.fn().mockReturnValue(false),
    getActionCount: vi.fn().mockReturnValue(0),
    getFilterCount: vi.fn().mockReturnValue(0),
    getAllActionHooks: vi.fn().mockReturnValue([]),
    getAllFilterHooks: vi.fn().mockReturnValue([]),
  } as MockedHookService;
}

/**
 * 创建ConfigService Mock
 * 完整实现ConfigService接口，支持所有配置属性访问
 */
export function createConfigServiceMock(
  overrides: Partial<Record<string, unknown>> = {},
): ConfigService {
  // 默认配置
  const defaultConfig = {
    app: {
      port: 3000,
      nodeEnv: 'test',
      apiPrefix: 'api',
      apiVersion: 'v2',
      locale: 'zh-cn',
      isProduction: false,
      isDevelopment: false,
    },
    database: {
      type: 'sqlite',
      host: 'localhost',
      port: 0,
      username: '',
      password: '',
      database: process.env.DATABASE_URL,
      synchronize: false,
      logging: false,
    },
    jwt: {
      secret: 'test-secret',
      expiresIn: '7d',
      refreshSecret: 'test-refresh-secret',
      refreshExpiresIn: '30d',
    },
    cors: {
      origin: '*',
      credentials: true,
    },
    upload: {
      maxFileSize: 52428800,
      destination: './uploads',
    },
    static: {
      path: '/app/static',
    },
    log: {
      level: 'info',
      dir: '/var/log/vanblog',
    },
    waline: {
      db: 'waline',
    },
    runtime: {
      demoMode: false,
      codeRunnerPath: '/app/codeRunner',
      pluginRunnerPath: '/app/pluginRunner',
    },
  };

  // 合并用户提供的覆盖值
  // 支持扁平化的dot-notation键（如 'app.name'）和嵌套对象
  const mergedConfig = { ...defaultConfig };

  // 处理覆盖值，支持dot-notation
  for (const [key, value] of Object.entries(overrides)) {
    if (key.includes('.')) {
      // 处理dot-notation键（如 'app.name'）
      const keys = key.split('.');
      let current: any = mergedConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in current)) {
          current[k] = {};
        }
        current = current[k];
      }
      current[keys[keys.length - 1]] = value;
    } else {
      // 处理顶层键或嵌套对象
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const configRecord = mergedConfig as Record<string, unknown>;
        const existing = configRecord[key];
        configRecord[key] = {
          ...(typeof existing === 'object' && existing !== null ? existing : {}),
          ...value,
        };
      } else {
        (mergedConfig as Record<string, unknown>)[key] = value;
      }
    }
  }

  return {
    // 所有配置属性的getter
    get app() {
      return mergedConfig.app;
    },
    get database() {
      return mergedConfig.database;
    },
    get jwt() {
      return mergedConfig.jwt;
    },
    get cors() {
      return mergedConfig.cors;
    },
    get upload() {
      return mergedConfig.upload;
    },
    get static() {
      return mergedConfig.static;
    },
    get log() {
      return mergedConfig.log;
    },
    get waline() {
      return mergedConfig.waline;
    },
    get runtime() {
      return mergedConfig.runtime;
    },
    get all() {
      return {
        app: mergedConfig.app,
        database: mergedConfig.database,
        jwt: mergedConfig.jwt,
        cors: mergedConfig.cors,
        upload: mergedConfig.upload,
        static: mergedConfig.static,
        log: mergedConfig.log,
        waline: mergedConfig.waline,
        runtime: mergedConfig.runtime,
      };
    },

    // get() 方法 - 支持任意键访问和默认值
    get: vi.fn((key: string, defaultValue?: unknown) => {
      // 逐级访问对象属性（支持 'app.port' 或 'database.host' 等）
      const keys = key.split('.');
      let value: unknown = mergedConfig;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          return defaultValue;
        }
      }

      return value ?? defaultValue;
    }),
  } as unknown as ConfigService;
}

/**
 * 创建StorageService Mock
 */
export function createStorageServiceMock(
  customConfig: Partial<UploadResult> = {},
): Partial<StorageService> {
  const defaultUploadResult: UploadResult = {
    url: '/uploads/images/test.jpg',
    filename: 'test.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    ...customConfig,
  };

  return {
    upload: vi.fn().mockResolvedValue(defaultUploadResult),
    delete: vi.fn().mockResolvedValue(true),
    getUrl: vi.fn().mockReturnValue(defaultUploadResult.url),
  };
}

/**
 * 创建StorageFactoryService Mock
 */
export function createStorageFactoryServiceMock(
  storageService?: Partial<StorageService>,
  provider: StorageProvider = StorageProvider.LOCAL,
): Partial<StorageFactoryService> {
  return {
    getStorageService: vi.fn().mockReturnValue(storageService ?? createStorageServiceMock()),
    getCurrentProvider: vi.fn().mockReturnValue(provider),
  };
}

/**
 * 创建UserService Mock
 */
export function createUserServiceMock(): any {
  return {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getCollaborators: vi.fn(),
    // 缺失的方法
    getAdminUser: vi.fn(),
    findByUsername: vi.fn(),
    findByUsernameWithPassword: vi.fn(),
  };
}

/**
 * 创建PermissionService Mock
 */
export function createPermissionServiceMock(): any {
  return {
    hasPermission: vi.fn(),
    getUserPermissions: vi.fn(),
    checkPermissions: vi.fn(),
  };
}

/**
 * 创建ErrorRateMonitoringService Mock
 */
export function createErrorRateMonitoringServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getGlobalErrorRate: vi.fn().mockReturnValue(5.0),
    getEndpointErrorRates: vi.fn().mockReturnValue([]),
    getSystemHealthStatus: vi.fn().mockReturnValue({
      status: 'healthy',
      message: 'System is healthy',
      errorRate: 0,
      factors: [],
    }),
    ...overrides,
  };
}

/**
 * 创建SettingCoreService Mock - 完整实现
 */
export function createSettingCoreServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getSiteInfo: vi.fn().mockResolvedValue({
      title: 'Test Blog',
      description: 'Test Description',
      author: 'Test Author',
      keywords: ['test'],
    }),
    updateSiteInfo: vi.fn(),
    getSiteMeta: vi.fn(),
    getLayoutSettings: vi.fn(),
    updateLayoutSettings: vi.fn(),
    getThemeSettings: vi.fn(),
    updateThemeSettings: vi.fn(),
    getNavigation: vi.fn(),
    updateNavigation: vi.fn(),
    getFriendLinks: vi.fn(),
    createFriendLink: vi.fn(),
    updateFriendLink: vi.fn(),
    deleteFriendLink: vi.fn(),
    getCustomCode: vi.fn(),
    updateCustomCode: vi.fn(),
    getAboutInfo: vi.fn(),
    updateAboutInfo: vi.fn(),
    getSocials: vi.fn(),
    updateSocial: vi.fn(),
    deleteSocial: vi.fn(),
    getSocialTypes: vi.fn(),
    getWalineSetting: vi.fn(),
    updateWalineSetting: vi.fn(),
    getISRSetting: vi.fn(),
    updateISRSetting: vi.fn(),
    getLoginSetting: vi.fn(),
    updateLoginSetting: vi.fn(),
    getHttpsSetting: vi.fn(),
    updateHttpsSetting: vi.fn(),
    getStaticSetting: vi.fn(),
    updateStaticSetting: vi.fn(),
    getRewards: vi.fn(),
    createReward: vi.fn(),
    updateReward: vi.fn(),
    deleteReward: vi.fn(),
    getCaddyLog: vi.fn(),
    clearCaddyLog: vi.fn(),
    getCaddyConfig: vi.fn(),
    setCaddyRedirect: vi.fn(),
    initCaddy: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建SettingRegistryService Mock - 完整实现
 */
export function createSettingRegistryServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    registerConfig: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    deleteConfig: vi.fn(),
    getRegisteredKeys: vi.fn().mockReturnValue([]),
    getRegistration: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建CommentService Mock
 */
export function createCommentServiceMock(): any {
  return {
    getWalineSetting: vi.fn(),
    updateWalineSetting: vi.fn(),
    restart: vi.fn(),
    getStatus: vi.fn(),
    getResolvedWalineConfig: vi.fn(),
    mapConfigToEnv: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
    beforeApplicationShutdown: vi.fn(),
  };
}

/**
 * 创建StatisticsService Mock
 */
export function createStatisticsServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getOverallStatistics: vi.fn().mockResolvedValue({
      totalCategories: 0,
      totalTags: 0,
      totalArticles: 0,
      publishedArticles: 0,
      privateArticles: 0,
      hiddenArticles: 0,
      totalViews: 0,
      categories: [],
      tags: [],
      ...overrides,
    }),
    getTotalPublishedWordCount: vi.fn().mockResolvedValue(0),
    getCategoryStats: vi.fn().mockResolvedValue({}),
    getTagStats: vi.fn().mockResolvedValue({}),
    getArticleStats: vi.fn().mockResolvedValue({}),
  };
}

/**
 * 创建QueryOptimizerService Mock
 */
export function createQueryOptimizerServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    withPerformanceMonitoring: vi.fn().mockImplementation((_name, fn) => fn()),
    batchCountArticlesByTags: vi.fn().mockResolvedValue(new Map()),
    batchCountArticlesByCategories: vi.fn().mockResolvedValue(new Map()),
    buildOptimizedSearchQuery: vi.fn().mockReturnValue([]),
    logSlowQuery: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建MarkdownService Mock
 */
export function createMarkdownServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    renderMarkdown: vi.fn().mockReturnValue('<p>Rendered HTML</p>'),
    parseMarkdown: vi.fn().mockReturnValue({ headings: [], content: '' }),
    highlightCode: vi.fn().mockReturnValue('<code>highlighted</code>'),
    ...overrides,
  };
}

/**
 * 创建CategoryService Mock
 */
export function createCategoryServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateByName: vi.fn(),
    remove: vi.fn(),
    removeByName: vi.fn(),
    getArticlesByCategoryId: vi.fn(),
    getArticlesByCategoryName: vi.fn(),
    verifyPassword: vi.fn(),
    getStatistics: vi.fn(),
    getCategoriesWithTags: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建TagService Mock
 */
export function createTagServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getStatistics: vi.fn(),
    getTagsWithCategories: vi.fn(),
    getArticlesByTagId: vi.fn(),
    findOrCreateTags: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建ArticleService Mock
 */
export function createArticleServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    findAll: vi.fn(),
    search: vi.fn(),
    exportArticles: vi.fn(),
    findByCategory: vi.fn(),
    importArticles: vi.fn(),
    findOne: vi.fn(),
    findOneByPathname: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    verifyPassword: vi.fn(),
    verifyPasswordByPathname: vi.fn(),
    getArticlesGroupedByCategory: vi.fn(),
    getArticlesGroupedByTag: vi.fn(),
    isPrivateById: vi.fn(),
    isPrivateByPathname: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建BackupService Mock
 */
export function createBackupServiceMock(): any {
  return {
    createBackup: vi.fn(),
    getBackups: vi.fn(),
    deleteBackup: vi.fn(),
    restoreBackup: vi.fn(),
    getRestoreProgress: vi.fn(),
  };
}

/**
 * 创建Waline设置测试数据
 */
export function createWalineSetting(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    'smtp.enabled': true,
    'smtp.port': 587,
    'smtp.host': 'smtp.example.com',
    'smtp.user': 'user@example.com',
    'smtp.password': 'password',
    'sender.name': 'VanBlog',
    'sender.email': 'noreply@example.com',
    authorEmail: 'admin@example.com',
    webhook: 'https://example.com/webhook',
    forceLoginComment: false,
    otherConfig: '{"key":"value"}',
    serverURL: 'https://waline.example.com',
    ...overrides,
  };
}

/**
 * 创建 AnalyticsService Mock
 */
export function createAnalyticsServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    recordAnalytics: vi.fn(),
    getOverview: vi.fn(),
    getReferrerStats: vi.fn(),
    getDeviceStats: vi.fn(),
    getBrowserStats: vi.fn(),
    exportAnalytics: vi.fn(),
    getPageRankings: vi.fn(),
    getChartData: vi.fn(),
    exportAnalyticsData: vi.fn(),
    getTopPages: vi.fn(),
    getTimeSeriesData: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建 ArticleStatsService Mock
 */
export function createArticleStatsServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getArticleStats: vi.fn(),
    recordArticleView: vi.fn(),
    recordArticleViewByPathname: vi.fn(),
    recordReadingTime: vi.fn(),
    getTopArticles: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建 AnalyticsCacheService Mock
 */
export function createAnalyticsCacheServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getOverview: vi.fn(),
    getPageRankings: vi.fn(),
    getReferrerStats: vi.fn(),
    getChartData: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建 EchartsFormatterService Mock
 */
export function createEchartsFormatterServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    formatTimeSeriesData: vi.fn(),
    formatDashboard: vi.fn(),
    formatTimeSeriesChart: vi.fn(),
    formatDevicePieChart: vi.fn(),
    formatBrowserBarChart: vi.fn(),
    formatPageRankingsChart: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建 PublicAnalyticsService Mock
 */
export function createPublicAnalyticsServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getPublicOverview: vi.fn(),
    getPublicArticleStats: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建 Analytics EChart 时间序列数据
 */
export function createAnalyticsChartData(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    pageviews: [
      { time: '2024-01-01', value: 100 },
      { time: '2024-01-02', value: 150 },
      { time: '2024-01-03', value: 120 },
    ],
    visitors: [
      { time: '2024-01-01', value: 50 },
      { time: '2024-01-02', value: 75 },
      { time: '2024-01-03', value: 60 },
    ],
    ...overrides,
  };
}

/**
 * 创建设备统计数据
 */
export function createDeviceStats(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    device: 'desktop',
    count: 500,
    percentage: 60.24,
    ...overrides,
  };
}

/**
 * 创建浏览器统计数据
 */
export function createBrowserStats(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    browser: 'Chrome',
    count: 450,
    percentage: 54.22,
    ...overrides,
  };
}

/**
 * 创建文章统计数据
 */
export function createArticleStats(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    articleId: overrides.articleId ?? generateUniqueId('1'),
    title: 'Test Article',
    views: 100,
    uniqueVisitors: 50,
    avgTimeOnPage: 120,
    bounceRate: 0.25,
    ...overrides,
  };
}

export const ServiceMockBuilder = {
  createLoggerMock,
  createExecutionContextMock,
  createModuleRefMock,
  createReflectorMock,
  createHookServiceMock,
  createConfigServiceMock,
  createStorageServiceMock,
  createStorageFactoryServiceMock,
  createUserServiceMock,
  createPermissionServiceMock,
  createErrorRateMonitoringServiceMock,
  createSettingCoreServiceMock,
  createSettingRegistryServiceMock,
  createCommentServiceMock,
  createStatisticsServiceMock,
  createQueryOptimizerServiceMock,
  createMarkdownServiceMock,
  createCategoryServiceMock,
  createBackupServiceMock,
  createTagServiceMock,
  createArticleServiceMock,
  createAnalyticsServiceMock,
  createArticleStatsServiceMock,
  createAnalyticsCacheServiceMock,
  createEchartsFormatterServiceMock,
  createPublicAnalyticsServiceMock,
  createMediaServiceMock,
  createImageProcessingServiceMock,
  createImageProcessingQueueServiceMock,
  createStorageConfigServiceMock,
  createPipelineServiceMock,
  createDraftServiceMock,
  createDraftVersionServiceMock,
  createDemoServiceMock,
  createSitemapServiceMock,
};

/**
 * 测试数据工厂
 * 提供常用的测试数据模板
 */
/**
 * 创建用户测试数据
 */
export function createUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`1${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    username: overrides.username ?? `testuser-${suffix}`,
    nickname: overrides.nickname ?? 'Test User',
    email: overrides.email ?? `test-${suffix}@example.com`,
    type: overrides.type ?? 'admin',
    password: overrides.password ?? 'hashed-password',
    createdAt: overrides.createdAt ?? dayjs().format(),
    updatedAt: overrides.updatedAt ?? dayjs().format(),
  };
}

/**
 * 创建文章测试数据
 */
export function createArticle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`1${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    title: overrides.title ?? 'Test Article',
    content: overrides.content ?? 'Test content',
    tags: overrides.tags ?? JSON.stringify(['test']),
    author: overrides.author ?? 'admin',
    top: overrides.top !== undefined ? overrides.top : 0,
    hidden: overrides.hidden ?? false,
    private: overrides.private ?? false,
    viewer: overrides.viewer !== undefined ? overrides.viewer : 10,
    pathname: overrides.pathname !== undefined ? overrides.pathname : `/article-${suffix}`,
    category: overrides.category !== undefined ? overrides.category : null,
    password: overrides.password !== undefined ? overrides.password : null,
    createdAt: overrides.createdAt ?? dayjs().format(),
    updatedAt: overrides.updatedAt ?? dayjs().format(),
  };
}

/**
 * 创建多个文章测试数据
 */
export function createArticles(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = generateTestId();
    const uniqueId = parseInt(`1${String(id)}${String(index)}`.slice(-10));

    return createArticle({
      id: overrides.id !== undefined ? (overrides.id as number) + index : uniqueId,
      title: `Test Article ${String(index + 1)}`,
      ...overrides,
    });
  });
}

/**
 * 创建文章DTO测试数据
 */
export function createArticleDto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Test Article',
    content: 'Test content',
    author: 'test-author',
    tags: JSON.stringify(['test']),
    categories: [],
    isPublished: false,
    isTop: false,
    allowComment: true,
    ...overrides,
  };
}

/**
 * 创建标签测试数据
 */
export function createTag(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`4${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    name: overrides.name ?? `Test Tag ${suffix}`,
    slug: overrides.slug ?? `test-tag-${suffix}`,
    createdAt: overrides.createdAt ?? dayjs().format(),
    updatedAt: overrides.updatedAt ?? dayjs().format(),
  };
}

/**
 * 创建多个标签测试数据
 */
export function createTags(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = generateTestId();
    const uniqueId = parseInt(`4${String(id)}${String(index)}`.slice(-10));

    return createTag({
      id: overrides.id !== undefined ? (overrides.id as number) + index : uniqueId,
      name: `Tag ${String(index + 1)}`,
      slug: `tag-${String(index + 1)}`,
      ...overrides,
    });
  });
}

/**
 * 创建分类测试数据
 */
export function createCategory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`3${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    name: overrides.name ?? `Test Category ${suffix}`,
    slug: overrides.slug !== undefined ? overrides.slug : undefined,
    description: overrides.description ?? 'Test category description',
    private: overrides.private ?? false,
    password: overrides.password !== undefined ? overrides.password : null,
    createdAt: overrides.createdAt ?? dayjs().format(),
    updatedAt: overrides.updatedAt ?? dayjs().format(),
    articleCount: overrides.articleCount ?? 0,
    ...overrides,
  };
}

/**
 * 创建多个分类测试数据
 */
export function createCategories(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = generateTestId();
    const uniqueId = parseInt(`3${String(id)}${String(index)}`.slice(-10));

    return createCategory({
      id: overrides.id !== undefined ? (overrides.id as number) + index : uniqueId,
      name: `Test Category ${String(index + 1)}`,
      ...overrides,
    });
  });
}

/**
 * 创建评论测试数据
 */
export function createComment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`11${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    articleId: overrides.articleId ?? generateUniqueId('1'),
    parentId: overrides.parentId !== undefined ? overrides.parentId : null,
    author: overrides.author ?? 'Commenter',
    email: overrides.email ?? `commenter-${suffix}@example.com`,
    content: overrides.content ?? 'This is a test comment.',
    status: overrides.status ?? 'approved',
    createdAt: overrides.createdAt ?? dayjs().format(),
    updatedAt: overrides.updatedAt ?? dayjs().format(),
    ...overrides,
  };
}

/**
 * 创建媒体文件测试数据
 */
export function createMediaFile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`6${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    filename: overrides.filename ?? `test-${suffix}.jpg`,
    path: overrides.path ?? `/uploads/images/test-${suffix}.jpg`,
    size: overrides.size ?? 1024,
    mimetype: overrides.mimetype ?? 'image/jpeg',
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    hash: overrides.hash ?? 'testhash',
    provider: overrides.provider ?? 'local',
    createdAt: overrides.createdAt ?? dayjs().format(),
    ...overrides,
  };
}

/**
 * 创建多个媒体文件测试数据
 */
export function createMediaFiles(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = generateTestId();
    const uniqueId = parseInt(`6${String(id)}${String(index)}`.slice(-10));

    return createMediaFile({
      id: overrides.id !== undefined ? (overrides.id as number) + index : uniqueId,
      filename: `test${String(index + 1)}.jpg`,
      path: `/uploads/images/test${String(index + 1)}.jpg`,
      ...overrides,
    });
  });
}

/**
 * 创建分页结果
 */
export function createPaginatedResult<T>(
  items: T[],
  total: number,
  page = 1,
  pageSize = 10,
): {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 创建性能统计数据
 */
export function createPerformanceStats(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    totalRequests: 100,
    errorRequests: 5,
    slowRequests: 10,
    averageResponseTime: 250,
    requestsPerSecond: 2.5,
    memoryTrend: [100, 110, 105],
    topSlowEndpoints: [{ path: '/api/v2/articles', avgDuration: 500, count: 20 }],
    ...overrides,
  };
}

/**
 * 创建系统健康状态数据
 */
export function createHealthStatus(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: 'healthy',
    message: 'System is healthy',
    errorRate: 2.5,
    factors: [],
    ...overrides,
  };
}

/**
 * 创建Draft测试数据
 */
export function createDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`2${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    title: overrides.title ?? 'Test Draft',
    content: overrides.content ?? 'Test content',
    tags: overrides.tags ?? ['test'],
    author: overrides.author ?? 'admin',
    pathname: overrides.pathname !== undefined ? overrides.pathname : `/draft-${suffix}`,
    category: overrides.category !== undefined ? overrides.category : null,
    version: overrides.version ?? 1,
    createdAt: overrides.createdAt ?? dayjs().format(),
    updatedAt: overrides.updatedAt ?? dayjs().format(),
    ...overrides,
  };
}

/**
 * 创建多个Draft测试数据
 */
export function createDrafts(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = generateTestId();
    const uniqueId = parseInt(`2${String(id)}${String(index)}`.slice(-10));

    return createDraft({
      id: overrides.id !== undefined ? (overrides.id as number) + index : uniqueId,
      title: `Draft ${String(index + 1)}`,
      ...overrides,
    });
  });
}

/**
 * 创建DraftVersion测试数据
 */
export function createDraftVersion(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`5${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    draftId: overrides.draftId ?? generateUniqueId('2'),
    version: overrides.version ?? 1,
    title: overrides.title ?? 'Test Draft',
    content: overrides.content ?? 'Test content',
    tags: overrides.tags ?? ['test'],
    author: overrides.author ?? 'admin',
    pathname: overrides.pathname !== undefined ? overrides.pathname : `/draft-version-${suffix}`,
    category: overrides.category !== undefined ? overrides.category : null,
    createdAt: overrides.createdAt ?? dayjs().format(),
    ...overrides,
  };
}

/**
 * 创建多个DraftVersion测试数据
 */
export function createDraftVersions(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = generateTestId();
    const uniqueId = parseInt(`5${String(id)}${String(index)}`.slice(-10));

    return createDraftVersion({
      id: overrides.id !== undefined ? (overrides.id as number) + index : uniqueId,
      version: index + 1,
      title: `Version ${String(index + 1)}`,
      ...overrides,
    });
  });
}

export const TestDataFactory = {
  createUser,
  createArticle,
  createArticles,
  createArticleDto,
  createTag,
  createTags,
  createCategory,
  createMediaFile,
  createMediaFiles,
  createPaginatedResult,
  createPerformanceStats,
  createHealthStatus,
  createWalineSetting,
  createAnalyticsChartData,
  createDeviceStats,
  createBrowserStats,
  createArticleStats,
  createPipeline,
  createPipelines,
  createPipelineExecutionResult,
  createDraft,
  createDrafts,
  createDraftVersion,
  createDraftVersions,
};

/**
 * 创建完整的测试模块配置
 */
export function createTestModuleConfig(options: {
  providers: unknown[];
  databaseMock?: DatabaseMockBuilder;
  configMock?: Record<string, unknown>;
}): { providers: unknown[] } {
  const providers = [...options.providers];

  if (options.databaseMock) {
    providers.push({
      provide: DATABASE_CONNECTION,
      useValue: options.databaseMock.build(),
    });
  }

  if (options.configMock) {
    providers.push({
      provide: 'ConfigService',
      useValue: createConfigServiceMock(options.configMock),
    });
  }

  return { providers };
}

/**
 * 创建TagService测试模块（统一Testing Module配置）
 * 减少4个服务测试文件中的重复配置（tag.service.spec.ts等）
 *
 * @example
 * const dbMock = Mock.db().setQueryResult([...]);
 * const module = await createTagServiceTestingModule({
 *   service: TagService,
 *   dbMock: dbMock.build(),
 * }).compile();
 */
export function createTagServiceTestingModule(options: {
  service: any;
  dbMock?: any;
  hookServiceMock?: any;
  statisticsServiceMock?: any;
  queryOptimizerMock?: any;
}): ReturnType<typeof Test.createTestingModule> {
  const {
    service,
    dbMock = Mock.db().build(),
    hookServiceMock = Mock.hook(),
    statisticsServiceMock = Mock.statistics(),
    queryOptimizerMock = Mock.queryOptimizer(),
  } = options;

  return Test.createTestingModule({
    providers: [
      service,
      {
        provide: DATABASE_CONNECTION,
        useValue: dbMock,
      },
      {
        provide: StatisticsService,
        useValue: statisticsServiceMock,
      },
      {
        provide: QueryOptimizerService,
        useValue: queryOptimizerMock,
      },
      {
        provide: HookService,
        useValue: hookServiceMock,
      },
    ],
  });
}

/**
 * 创建 BootstrapService 测试模块
 * 整合 bootstrap.service.spec.ts 中的 10 个 Mock 定义
 *
 * @example
 * const module = await createBootstrapServiceTestingModule({
 *   configServiceMock: { get: vi.fn().mockReturnValue('1.0.0') },
 * }).compile();
 * const service = module.get<BootstrapService>(BootstrapService);
 */
export function createBootstrapServiceTestingModule(
  options: {
    configServiceMock?: any;
    statisticsServiceMock?: any;
    settingCoreServiceMock?: any;
    commentServiceMock?: any;
    tagServiceMock?: any;
    categoryServiceMock?: any;
    hookServiceMock?: any;
    pluginRegistryServiceMock?: any;
    pluginDataValidatorMock?: any;
  } = {},
): ReturnType<typeof Test.createTestingModule> {
  const {
    configServiceMock = { get: vi.fn((key) => (key === 'app.version' ? '1.0.0' : undefined)) },
    statisticsServiceMock = {
      getOverallStatistics: vi.fn(),
      getTotalPublishedWordCount: vi.fn(),
    },
    settingCoreServiceMock = {
      getSiteInfo: vi.fn(),
      getNavigation: vi.fn(),
      getFriendLinks: vi.fn(),
    },
    commentServiceMock = {
      getResolvedWalineConfig: vi.fn(),
    },
    tagServiceMock = {
      findAll: vi.fn(),
    },
    categoryServiceMock = {
      findAll: vi.fn(),
    },
    hookServiceMock = Mock.hook(),
    pluginRegistryServiceMock = {
      getAllPublicData: vi.fn(),
    },
    pluginDataValidatorMock = {
      normalizeProviderResult: vi.fn(),
    },
  } = options;

  return Test.createTestingModule({
    providers: [
      {
        provide: 'ConfigService',
        useValue: configServiceMock,
      },
      {
        provide: StatisticsService,
        useValue: statisticsServiceMock,
      },
      {
        provide: SettingCoreService,
        useValue: settingCoreServiceMock,
      },
      {
        provide: CommentService,
        useValue: commentServiceMock,
      },
      {
        provide: TagService,
        useValue: tagServiceMock,
      },
      {
        provide: CategoryService,
        useValue: categoryServiceMock,
      },
      {
        provide: HookService,
        useValue: hookServiceMock,
      },
      {
        provide: PluginRegistryService,
        useValue: pluginRegistryServiceMock,
      },
      {
        provide: PluginDataValidator,
        useValue: pluginDataValidatorMock,
      },
    ],
  });
}

/**
 * 创建 OptionsService 测试模块
 * 整合 options.service.spec.ts 中的 5 个 Mock 定义
 *
 * @example
 * const module = await createOptionsServiceTestingModule({
 *   articleServiceMock: { findAll: vi.fn() },
 * }).compile();
 */
export function createOptionsServiceTestingModule(
  options: {
    articleServiceMock?: any;
    categoryServiceMock?: any;
    tagServiceMock?: any;
    settingCoreServiceMock?: any;
    commentServiceMock?: any;
  } = {},
): ReturnType<typeof Test.createTestingModule> {
  const {
    articleServiceMock = {
      findAll: vi.fn(),
    },
    categoryServiceMock = {
      findAll: vi.fn(),
    },
    tagServiceMock = {
      findAll: vi.fn(),
    },
    settingCoreServiceMock = {
      getSiteInfo: vi.fn(),
      getNavigation: vi.fn(),
      getFriendLinks: vi.fn(),
    },
    commentServiceMock = {
      getResolvedWalineConfig: vi.fn(),
    },
  } = options;

  return Test.createTestingModule({
    providers: [
      {
        provide: ArticleService,
        useValue: articleServiceMock,
      },
      {
        provide: CategoryService,
        useValue: categoryServiceMock,
      },
      {
        provide: TagService,
        useValue: tagServiceMock,
      },
      {
        provide: SettingCoreService,
        useValue: settingCoreServiceMock,
      },
      {
        provide: CommentService,
        useValue: commentServiceMock,
      },
    ],
  });
}

/**
 * 创建带数据库 Mock 的测试模块（用于数据库查询测试）
 * 用于 timeline.service, custom-page.service 等依赖数据库的服务
 *
 * @example
 * const dbMock = Mock.db().setQueryResult([...]);
 * const module = await createDatabaseServiceTestingModule({
 *   serviceClass: TimelineService,
 *   dbMock: dbMock.build(),
 * }).compile();
 */
export function createDatabaseServiceTestingModule(options: {
  serviceClass: any;
  dbMock?: any;
  additionalProviders?: any[];
}): ReturnType<typeof Test.createTestingModule> {
  const { serviceClass, dbMock = Mock.db().build(), additionalProviders = [] } = options;

  return Test.createTestingModule({
    providers: [
      serviceClass,
      {
        provide: DATABASE_CONNECTION,
        useValue: dbMock,
      },
      ...additionalProviders,
    ],
  });
}

/**
 * Mock工具类
 * 提供统一的Mock工具访问入口
 */

/**
 * 创建MediaService Mock
 */
export function createMediaServiceMock(): any {
  return {
    uploadFile: vi.fn(),
    listFiles: vi.fn(),
    getFileById: vi.fn(),
    deleteFile: vi.fn(),
    deleteFiles: vi.fn(),
    scanArticleImages: vi.fn(),
    exportAllImages: vi.fn(),
    initiateChunkUpload: vi.fn(),
    uploadChunk: vi.fn(),
    mergeChunks: vi.fn(),
    cleanupChunks: vi.fn(),
    updateMediaFile: vi.fn(),
    getMediaStats: vi.fn(),
  };
}

/**
 * 创建ImageProcessingService Mock
 */
export function createImageProcessingServiceMock(): any {
  return {
    compressImage: vi.fn().mockResolvedValue({
      buffer: Buffer.from('compressed'),
      metadata: { width: 1920, height: 1080, format: 'jpeg' },
      originalSize: 2048,
      compressedSize: 1024,
      compressionRatio: 0.5,
    }),
    addWatermark: vi.fn().mockResolvedValue({
      buffer: Buffer.from('watermarked'),
      metadata: { width: 1920, height: 1080, format: 'jpeg' },
      originalSize: 2048,
      compressedSize: 1024,
      compressionRatio: 0.5,
    }),
  };
}

/**
 * 创建ImageProcessingQueueService Mock
 */
export function createImageProcessingQueueServiceMock(): any {
  return {
    addTask: vi.fn(),
    getTaskStatus: vi.fn(),
    getTasksByFileId: vi.fn(),
    getQueueStats: vi.fn(),
    processQueue: vi.fn(),
    retryFailedTasks: vi.fn(),
  };
}

/**
 * 创建DraftService Mock
 */
export function createDraftServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    publish: vi.fn(),
    importDrafts: vi.fn(),
    autoSave: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建DraftVersionService Mock
 */
export function createDraftVersionServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    createVersion: vi.fn(),
    deleteVersion: vi.fn(),
    deleteAllVersions: vi.fn(),
    getVersions: vi.fn(),
    getVersion: vi.fn(),
    restoreVersion: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建DemoService Mock
 */
export function createDemoServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    isDemoModeEnabled: vi.fn(),
    getSnapshotInfo: vi.fn(),
    manualRestore: vi.fn(),
    createSnapshot: vi.fn(),
    restoreFromSnapshot: vi.fn(),
    scheduledRestore: vi.fn(),
    onModuleInit: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建MetaService Mock
 */
export function createMetaServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getVersionInfo: vi.fn().mockReturnValue({
      version: '1.0.0',
      latestVersion: '1.0.0',
      hasUpdate: false,
      updateInfo: undefined,
    }),
    ...overrides,
  };
}

/**
 * 创建BootstrapService Mock
 */
export function createBootstrapServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    getPublicBootstrap: vi.fn().mockResolvedValue({
      version: '1.0.0',
      tags: ['technology', 'web'],
      totalArticles: 5,
      totalWordCount: 2547,
      siteInfo: {
        title: 'Test Blog',
        description: 'Test Description',
        author: 'Test Author',
        keywords: ['test'],
      },
      friendLinks: [],
      categories: [],
      navigation: [],
      extensions: {},
      walineConfig: undefined,
    }),
    getCurrentVersion: vi.fn().mockReturnValue('1.0.0'),
    checkUpdate: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建StorageConfigService Mock
 */
export function createStorageConfigServiceMock(
  overrides: Record<string, unknown> = {},
): Record<string, ReturnType<typeof vi.fn> | Promise<any>> {
  return {
    getStorageConfig: vi.fn().mockResolvedValue({
      provider: 'local',
      enabled: true,
      ...overrides,
    }),
    updateStorageConfig: vi.fn().mockResolvedValue({}),
    getFullStorageConfig: vi.fn().mockResolvedValue({
      provider: 'local',
      enabled: true,
      ...overrides,
    }),
  };
}

/**
 * 创建PipelineService Mock
 */
export function createPipelineServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    findAll: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      ...overrides,
    }),
    findOne: vi.fn(),
    findByEventName: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getConfig: vi.fn().mockReturnValue({
      events: [
        'article|beforeCreate',
        'article|afterCreate',
        'article|beforeUpdate',
        'article|afterUpdate',
        'article|afterDelete',
      ],
    }),
    triggerById: vi.fn(),
    dispatchEvent: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建SitemapService Mock
 */
export function createSitemapServiceMock(overrides: Record<string, unknown> = {}): any {
  return {
    generateSitemapFn: vi.fn().mockResolvedValue(undefined),
    getSiteUrls: vi
      .fn()
      .mockResolvedValue([
        '/',
        '/category',
        '/tag',
        '/timeline',
        '/about',
        '/link',
        '/post/test-article-1',
        '/post/test-article-2',
      ]),
    getArticleUrls: vi.fn().mockResolvedValue(['/post/test-article-1', '/post/test-article-2']),
    getCategoryUrls: vi.fn().mockResolvedValue(['/category/tech', '/category/life']),
    getTagUrls: vi.fn().mockResolvedValue(['/tag/javascript', '/tag/typescript']),
    getPageUrls: vi.fn().mockResolvedValue(['/page/1', '/page/2']),
    generateSitemap: vi.fn(),
    ...overrides,
  };
}

/**
 * 创建Pipeline测试数据
 */
export function createPipeline(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = generateTestId();
  const uniqueId = parseInt(`6${String(id)}`.slice(-10));
  const suffix = String(id);

  return {
    id: overrides.id ?? uniqueId,
    name: overrides.name ?? `Test Pipeline ${suffix}`,
    eventName: overrides.eventName ?? 'article|afterCreate',
    script: overrides.script ?? 'console.log("test")',
    enabled: overrides.enabled ?? true,
    deleted: overrides.deleted ?? false,
    status: overrides.status ?? 'idle',
    lastRun: overrides.lastRun !== undefined ? overrides.lastRun : null,
    lastStatus: overrides.lastStatus !== undefined ? overrides.lastStatus : null,
    lastError: overrides.lastError !== undefined ? overrides.lastError : null,
    deps: overrides.deps ?? [],
    createdAt: overrides.createdAt ?? dayjs().format(),
    updatedAt: overrides.updatedAt ?? dayjs().format(),
    ...overrides,
  };
}

/**
 * 创建多个Pipeline测试数据
 */
export function createPipelines(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => {
    const id = generateTestId();
    const uniqueId = parseInt(`6${String(id)}${String(index)}`.slice(-10));

    return createPipeline({
      id: overrides.id !== undefined ? (overrides.id as number) + index : uniqueId,
      name: `Pipeline ${String(index + 1)}`,
      eventName: index % 2 === 0 ? 'article|afterCreate' : 'article|afterUpdate',
      script: `console.log("pipeline ${String(index + 1)}")`,
      ...overrides,
    });
  });
}

/**
 * 创建Pipeline执行结果测试数据
 */
export function createPipelineExecutionResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: 'success',
    logs: ['Pipeline executed'],
    output: { result: 'test' },
    ...overrides,
  };
}

/**
 * 创建上传会话测试数据
 */
export function createUploadSession(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sessionId: 'upload-session-1',
    fileId: 1,
    filename: 'test.jpg',
    totalSize: 10485760, // 10MB
    chunkSize: 1048576, // 1MB
    chunkCount: 10,
    uploadedChunks: 0,
    createdAt: dayjs().format(),
    expiresAt: dayjs().add(1, 'hour').format(),
    ...overrides,
  };
}

/**
 * 创建Mock文件（Express FileType）用于单元测试
 */
export function createMockFile(overrides: Record<string, unknown> = {}): any {
  return {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    destination: '/uploads',
    filename: 'test-123456.jpg',
    path: '/uploads/test-123456.jpg',
    size: 2048,
    buffer: Buffer.from('fake image data'),
    ...overrides,
  };
}

/**
 * 创建多个Mock文件
 */
export function createMockFiles(count: number, overrides: Record<string, unknown> = {}): any[] {
  return Array.from({ length: count }, (_, i) =>
    createMockFile({
      originalname: `test${String(i + 1)}.jpg`,
      filename: `test-${String(i + 1)}-123456.jpg`,
      path: `/uploads/test-${String(i + 1)}-123456.jpg`,
      ...overrides,
    }),
  );
}

// ============ Legacy API (Backward Compatibility) ============

export const MockUtils = {
  createDatabaseMock,
  database: DatabaseMockBuilder,
  services: ServiceMockBuilder,
  data: TestDataFactory,
  testData: TestDataFactory,
  createTestModuleConfig,
  createTagServiceTestingModule,
  createBootstrapServiceTestingModule,
  createOptionsServiceTestingModule,
  createDatabaseServiceTestingModule,
};

// ============ New Flattened API ============

/**
 * Unified Mock API with flattened structure
 *
 * @example
 * // Database
 * const db = Mock.db().setQueryResult([...]).build();
 *
 * // Services
 * const config = Mock.config({ 'app.name': 'Test' });
 * const hook = Mock.hook();
 * const logger = Mock.logger();
 *
 * // Test Data
 * const user = Mock.user({ name: 'John' });
 * const articles = Mock.articles(5);
 *
 * // NestJS Tools
 * const context = Mock.context();
 * const module = Mock.testModule({ providers: [...] });
 */
export const Mock = {
  // ========== Database ==========
  /** Create DatabaseMockBuilder instance */
  db: (): DatabaseMockBuilder => new DatabaseMockBuilder(),

  // ========== NestJS Framework Mocks ==========
  /** Create Logger mock */
  logger: createLoggerMock,
  /** Create ExecutionContext mock */
  context: createExecutionContextMock,
  /** Create ExecutionContext mock (alias) */
  executionContext: createExecutionContextMock,
  /** Create ModuleRef mock */
  moduleRef: createModuleRefMock,
  /** Create Reflector mock */
  reflector: createReflectorMock,
  /** Create JwtService mock */
  jwt: createJwtServiceMock,

  // ========== Core Service Mocks ==========
  /** Create ConfigService mock */
  config: createConfigServiceMock,
  /** Create HookService mock */
  hook: createHookServiceMock,
  /** Create StorageService mock */
  storage: createStorageServiceMock,
  /** Create StorageFactoryService mock */
  storageFactory: createStorageFactoryServiceMock,
  /** Create StorageConfigService mock */
  storageConfig: createStorageConfigServiceMock,

  // ========== Business Service Mocks ==========
  /** Create UserService mock */
  userService: createUserServiceMock,
  /** Create PermissionService mock */
  permission: createPermissionServiceMock,
  /** Create ArticleService mock */
  articleService: createArticleServiceMock,
  /** Create CategoryService mock */
  categoryService: createCategoryServiceMock,
  /** Create TagService mock */
  tagService: createTagServiceMock,
  /** Create MediaService mock */
  mediaService: createMediaServiceMock,
  /** Create BackupService mock */
  backup: createBackupServiceMock,
  /** Create DraftService mock */
  draftService: createDraftServiceMock,
  /** Create DraftVersionService mock */
  draftVersionService: createDraftVersionServiceMock,
  /** Create DemoService mock */
  demo: createDemoServiceMock,
  /** Create PipelineService mock */
  pipelineService: createPipelineServiceMock,
  /** Create SitemapService mock */
  sitemap: createSitemapServiceMock,
  /** Create CommentService mock */
  commentService: createCommentServiceMock,
  /** Create MetaService mock */
  meta: createMetaServiceMock,
  /** Create BootstrapService mock */
  bootstrapService: createBootstrapServiceMock,

  // ========== Setting Service Mocks ==========
  /** Create SettingCoreService mock */
  settingCore: createSettingCoreServiceMock,
  /** Create SettingRegistryService mock */
  settingRegistry: createSettingRegistryServiceMock,

  // ========== Analytics Service Mocks ==========
  /** Create AnalyticsService mock */
  analytics: createAnalyticsServiceMock,
  /** Create ArticleStatsService mock */
  articleStatsService: createArticleStatsServiceMock,
  /** Create AnalyticsCacheService mock */
  analyticsCache: createAnalyticsCacheServiceMock,
  /** Create EchartsFormatterService mock */
  echartsFormatter: createEchartsFormatterServiceMock,
  /** Create PublicAnalyticsService mock */
  publicAnalytics: createPublicAnalyticsServiceMock,

  // ========== Shared Service Mocks ==========
  /** Create StatisticsService mock */
  statistics: createStatisticsServiceMock,
  /** Create QueryOptimizerService mock */
  queryOptimizer: createQueryOptimizerServiceMock,
  /** Create MarkdownService mock */
  markdown: createMarkdownServiceMock,
  /** Create ErrorRateMonitoringService mock */
  errorRateMonitoring: createErrorRateMonitoringServiceMock,

  // ========== Media Service Mocks ==========
  /** Create ImageProcessingService mock */
  imageProcessing: createImageProcessingServiceMock,
  /** Create ImageProcessingQueueService mock */
  imageProcessingQueue: createImageProcessingQueueServiceMock,

  // ========== Test Data Factories (Single) ==========
  /** Create single User test data */
  user: createUser,
  /** Create single Article test data */
  article: createArticle,
  /** Create single Article DTO test data */
  articleDto: createArticleDto,
  /** Create single Tag test data */
  tag: createTag,
  /** Create single Category test data */
  category: createCategory,
  /** Create single Comment test data */
  comment: createComment,
  /** Create single MediaFile test data */
  mediaFile: createMediaFile,
  /** Create single Draft test data */
  draft: createDraft,
  /** Create single DraftVersion test data */
  draftVersion: createDraftVersion,
  /** Create single Pipeline test data */
  pipeline: createPipeline,
  /** Create Pipeline execution result */
  pipelineExecutionResult: createPipelineExecutionResult,
  /** Create single Upload Session test data */
  uploadSession: createUploadSession,
  /** Create single Mock File (Express) */
  mockFile: createMockFile,
  /** Create single Analytics test data */
  analyticsData: createMockAnalytics,
  /** Create single Webhook test data */
  webhook: createMockWebhook,
  /** Create single PermissionGroup test data */
  permissionGroup: createMockPermissionGroup,

  // ========== Test Data Factories (Batch) ==========
  /** Create multiple User test data */
  users: (count: number, overrides?: Record<string, unknown>): ReturnType<typeof createUser>[] =>
    Array.from({ length: count }, (_, i) => createUser({ id: i + 1, ...overrides })),
  /** Create multiple Article test data */
  articles: createArticles,
  /** Create multiple Tag test data */
  tags: createTags,
  /** Create multiple Category test data */
  categories: createCategories,
  /** Create multiple MediaFile test data */
  mediaFiles: createMediaFiles,
  /** Create multiple Draft test data */
  drafts: createDrafts,
  /** Create multiple DraftVersion test data */
  draftVersions: createDraftVersions,
  /** Create multiple Pipeline test data */
  pipelines: createPipelines,
  /** Create multiple Mock Files (Express) */
  mockFiles: createMockFiles,

  // ========== Specialized Test Data ==========
  /** Create paginated result */
  paginated: createPaginatedResult,
  /** Create Waline setting test data */
  walineSetting: createWalineSetting,
  /** Create Analytics chart data */
  analyticsChart: createAnalyticsChartData,
  /** Create Device stats test data */
  deviceStats: createDeviceStats,
  /** Create Browser stats test data */
  browserStats: createBrowserStats,
  /** Create Article stats test data */
  articleStats: createArticleStats,
  /** Create Performance stats test data */
  performanceStats: createPerformanceStats,
  /** Create Health status test data */
  healthStatus: createHealthStatus,

  // ========== Testing Module Helpers ==========
  /** Create TestingModule config */
  testModule: createTestModuleConfig,
  /** Create TagService TestingModule */
  tagServiceModule: createTagServiceTestingModule,
  /** Create BootstrapService TestingModule */
  bootstrapServiceModule: createBootstrapServiceTestingModule,
  /** Create OptionsService TestingModule */
  optionsServiceModule: createOptionsServiceTestingModule,
  /** Create Database Service TestingModule */
  databaseServiceModule: createDatabaseServiceTestingModule,
};

// ============ Re-export Test Data Factories ============

/**
 * Re-export all factory functions from test-data.ts
 * These provide comprehensive test data factories for all database entities
 */
export * from './fixtures/test-data';
