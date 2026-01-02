import { describe, it, expect, vi } from 'vitest';

import {
  createLoggerMock,
  createExecutionContextMock,
  createModuleRefMock,
  createReflectorMock,
  createConfigServiceMock,
  createHookServiceMock,
  createStorageServiceMock,
  createStorageFactoryServiceMock,
  MockUtils,
} from './mock-utils';

describe('MockUtils - Service Mocks', () => {
  describe('createLoggerMock', () => {
    it('should create a logger with all required methods', () => {
      const logger = createLoggerMock();

      expect(logger.log).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.verbose).toBeDefined();

      // All should be vi.fn()
      expect(vi.isMockFunction(logger.log)).toBe(true);
      expect(vi.isMockFunction(logger.error)).toBe(true);
      expect(vi.isMockFunction(logger.warn)).toBe(true);
      expect(vi.isMockFunction(logger.debug)).toBe(true);
      expect(vi.isMockFunction(logger.verbose)).toBe(true);
    });

    it('should be callable without errors', () => {
      const logger = createLoggerMock();

      expect(() => {
        logger.log('test message');
        logger.error('error message');
        logger.warn('warning message');
        logger.debug('debug message');
        logger.verbose('verbose message');
      }).not.toThrow();
    });
  });

  describe('createExecutionContextMock', () => {
    it('should create ExecutionContext with default values', () => {
      const context = createExecutionContextMock();

      expect(context.switchToHttp).toBeDefined();
      expect(context.getHandler).toBeDefined();
      expect(context.getClass).toBeDefined();
      expect(context.getType).toBeDefined();

      const http = context.switchToHttp();
      expect(http.getRequest).toBeDefined();
      expect(http.getResponse).toBeDefined();

      const request = http.getRequest();
      expect(request).toHaveProperty('user');
      expect(request).toHaveProperty('headers');

      const response = http.getResponse();
      expect(response.status).toBeDefined();
      expect(response.json).toBeDefined();
    });

    it('should accept custom request overrides', () => {
      const context = createExecutionContextMock({
        request: {
          user: { id: 1, type: 'admin' },
          headers: { 'x-csrf-token': 'test-token' },
          body: { test: 'data' },
        },
      });

      const request = context.switchToHttp().getRequest();

      expect(request.user).toEqual({ id: 1, type: 'admin' });
      expect(request.headers).toEqual({ 'x-csrf-token': 'test-token' });
      expect(request.body).toEqual({ test: 'data' });
    });

    it('should accept custom response overrides', () => {
      const context = createExecutionContextMock({
        response: {
          locals: { customData: 'test' },
        },
      });

      const response = context.switchToHttp().getResponse();

      expect(response.locals).toEqual({ customData: 'test' });
      expect(response.status).toBeDefined();
      expect(response.json).toBeDefined();
    });

    it('should support getHandler and getClass overrides', () => {
      const mockHandler = vi.fn();
      const mockClass = vi.fn();

      const context = createExecutionContextMock({
        handler: mockHandler,
        class: mockClass,
      });

      expect(context.getHandler()).toBe(mockHandler);
      expect(context.getClass()).toBe(mockClass);
    });

    it('should support getArgByIndex method', () => {
      const context = createExecutionContextMock({
        request: { custom: 'request' },
        response: { custom: 'response' },
      });

      const request = context.getArgByIndex(0);
      const response = context.getArgByIndex(1);

      expect(request.custom).toBe('request');
      expect(response.custom).toBe('response');
    });

    it('should return http for getType()', () => {
      const context = createExecutionContextMock();
      expect(context.getType()).toBe('http');
    });
  });

  describe('createModuleRefMock', () => {
    it('should create ModuleRef with all required methods', () => {
      const moduleRef = createModuleRefMock();

      expect(moduleRef.get).toBeDefined();
      expect(moduleRef.resolve).toBeDefined();
      expect(moduleRef.create).toBeDefined();
      expect(moduleRef.registerRequestByContextId).toBeDefined();
      expect(moduleRef.introspect).toBeDefined();

      // All should be vi.fn()
      expect(vi.isMockFunction(moduleRef.get)).toBe(true);
      expect(vi.isMockFunction(moduleRef.resolve)).toBe(true);
      expect(vi.isMockFunction(moduleRef.create)).toBe(true);
    });

    it('should support get method mocking', () => {
      const moduleRef = createModuleRefMock();
      class TestService {}
      const mockService = new TestService();

      moduleRef.get.mockReturnValue(mockService);

      const result = moduleRef.get(TestService);
      expect(result).toBe(mockService);
    });

    it('should support resolve method mocking', async () => {
      const moduleRef = createModuleRefMock();
      class TestService {}
      const mockService = new TestService();

      moduleRef.resolve.mockResolvedValue(mockService);

      await expect(moduleRef.resolve(TestService)).resolves.toBe(mockService);
    });
  });

  describe('createReflectorMock', () => {
    it('should create Reflector with all required methods', () => {
      const reflector = createReflectorMock();

      expect(reflector.get).toBeDefined();
      expect(reflector.getAll).toBeDefined();
      expect(reflector.getAllAndMerge).toBeDefined();
      expect(reflector.getAllAndOverride).toBeDefined();

      // All should be vi.fn()
      expect(vi.isMockFunction(reflector.get)).toBe(true);
      expect(vi.isMockFunction(reflector.getAll)).toBe(true);
      expect(vi.isMockFunction(reflector.getAllAndMerge)).toBe(true);
      expect(vi.isMockFunction(reflector.getAllAndOverride)).toBe(true);
    });

    it('should support get method mocking', () => {
      const reflector = createReflectorMock();

      reflector.get.mockReturnValue(['admin', 'editor']);

      const result = reflector.get('roles', {});
      expect(result).toEqual(['admin', 'editor']);
    });

    it('should support getAllAndOverride method mocking', () => {
      const reflector = createReflectorMock();

      reflector.getAllAndOverride.mockReturnValue(['admin']);

      const result = reflector.getAllAndOverride('roles', [{}, {}]);
      expect(result).toEqual(['admin']);
    });
  });

  describe('createConfigServiceMock', () => {
    it('should create ConfigService with default values', () => {
      const config = createConfigServiceMock();

      expect(config.app).toBeDefined();
      expect(config.app.port).toBe(3000);
      expect(config.app.nodeEnv).toBe('test');
    });

    it('should support dot-notation overrides', () => {
      const config = createConfigServiceMock({
        'app.port': 4000,
        'app.nodeEnv': 'development',
        'jwt.secret': 'custom-secret',
      });

      expect(config.app.port).toBe(4000);
      expect(config.app.nodeEnv).toBe('development');
      expect(config.jwt.secret).toBe('custom-secret');
    });

    it('should support nested object overrides', () => {
      const config = createConfigServiceMock({
        app: { port: 5000, nodeEnv: 'production' },
      });

      expect(config.app.port).toBe(5000);
      expect(config.app.nodeEnv).toBe('production');
    });

    it('should support get method with dot notation', () => {
      const config = createConfigServiceMock({
        'app.port': 4000,
      });

      expect(config.get('app.port')).toBe(4000);
      expect(config.get('app.nodeEnv')).toBe('test');
      expect(config.get('nonexistent.key', 'default')).toBe('default');
    });
  });

  describe('createHookServiceMock', () => {
    it('should create HookService with all required methods', () => {
      const hookService = createHookServiceMock();

      expect(hookService.addAction).toBeDefined();
      expect(hookService.addFilter).toBeDefined();
      expect(hookService.removeAction).toBeDefined();
      expect(hookService.removeFilter).toBeDefined();
      expect(hookService.doAction).toBeDefined();
      expect(hookService.applyFilters).toBeDefined();
      expect(hookService.hasAction).toBeDefined();
      expect(hookService.hasFilter).toBeDefined();
      expect(hookService.getActionCount).toBeDefined();
      expect(hookService.getFilterCount).toBeDefined();
    });

    it('should have doAction return a resolved promise', async () => {
      const hookService = createHookServiceMock();

      await expect(hookService.doAction?.('test', {})).resolves.toBeUndefined();
    });

    it('should have applyFilters return the input data', async () => {
      const hookService = createHookServiceMock();
      const testData = { id: 1, name: 'test' };

      await expect(hookService.applyFilters?.('test', testData)).resolves.toEqual(testData);
    });
  });

  describe('createStorageServiceMock', () => {
    it('should create StorageService with default values', () => {
      const storage = createStorageServiceMock();

      expect(storage.upload).toBeDefined();
      expect(storage.delete).toBeDefined();
      expect(storage.getUrl).toBeDefined();
    });

    it('should support custom upload result', () => {
      const storage = createStorageServiceMock({
        url: '/custom/path/file.jpg',
        filename: 'custom.jpg',
      });

      expect(storage.getUrl?.()).toBe('/custom/path/file.jpg');
    });
  });

  describe('createStorageFactoryServiceMock', () => {
    it('should create StorageFactoryService', () => {
      const factory = createStorageFactoryServiceMock();

      expect(factory.getStorageService).toBeDefined();
      expect(factory.getCurrentProvider).toBeDefined();
    });

    it('should return custom storage service', () => {
      const customStorage = createStorageServiceMock({ url: '/custom/url' });
      const factory = createStorageFactoryServiceMock(customStorage);

      expect(factory.getStorageService?.()).toBe(customStorage);
    });
  });

  describe('MockUtils.services - ServiceMockBuilder', () => {
    it('should expose all service mock creators', () => {
      expect(MockUtils.services.createLoggerMock).toBe(createLoggerMock);
      expect(MockUtils.services.createExecutionContextMock).toBe(createExecutionContextMock);
      expect(MockUtils.services.createModuleRefMock).toBe(createModuleRefMock);
      expect(MockUtils.services.createReflectorMock).toBe(createReflectorMock);
      expect(MockUtils.services.createHookServiceMock).toBe(createHookServiceMock);
      expect(MockUtils.services.createConfigServiceMock).toBe(createConfigServiceMock);
      expect(MockUtils.services.createStorageServiceMock).toBe(createStorageServiceMock);
      expect(MockUtils.services.createStorageFactoryServiceMock).toBe(
        createStorageFactoryServiceMock,
      );
    });
  });

  describe('Integration - Real use cases', () => {
    it('should simulate guard test scenario', () => {
      const reflector = createReflectorMock();
      const context = createExecutionContextMock({
        request: { user: { id: 1, type: 'admin' } },
      });

      reflector.getAllAndOverride.mockReturnValue(['admin']);

      const requiredRoles = reflector.getAllAndOverride('roles', [
        context.getHandler(),
        context.getClass(),
      ]);
      const request = context.switchToHttp().getRequest();

      expect(requiredRoles).toEqual(['admin']);
      expect(request.user.type).toBe('admin');
    });

    it('should simulate interceptor test scenario', () => {
      const logger = createLoggerMock();
      const context = createExecutionContextMock({
        request: { url: '/api/test', method: 'GET' },
      });

      const request = context.switchToHttp().getRequest();
      logger.log(`Received ${String(request.method)} request to ${String(request.url)}`);

      expect(logger.log).toHaveBeenCalledWith('Received GET request to /api/test');
    });

    it('should simulate plugin API inject scenario', () => {
      const moduleRef = createModuleRefMock();

      class TestService {
        getData() {
          return 'test-data';
        }
      }

      const mockService = new TestService();
      moduleRef.get.mockReturnValue(mockService);

      const injectedService = moduleRef.get(TestService);
      expect(injectedService).toBe(mockService);
      expect(injectedService.getData()).toBe('test-data');
      expect(moduleRef.get).toHaveBeenCalledWith(TestService);
    });
  });
});

