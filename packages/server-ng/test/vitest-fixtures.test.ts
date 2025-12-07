import { dayjs } from '@vanblog/shared';
import { test as baseTest, vi } from 'vitest';

import { StorageProvider } from '../src/modules/media/dto/storage-config.dto';

import type { ConfigService } from '../src/config/config.service';
import type {
  StorageService,
  UploadResult,
} from '../src/modules/media/interfaces/storage.interface';
import type { StorageFactoryService } from '../src/modules/media/services/storage-factory.service';
import type { HookService } from '../src/modules/plugin/services/hook.service';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';

/**
 * 数据库Mock构建器 - 使用Vitest Fixtures模式
 */
class DatabaseMockBuilder {
  private mockDb!: Record<string, ReturnType<typeof vi.fn>>;

  constructor() {
    this.createMockDb();
  }

  /**
   * 获取Mock数据库实例
   */
  get db(): Record<string, ReturnType<typeof vi.fn>> {
    return this.mockDb;
  }

  /**
   * 设置查询结果
   */
  setQueryResult(data: unknown[]): this {
    const createQueryChain = (): Record<string, ReturnType<typeof vi.fn>> => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        rightJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        having: vi.fn().mockReturnThis(),
        // 新增：显式支持 get/all，兼容 MediaService.listFiles/count/getFileById 的 .get() 调用
        get: vi.fn().mockResolvedValue(Array.isArray(data) ? data[0] : (undefined as unknown)),
        all: vi.fn().mockResolvedValue(data),
      };

      // Make the chain thenable so it can be awaited directly
      Object.assign(mockChain, {
        then: async (resolve: (value: unknown) => void) => {
          resolve(data);
          return Promise.resolve(data);
        },
        catch: async () => Promise.resolve(data),
      });

      // Set up from method to return a thenable object
      mockChain.from.mockImplementation(() => {
        return {
          ...mockChain,
          then: async (resolve: (value: unknown) => void) => {
            resolve(data);
            return Promise.resolve(data);
          },
          catch: async () => Promise.resolve(data),
        } as unknown as ReturnType<typeof mockChain.from>;
      });

