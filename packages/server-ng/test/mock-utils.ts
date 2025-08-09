import dayjs from 'dayjs';
import { vi } from 'vitest';

import { StorageProvider } from '../src/modules/media/dto/storage-config.dto';

import type { ConfigService } from '../src/config/config.service';
import type {
  StorageService,
  UploadResult,
} from '../src/modules/media/interfaces/storage.interface';
import type { StorageFactoryService } from '../src/modules/media/services/storage-factory.service';
import type { HookService } from '../src/modules/plugin/services/hook.service';

/**
 * 数据库Mock工具类
 * 提供统一的数据库连接Mock配置
 */
export class DatabaseMockBuilder {
  private mockDb: Record<string, ReturnType<typeof vi.fn>> = {};

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
    // 创建完整的链式调用 mock
    const createChainMock = (
      finalData: unknown[],
    ): {
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      offset: ReturnType<typeof vi.fn>;
    } => {
      const chainMock = {
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
        offset: vi.fn(),
      };

      // 设置链式调用，每个方法都返回自身，最后返回数据
      chainMock.where.mockReturnValue(chainMock);
      chainMock.orderBy.mockReturnValue(chainMock);
      chainMock.limit.mockReturnValue(chainMock);
      chainMock.offset.mockResolvedValue(finalData);

      // 同时设置直接调用的情况
      chainMock.where.mockResolvedValue(finalData);
      chainMock.limit.mockResolvedValue(finalData);

      return chainMock;
    };

    // 重置并设置 select 方法
    this.mockDb.select.mockReset();
    this.mockDb.select.mockImplementation(() => {
      const fromMock = vi.fn();

      fromMock.mockImplementation(async (table) => {
        // 如果没有传入 table 参数，说明是 select().from(table) 的简单调用
        // 这种情况下直接返回 Promise
        if (table) {
          return Promise.resolve(data);
        }
        // 否则返回链式调用对象
        return createChainMock(data);
      });

      return { from: fromMock };
    });

    // 设置直接的 from() 调用
    this.mockDb.from.mockReturnValue(createChainMock(data));

    return this;
  }

  /**
   * 设置插入结果
   */
  setInsertResult(data: unknown[]): this {
    this.mockDb.returning.mockResolvedValue(data);
    return this;
  }

  /**
   * 设置更新结果
   */
  setUpdateResult(data: unknown[]): this {
    this.mockDb.returning.mockResolvedValue(data);
    return this;
  }

  /**
   * 设置删除结果
   */
  setDeleteResult(affectedRows = 1): this {
    this.mockDb.delete.mockResolvedValue({ affectedRows });
    return this;
  }

  /**
   * 设置计数结果
   */
  setCountResult(count: number): this {
    const countResult = [
      {
        count,
      },
    ];

    // 为count查询设置结果 - 需要在第二次调用时返回count结果
    this.mockDb.where.mockResolvedValueOnce([]); // 第一次调用返回空数组（主查询）
    this.mockDb.where.mockResolvedValueOnce(countResult); // 第二次调用返回count结果

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
    };

    // 设置链式调用
    Object.keys(this.mockDb).forEach((key) => {
      this.mockDb[key].mockReturnValue(this.mockDb);
    });
  }
}

/**
 * 服务Mock工具类
 * 提供常用服务的Mock配置
 */

/**
 * 创建HookService Mock
 */
export function createHookServiceMock(): Partial<HookService> {
  return {
    addAction: vi.fn(),
    addFilter: vi.fn(),
    removeAction: vi.fn(),
    removeFilter: vi.fn(),
    doAction: vi.fn().mockResolvedValue(undefined),
    applyFilters: vi.fn().mockImplementation(async (_, data) => Promise.resolve(data)),
    hasAction: vi.fn().mockReturnValue(false),
    hasFilter: vi.fn().mockReturnValue(false),
    getActionCount: vi.fn().mockReturnValue(0),
    getFilterCount: vi.fn().mockReturnValue(0),
  };
}

/**
 * 创建ConfigService Mock
 */
export function createConfigServiceMock(configMap: Record<string, unknown> = {}): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (configMap[key] !== undefined) {
        return configMap[key];
      }
      return defaultValue;
    }),
    configService: {},
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
export const ServiceMockBuilder = {
  createHookServiceMock,
  createConfigServiceMock,
  createStorageServiceMock,
  createStorageFactoryServiceMock,
};

/**
 * 测试数据工厂
 * 提供常用的测试数据模板
 */
/**
 * 创建用户测试数据
 */
export function createUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    username: 'testuser',
    nickname: 'Test User',
    email: 'test@example.com',
    type: 'admin',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    ...overrides,
  };
}

/**
 * 创建文章测试数据
 */
export function createArticle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    title: 'Test Article',
    content: 'Test content',
    tags: JSON.stringify(['test']),
    author: 'admin',
    top: 0,
    hidden: false,
    private: false,
    viewer: 10,
    pathname: null,
    category: null,
    password: null,
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    ...overrides,
  };
}

/**
 * 创建多个文章测试数据
 */
export function createArticles(
  count: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) =>
    createArticle({
      id: index + 1,
      title: `Test Article ${String(index + 1)}`,
      ...overrides,
    }),
  );
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
  return {
    id: 1,
    name: 'Test Tag',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    ...overrides,
  };
}

/**
 * 创建分类测试数据
 */
export function createCategory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    name: 'Test Category',
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    ...overrides,
  };
}

/**
 * 创建媒体文件测试数据
 */
export function createMediaFile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    filename: 'test.jpg',
    path: '/uploads/images/test.jpg',
    size: 1024,
    mimetype: 'image/jpeg',
    width: 1920,
    height: 1080,
    hash: 'testhash',
    provider: 'local',
    createdAt: dayjs().toISOString(),
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
  return Array.from({ length: count }, (_, index) =>
    createMediaFile({
      id: index + 1,
      filename: `test${String(index + 1)}.jpg`,
      path: `/uploads/images/test${String(index + 1)}.jpg`,
      ...overrides,
    }),
  );
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

export const TestDataFactory = {
  createUser,
  createArticle,
  createArticles,
  createArticleDto,
  createTag,
  createCategory,
  createMediaFile,
  createMediaFiles,
  createPaginatedResult,
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
      provide: 'DATABASE_CONNECTION',
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
 * Mock工具类
 * 提供统一的Mock工具访问入口
 */
export const MockUtils = {
  database: DatabaseMockBuilder,
  services: ServiceMockBuilder,
  data: TestDataFactory,
  testData: TestDataFactory,
  createTestModuleConfig,
};