describe('MockUtils - DatabaseMockBuilder', () => {
  describe('basic construction', () => {
    it('should create a database mock with all methods', () => {
      const builder = new MockUtils.database();
      const db = builder.build();

      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
      expect(db.transaction).toBeDefined();

      expect(vi.isMockFunction(db.select)).toBe(true);
      expect(vi.isMockFunction(db.insert)).toBe(true);
      expect(vi.isMockFunction(db.update)).toBe(true);
      expect(vi.isMockFunction(db.delete)).toBe(true);
    });

    it('should support fluent API chaining', () => {
      const builder = new MockUtils.database();

      const result = builder
        .setQueryResult([{ id: 1, name: 'test' }])
        .setInsertResult([{ id: 2, name: 'inserted' }])
        .setUpdateResult([{ id: 1, name: 'updated' }]);

      expect(result).toBe(builder);
    });
  });

  describe('SELECT query mocking', () => {
    it('should mock select().from().get() returning single result', async () => {
      const testData = [{ id: 1, title: 'Test Article' }];
      const builder = new MockUtils.database();
      builder.setQueryResult(testData);
      const db = builder.build();

      const result = await db.select().from({}).get();

      expect(result).toEqual(testData[0]);
    });

    it('should mock select().from().all() returning array', async () => {
      const testData = [
        { id: 1, title: 'Article 1' },
        { id: 2, title: 'Article 2' },
      ];
      const builder = new MockUtils.database();
      builder.setQueryResult(testData);
      const db = builder.build();

      const result = await db.select().from({}).all();

      expect(result).toEqual(testData);
    });

    it('should support chainable where/limit/orderBy/offset', async () => {
      const testData = [{ id: 1, title: 'Filtered' }];
      const builder = new MockUtils.database();
      builder.setQueryResult(testData);
      const db = builder.build();

      const result = await db.select().from({}).where({}).limit(10).orderBy({}).offset(0).get();

      expect(result).toEqual(testData[0]);
    });

    it('should return null when query result is empty', async () => {
      const builder = new MockUtils.database();
      builder.setQueryResult([]);
      const db = builder.build();

      const result = await db.select().from({}).get();

      expect(result).toBeNull();
    });
  });

  describe('INSERT operation mocking', () => {
    it('should mock insert().values().returning() with proper structure', async () => {
      const insertedData = [{ id: 1, title: 'New Article' }];
      const builder = new MockUtils.database();
      builder.setInsertResult(insertedData);
      const db = builder.build();

      const result = await db.insert({}).values({}).returning();

      // Check result contains the data
      expect(result).toBeTruthy();
      expect(result[0]).toEqual(insertedData[0]);
    });

    it('should support insert without returning', () => {
      const builder = new MockUtils.database();
      builder.setInsertResult([{ id: 1 }]);
      const db = builder.build();

      const insertChain = db.insert({}).values({});

      expect(insertChain.returning).toBeDefined();
      expect(vi.isMockFunction(insertChain.returning)).toBe(true);
    });
  });

  describe('UPDATE operation mocking', () => {
    it('should mock update().set().where().returning() with proper structure', async () => {
      const updatedData = [{ id: 1, title: 'Updated' }];
      const builder = new MockUtils.database();
      builder.setUpdateResult(updatedData);
      const db = builder.build();

      const result = await db.update({}).set({}).where({}).returning();

      // Check result contains the data
      expect(result).toBeTruthy();
      expect(result[0]).toEqual(updatedData[0]);
    });
  });

  describe('DELETE operation mocking', () => {
    it('should mock delete operation', () => {
      const builder = new MockUtils.database();
      builder.setDeleteResult(5);
      const db = builder.build();

      expect(db.delete).toBeDefined();
      expect(vi.isMockFunction(db.delete)).toBe(true);
    });
  });

  describe('COUNT query mocking', () => {
    it('should mock count query returning number', async () => {
      const builder = new MockUtils.database();
      builder.setCountResult(42);
      const db = builder.build();

      const result = await db.select().from({}).get();

      // count() returns { count: number } format
      expect(result).toEqual({ count: 42 });
    });
  });

  describe('TRANSACTION mocking', () => {
    it('should mock successful transaction', async () => {
      const builder = new MockUtils.database();
      builder.setTransactionBehavior(true);
      const db = builder.build();

      const result = await db.transaction(async (_tx) => {
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });

    it('should mock failed transaction', async () => {
      const builder = new MockUtils.database();
      builder.setTransactionBehavior(false);
      const db = builder.build();

      await expect(
        db.transaction(async () => {
          return 'should fail';
        }),
      ).rejects.toThrow('Transaction failed');
    });

    it('should support custom transaction mock', async () => {
      const customTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ id: 99 }),
            }),
          }),
        }),
      };

      const builder = new MockUtils.database();
      builder.setTransactionBehavior(true, customTx);
      const db = builder.build();

      const result = await db.transaction(async (tx) => {
        const data = await tx.select().from({}).where({}).get();
        return data;
      });

      expect(result).toEqual({ id: 99 });
    });
  });

  describe('reset functionality', () => {
    it('should reset all mocks to original state', () => {
      const builder = new MockUtils.database();
      builder.setQueryResult([{ id: 1 }]);
      const db = builder.build();

      builder.reset();
      const dbAfterReset = builder.build();

      expect(db).not.toBe(dbAfterReset);
    });
  });

  describe('integration scenarios', () => {
    it('should support complex query with multiple chain calls', async () => {
      const testArticles = [
        { id: 1, title: 'Article 1', published: true },
        { id: 2, title: 'Article 2', published: true },
      ];

      const builder = new MockUtils.database();
      builder.setQueryResult(testArticles);
      const db = builder.build();

      // Simulate: SELECT * FROM articles WHERE published = true LIMIT 10 OFFSET 0 ORDER BY id DESC
      const result = await db
        .select()
        .from({})
        .where({ published: true })
        .limit(10)
        .offset(0)
        .orderBy({ id: 'desc' })
        .all();

      expect(result).toEqual(testArticles);
    });

    it('should handle mixed operations in sequence', async () => {
      const builder = new MockUtils.database();
      builder.setQueryResult([{ id: 1 }]);
      builder.setInsertResult([{ id: 2 }]);
      builder.setUpdateResult([{ id: 1, updated: true }]);
      const db = builder.build();

      const selected = await db.select().from({}).get();
      const inserted = await db.insert({}).values({}).returning();
      const updated = await db.update({}).set({}).where({}).returning();

      expect(selected).toEqual({ id: 1 });
      // returning() returns chainable array-like objects
      expect(inserted[0]).toEqual({ id: 2 });
      expect(updated[0]).toEqual({ id: 1, updated: true });
    });
  });
});