      return mockChain as unknown as Record<string, ReturnType<typeof vi.fn>>;
    };

    // 每次调用select都返回新的查询链
    this.mockDb.select.mockImplementation(() => createQueryChain());

    return this;
  }

  /**
   * 为不同的查询设置不同的结果
   */
  setMultipleQueryResults(results: { items: unknown[]; count: unknown[] }): this {
    let callCount = 0;

    // 创建查询链Mock，根据调用次数返回不同结果
    const createQueryChain = (): Record<string, ReturnType<typeof vi.fn>> => {
      const currentCallCount = callCount++;
      const result = currentCallCount === 0 ? results.items : results.count;

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          // 如果是count查询（第二个查询），返回带then方法的对象
          if (currentCallCount === 1) {
            return {
              ...mockChain,
              then: async (resolve: (value: unknown) => void) => {
                resolve(result);
                return Promise.resolve(result);
              },
              catch: async () => Promise.resolve(result),
            } as unknown as ReturnType<typeof mockChain.where>;
          }
          return mockChain as unknown as ReturnType<typeof mockChain.where>;
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockImplementation(() => {
          return {
            ...mockChain,
            then: async (resolve: (value: unknown) => void) => {
              resolve(result);
              return Promise.resolve(result);
            },
            catch: async () => Promise.resolve(result),
          } as unknown as ReturnType<typeof mockChain.offset>;
        }),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        rightJoin: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        having: vi.fn().mockReturnThis(),
        // 新增：显式支持 get/all
        get: vi.fn().mockResolvedValue(Array.isArray(result) ? result[0] : (undefined as unknown)),
        all: vi.fn().mockResolvedValue(result),
      };

      // 设置limit方法的特殊处理
      mockChain.limit.mockImplementation(() => {
        // limit后面通常跟offset，所以返回mockChain
        return mockChain as unknown as ReturnType<typeof mockChain.limit>;
      });

      // from 直接可 then（无 where 的 count 分支会用到 get()，无 then 也要保留可等待性）
      mockChain.from.mockImplementation(() => {
        return {
          ...mockChain,
          then: async (resolve: (value: unknown) => void) => {
            resolve(result);
            return Promise.resolve(result);
          },
          catch: async () => Promise.resolve(result),
        } as unknown as ReturnType<typeof mockChain.from>;
      });

      return mockChain as unknown as Record<string, ReturnType<typeof vi.fn>>;
    };

    // 每次调用select都返回新的查询链
    this.mockDb.select.mockImplementation(() => createQueryChain());

    return this;
  }

  /**
   * 设置插入结果
   */
  setInsertResult(data: unknown[]): this {
    // Create a chain that supports insert().values().returning()
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(data),
    };

    // Set up values to return the chain with returning
    insertChain.values.mockReturnValue({
      returning: vi.fn().mockResolvedValue(data),
    });

    this.mockDb.insert.mockReturnValue(
      insertChain as unknown as ReturnType<typeof this.mockDb.insert>,
    );
    return this;
  }

  /**
   * 设置更新结果
   */
  setUpdateResult(data: unknown[]): this {
    this.mockDb.update.mockReturnThis();
    this.mockDb.set.mockReturnThis();
    this.mockDb.where.mockReturnThis();
    this.mockDb.returning.mockResolvedValue(data);
    return this;
  }

  /**
   * 设置删除结果
   */
  setDeleteResult(returningData: unknown[] = []): this {
    this.mockDb.delete.mockReturnThis();
    this.mockDb.where.mockReturnThis();
    this.mockDb.returning.mockResolvedValue(returningData);
    return this;
  }

  /**
   * 设置计数结果
   */
  setCountResult(count: number): this {
    const countResult = [{ count }];

    // 创建一个模拟的count查询链
    const mockCountQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue(countResult),
    } as unknown as Record<string, ReturnType<typeof vi.fn>>;

    this.mockDb.count.mockReturnValue(
      mockCountQuery as unknown as ReturnType<typeof this.mockDb.count>,
    );
    return this;
  }

  /**
   * 设置事务行为
   */
  setTransactionBehavior(
    shouldSucceed: boolean,
    mockTx?: Record<string, ReturnType<typeof vi.fn>>,
  ): this {
    const transactionMock = this.mockDb.transaction;

    if (shouldSucceed) {
      transactionMock.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return await callback(mockTx ?? this.mockDb);
      });
    } else {
      transactionMock.mockRejectedValue(new Error('Transaction failed'));
    }

    return this;
  }

  /**
   * 构建Mock数据库实例
   */
  build(): Record<string, ReturnType<typeof vi.fn>> {
    return this.mockDb;
  }

  /**
   * 重置所有Mock
   */
  reset(): this {
    Object.values(this.mockDb).forEach((mockFn) => {
      mockFn.mockReset().mockReturnThis();
    });
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
      transaction: vi.fn(),
    } as unknown as Record<string, ReturnType<typeof vi.fn>>;

    // 设置默认的链式调用行为
    Object.entries(this.mockDb).forEach(([key, mockFn]) => {
      if (key === 'transaction') {
        // 设置 transaction 的默认行为：执行回调并返回结果
        mockFn.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          return await callback(this.mockDb);
        });
      } else {
        mockFn.mockReturnThis();
      }
    });
  }
}

/**
 * 创建用户测试数据
 */
function createUser({
  overrides = {},
}: {
  overrides?: Record<string, unknown>;
} = {}): Record<string, unknown> {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    nickname: 'Test User',
    avatar: '/avatars/default.png',
    createdAt: dayjs('2024-01-01').format(),
    updatedAt: dayjs('2024-01-01').format(),
    ...overrides,
  };
}

/**
 * 创建媒体文件测试数据
 */
function createMediaFile({
  overrides = {},
}: {
  overrides?: Record<string, unknown>;
} = {}): Record<string, unknown> {
  return {
    id: 1,
    filename: 'test-image.jpg',
    path: '/uploads/test-image.jpg',
    size: 1024,
    mimeType: 'image/jpeg',
    width: 1920,
    height: 1080,
    hash: 'abc123def456',
    provider: StorageProvider.LOCAL,
    createdAt: dayjs('2024-01-01').format(),
    ...overrides,
  };
}

/**
 * 创建多个媒体文件测试数据
 */
function createMediaFiles({
  count,
  overrides = {},
}: {
  count: number;
  overrides?: Record<string, unknown>;
}): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) =>
    createMediaFile({
      overrides: {
        id: index + 1,
        filename: `test-image-${String(index + 1)}.jpg`,
        path: `/uploads/test-image-${String(index + 1)}.jpg`,
        ...overrides,
      },
    }),
  );
}

/**
 * 创建分页结果
 */
