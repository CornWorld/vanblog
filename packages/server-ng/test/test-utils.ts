import { users } from '@vanblog/shared/drizzle';
import { hash } from 'bcrypt';
import request from 'supertest';

import { DATABASE_CONNECTION } from '../src/database';

import type { INestApplication } from '@nestjs/common';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { Server } from 'http';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';

/**
 * 扩展 supertest 支持认证
 *
 * 添加 .auth(token) 方法用于自动设置 Authorization 头
 *
 * @example
 * await request(httpServer)
 *   .post('/api/v2/articles')
 *   .auth(authToken)
 *   .send({ title: 'Test' })
 *   .expect(201);
 */
declare module 'supertest' {
  interface Test {
    /**
     * 设置 Bearer Token 认证
     * @param token - JWT token
     */
    auth(token: string): this;
  }
}

// 实现 .auth() 方法
request.Test.prototype.auth = function (token: string) {
  return this.set('Authorization', `Bearer ${token}`);
};

/**
 * 测试 ID 生成器
 *
 * 使用简单的递增计数器为测试生成唯一 ID，避免使用 Date.now() 导致的时间戳混淆。
 * 这是所有测试工具的统一 ID 生成器，确保跨文件的 ID 唯一性。
 *
 * @example
 * const id1 = generateTestId(); // 1
 * const id2 = generateTestId(); // 2
 * const id3 = generateTestId(); // 3
 */
let testIdCounter = 1;
export function generateTestId(): number {
  return testIdCounter++;
}

/**
 * 重置测试 ID 计数器
 *
 * 在每个测试套件的 beforeEach 中调用，确保 ID 可预测。
 *
 * @example
 * // 在测试文件中
 * import { resetTestIdCounter } from './test-utils';
 *
 * beforeEach(() => {
 *   resetTestIdCounter();
 * });
 */
export function resetTestIdCounter(): void {
  testIdCounter = 1;
}

/**
 * 测试应用配置选项
 */
export interface TestAppOptions {
  /**
   * 是否启用完整配置（ValidationPipe、API 前缀、版本控制）
   * @default true
   */
  fullConfig?: boolean;

  /**
   * 是否覆盖 providers（用于 mock 服务）
   * @default []
   */
  overrideProviders?: Array<{ provide: any; useValue: any }>;
}

/**
 * 创建测试应用实例
 *
 * 统一的 E2E 测试应用工厂函数，消除重复的初始化代码。
 *
 * @param options - 配置选项
 * @returns NestJS 应用实例
 *
 * @example
 * // 使用完整配置（默认）
 * const app = await createTestApp();
 *
 * @example
 * // 使用简化配置
 * const app = await createTestApp({ fullConfig: false });
 *
 * @example
 * // 覆盖 providers
 * const app = await createTestApp({
 *   overrideProviders: [
 *     { provide: MyService, useValue: mockService }
 *   ]
 * });
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  const { fullConfig = true, overrideProviders = [] } = options;

  const appModule = AppModule.forRoot();
  let moduleBuilder = Test.createTestingModule({
    imports: [appModule],
  });

  // 应用 provider 覆盖
  for (const override of overrideProviders) {
    moduleBuilder = moduleBuilder.overrideProvider(override.provide).useValue(override.useValue);
  }

  const moduleFixture: TestingModule = await moduleBuilder.compile();
  const app = moduleFixture.createNestApplication();

  if (fullConfig) {
    // 完整配置：模拟生产环境
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const configService = app.get(ConfigService);
    const appConfig = configService.app;
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '2',
    });
  }

  await app.init();
  return app;
}

interface LoginResponse {
  token: string;
  access_token: string;
  user: unknown;
}

export async function createUser(
  app: INestApplication,
  userData = {
    username: 'testadmin',
    password: 'TestPassword123!',
    nickname: 'Test Admin',
    type: 'admin' as const,
  },
): Promise<void> {
  const db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);
  const hashedPassword = await hash(userData.password, 10);

  await db.insert(users).values({
    username: userData.username,
    password: hashedPassword,
    nickname: userData.nickname,
    type: userData.type,
    permissions: ['all'],
  });
}

// 添加：按需自定义权限创建用户的工具
export async function createUserWithPermissions(
  app: INestApplication,
  options: {
    username: string;
    password: string;
    nickname?: string;
    // 对齐 schema 支持的用户类型
    type?: 'admin' | 'editor' | 'author' | 'subscriber';
    permissions: string[];
  },
): Promise<void> {
  const {
    username,
    password,
    nickname = 'Test User',
    // 默认选择受限的普通角色，避免拥有隐式高权限
    type = 'author',
    permissions,
  } = options;

  const db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);
  const hashedPassword = await hash(password, 10);

  await db.insert(users).values({
    username,
    password: hashedPassword,
    nickname,
    type,
    permissions,
  });
}

export async function createAuthToken(
  app: INestApplication,
  credentials = {
    username: 'testadmin',
    password: 'TestPassword123!',
  },
): Promise<string> {
  const response = await request(app.getHttpServer() as Server)
    .post('/api/v2/auth/login')
    .send(credentials)
    .expect(200);

  const body = response.body as LoginResponse;
  return body.token;
}

/**
 * 自定义断言辅助函数
 */