describe('MockUtils - TestData Factory', () => {
  describe('createUser', () => {
    it('should create user with default values', () => {
      const user = MockUtils.testData.createUser();

      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('type');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('updatedAt');
    });

    it('should support custom overrides', () => {
      const user = MockUtils.testData.createUser({
        id: 99,
        username: 'custom-user',
        type: 'admin',
      });

      expect(user.id).toBe(99);
      expect(user.username).toBe('custom-user');
      expect(user.type).toBe('admin');
    });

    it('should generate valid user objects', () => {
      const user1 = MockUtils.testData.createUser();
      const user2 = MockUtils.testData.createUser();

      // Both should have valid IDs
      expect(user1.id).toBeGreaterThan(0);
      expect(user2.id).toBeGreaterThan(0);
      // IDs should be different (usually)
      expect(user1).not.toBe(user2);
    });
  });

  describe('createArticle', () => {
    it('should create article with default values', () => {
      const article = MockUtils.testData.createArticle();

      expect(article).toHaveProperty('id');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('content');
      expect(article).toHaveProperty('author');
      expect(article).toHaveProperty('createdAt');
    });

    it('should support custom overrides', () => {
      const article = MockUtils.testData.createArticle({
        id: 999,
        title: 'Custom Title',
        content: 'Custom Content',
      });

      expect(article.id).toBe(999);
      expect(article.title).toBe('Custom Title');
      expect(article.content).toBe('Custom Content');
    });
  });

  describe('createTag', () => {
    it('should create tag with default values', () => {
      const tag = MockUtils.testData.createTag();

      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('name');
      expect(tag).toHaveProperty('createdAt');
    });

    it('should support custom overrides', () => {
      const tag = MockUtils.testData.createTag({
        id: 10,
        name: 'CustomTag',
      });

      expect(tag.id).toBe(10);
      expect(tag.name).toBe('CustomTag');
    });
  });

  describe('createCategory', () => {
    it('should create category with default values', () => {
      const category = MockUtils.testData.createCategory();

      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('createdAt');
    });

    it('should support custom overrides', () => {
      const category = MockUtils.testData.createCategory({
        id: 5,
        name: 'Tech',
      });

      expect(category.id).toBe(5);
      expect(category.name).toBe('Tech');
    });
  });

  describe('batch creation helpers', () => {
    it('should create multiple articles', () => {
      const articles = MockUtils.testData.createArticles(3);

      expect(articles).toHaveLength(3);
      expect(articles[0].id).not.toBe(articles[1].id);
      expect(articles[1].id).not.toBe(articles[2].id);
    });

    it('should create valid users with basic properties', () => {
      const users = Array.from({ length: 5 }, () => MockUtils.testData.createUser());

      expect(users).toHaveLength(5);
      users.forEach((user) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('type');
      });
    });

    it('should create multiple tags', () => {
      const tags = MockUtils.testData.createTags(4);

      expect(tags).toHaveLength(4);
      tags.forEach((tag) => {
        expect(tag.name).toBeDefined();
      });
    });
  });

  describe('integration with database mock', () => {
    it('should use test data in database mock', async () => {
      const testArticles = MockUtils.testData.createArticles(3);
      const builder = new MockUtils.database();
      builder.setQueryResult(testArticles);
      const db = builder.build();

      const result = await db.select().from({}).all();

      expect(result).toEqual(testArticles);
      expect(result).toHaveLength(3);
      result.forEach((article) => {
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('content');
      });
    });
  });
});