function createPaginatedResult<T>({
  items,
  total,
  page = 1,
  pageSize = 10,
}: {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}): {
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
 * 测试数据工厂
 */
export const TestDataFactory = {
  createUser,
  createMediaFile,
  createMediaFiles,
  createPaginatedResult,
};

/**
 * 创建配置服务Mock
 */
function createConfigServiceMock(configMap: Record<string, unknown> = {}): ConfigService {
  return {
    get: vi.fn((key: string) => configMap[key]),
  } as unknown as ConfigService;
}

/**
 * 创建存储服务Mock
 */
function createStorageServiceMock({
  uploadResult = {},
}: {
  uploadResult?: Partial<UploadResult>;
} = {}): Partial<StorageService> {
  const defaultUploadResult: UploadResult = {
    filename: 'test-file.jpg',
    size: 1024,
    url: 'http://localhost:3000/uploads/test-file.jpg',
    mimeType: 'image/jpeg',
    ...uploadResult,
  };

  return {
    upload: vi.fn().mockResolvedValue(defaultUploadResult),
    delete: vi.fn().mockResolvedValue(true),
    getUrl: vi.fn().mockReturnValue('http://localhost:3000/uploads/test-file.jpg'),
  };
}

/**
 * 创建存储工厂服务Mock
 */
function createStorageFactoryServiceMock({
  storageService,
  provider = StorageProvider.LOCAL,
}: {
  storageService?: Partial<StorageService>;
  provider?: StorageProvider;
} = {}): Partial<StorageFactoryService> {
  return {
    getStorageService: vi.fn().mockResolvedValue(storageService),
    getCurrentProvider: vi.fn().mockResolvedValue(provider),
  };
}

/**
 * 创建钩子服务Mock
 */
function createHookServiceMock(): Partial<HookService> {
  return {
    addAction: vi.fn(),
    addFilter: vi.fn(),
    removeAction: vi.fn(),
    removeFilter: vi.fn(),
    doAction: vi.fn().mockResolvedValue(undefined),
    applyFilters: vi.fn().mockImplementation(async (_, value) => Promise.resolve(value)),
    hasAction: vi.fn().mockReturnValue(false),
    hasFilter: vi.fn().mockReturnValue(false),
    getActionCount: vi.fn().mockReturnValue(0),
    getFilterCount: vi.fn().mockReturnValue(0),
  };
}

/**
 * 服务Mock工厂
 */
export const ServiceMockFactory = {
  createConfigServiceMock,
  createStorageServiceMock,
  createStorageFactoryServiceMock,
  createHookServiceMock,
};

/**
 * Vitest测试上下文类型定义
 */
interface TestContext {
  // 数据库相关
  db: LibSQLDatabase;
  databaseMock: DatabaseMockBuilder;

  // 服务Mock
  storageService: Partial<StorageService>;
  storageFactoryService: Partial<StorageFactoryService>;
  configService: ConfigService;

  hookService: Partial<HookService>;

  // 测试数据
  testData: typeof TestDataFactory;

  // 工具方法
  resetAllMocks: () => void;
}

/**
 * 扩展的测试实例，包含所有必要的fixtures
 */
export const test = baseTest.extend<TestContext>({
  // 数据库Mock fixture
  /* eslint-disable-next-line no-empty-pattern */
  databaseMock: async ({}, use) => {
    const mockBuilder = new DatabaseMockBuilder();
    await use(mockBuilder);
    mockBuilder.reset();
  },

  db: async ({ databaseMock }, use) => {
    const db = databaseMock.build() as unknown as LibSQLDatabase;
    await use(db);
  },

  // 服务Mock fixtures
  /* eslint-disable-next-line no-empty-pattern */
  storageService: async ({}, use) => {
    const mock = ServiceMockFactory.createStorageServiceMock();
    await use(mock);
  },

  storageFactoryService: async ({ storageService }, use) => {
    const mock = ServiceMockFactory.createStorageFactoryServiceMock({ storageService });
    await use(mock);
  },

  /* eslint-disable-next-line no-empty-pattern */
  configService: async ({}, use) => {
    const mock = ServiceMockFactory.createConfigServiceMock();
    await use(mock);
  },

  /* eslint-disable-next-line no-empty-pattern */
  hookService: async ({}, use) => {
    const mock = ServiceMockFactory.createHookServiceMock();
    await use(mock);
  },

  // 测试数据工厂
  /* eslint-disable-next-line no-empty-pattern */
  testData: async ({}, use) => {
    await use(TestDataFactory);
  },

  // 工具方法
  /* eslint-disable-next-line no-empty-pattern */
  resetAllMocks: async ({}, use) => {
    const resetFn = (): void => {
      vi.clearAllMocks();
    };
    await use(resetFn);
  },
});

// 导出特定的测试函数
export const tagTest = test;
export const analyticsTest = test;
export const configTest = test;
export const mockUtilsTest = test;

// 导出类型和工厂类供其他地方使用
export { DatabaseMockBuilder };
export type { TestContext };