export const assertions = {
  /**
   * 断言响应成功（200-299）
   */
  expectSuccess(status: number): void {
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
  },

  /**
   * 断言未授权（401 或 403）
   */
  expectUnauthorized(status: number): void {
    expect([401, 403]).toContain(status);
  },

  /**
   * 断言包含必要字段
   */
  expectHasFields<T extends Record<string, unknown>>(obj: T, fields: Array<keyof T>): void {
    fields.forEach((field) => {
      expect(obj).toHaveProperty(String(field));
      expect(obj[field]).toBeDefined();
    });
  },

  /**
   * 断言分页响应格式
   */
  expectPaginatedResponse(response: { data?: unknown; total?: unknown }): void {
    expect(response).toHaveProperty('data');
    expect(Array.isArray(response.data)).toBeTruthy();
    // 可选的分页元数据
    if (response.total !== undefined) {
      expect(typeof response.total).toBe('number');
    }
  },
};

/**
 * 数据清理辅助函数
 */
export async function cleanupTables(db: LibSQLDatabase, tables: Array<any>): Promise<void> {
  for (const table of tables) {
    await db.delete(table).execute();
  }
}

export async function cleanupDatabase(app: INestApplication): Promise<void> {
  try {
    const db = app.get<LibSQLDatabase>(DATABASE_CONNECTION);

    // Import all tables from schema
    const {
      analytics,
      loginLogs,
      staticFiles,
      draftVersions,
      drafts,
      articles,
      tags,
      categories,
      siteMeta,
      customPages,
      webhooks,
      webhookLogs,
      permissionNodes,
      permissionGroups,
    } = await import('@vanblog/shared/drizzle');

    // Delete test data in reverse order of dependencies
    await db.delete(analytics).execute();
    await db.delete(loginLogs).execute();
    await db.delete(staticFiles).execute();
    await db.delete(draftVersions).execute();
    await db.delete(drafts).execute();
    await db.delete(articles).execute();
    await db.delete(tags).execute();
    await db.delete(categories).execute();
    await db.delete(siteMeta).execute();
    await db.delete(customPages).execute();
    await db.delete(webhookLogs).execute(); // Delete logs before webhooks due to FK constraint
    await db.delete(webhooks).execute();

    await db.delete(permissionNodes).execute();
    await db.delete(permissionGroups).execute();
    await db.delete(users).execute();

    // Reset auto-increment sequences for tables with primary keys
    // This prevents SQLITE_CONSTRAINT_PRIMARYKEY errors in tests
    const { sql } = await import('drizzle-orm');
    await db.run(
      sql`DELETE FROM sqlite_sequence WHERE name IN ('analytics', 'loginLogs', 'staticFiles', 'draftVersions', 'drafts', 'articles', 'tags', 'categories', 'siteMeta', 'customPages', 'webhooks', 'webhookLogs', 'permissionNodes', 'permissionGroups')`,
    );
    await db.run(sql`DELETE FROM sqlite_sequence WHERE name = 'users'`);
  } catch {
    // Ignore errors during cleanup
  }
}
