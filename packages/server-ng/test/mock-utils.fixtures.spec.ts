import { describe, expect } from 'vitest';

import { MockUtils, type DatabaseMockBuilder } from './mock-utils';
import { test } from './vitest-fixtures.test';

interface MockUtilsTestContext {
  databaseMockBuilder: DatabaseMockBuilder;
}

const mockUtilsTest = test.extend<MockUtilsTestContext>({
  databaseMockBuilder: async (_ctx, use) => {
    const databaseMockBuilder = new MockUtils.database();
    await use(databaseMockBuilder);
  },
});

describe('MockUtils', () => {
  describe('DatabaseMockBuilder', () => {
    mockUtilsTest('should create database mock with chained methods', ({ databaseMockBuilder }) => {
      const db = databaseMockBuilder.build();

      expect(db.select).toBeDefined();
      expect(db.from).toBeDefined();
      expect(db.where).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
    });

    mockUtilsTest('should set query result correctly', ({ databaseMockBuilder }) => {
      const testData = [{ id: 1, name: 'test' }];
      const db = databaseMockBuilder.setQueryResult(testData).build();

      expect(db.offset).toBeDefined();
      expect(db.limit).toBeDefined();
    });

    mockUtilsTest('should set insert result correctly', ({ databaseMockBuilder }) => {
      const testData = [{ id: 1, name: 'test' }];
      const db = databaseMockBuilder.setInsertResult(testData).build();

      expect(db.returning).toBeDefined();
    });

    mockUtilsTest('should set count result correctly', ({ databaseMockBuilder }) => {
      const db = databaseMockBuilder.setCountResult(5).build();

      expect(db.count).toBeDefined();
    });

    mockUtilsTest('should reset mock correctly', ({ databaseMockBuilder }) => {
      databaseMockBuilder.setQueryResult([{ id: 1 }]);
      databaseMockBuilder.reset();
      const db = databaseMockBuilder.build();

      expect(db.select).toBeDefined();
    });
  });

  describe('ServiceMockBuilder', () => {
    test('should create hook service mock', () => {
      const hookMock = MockUtils.services.createHookServiceMock();

      expect(hookMock.doAction).toBeDefined();
    });

    test('should create config service mock with custom config', () => {
      const configMap = { 'app.name': 'Test App', 'app.port': 3000 };
      const configMock = MockUtils.services.createConfigServiceMock(configMap);

      expect(configMock.get('app.name')).toBe('Test App');
      expect(configMock.get('app.port')).toBe(3000);
      expect(configMock.get('nonexistent', 'default')).toBe('default');
    });

    test('should create storage service mock', () => {
      const storageMock = MockUtils.services.createStorageServiceMock();

      expect(storageMock.upload).toBeDefined();
      expect(storageMock.delete).toBeDefined();
      expect(storageMock.getUrl).toBeDefined();
    });

    test('should create storage factory service mock', () => {
      const factoryMock = MockUtils.services.createStorageFactoryServiceMock();

      expect(factoryMock.getStorageService).toBeDefined();
    });
  });

  describe('TestDataFactory', () => {
    test('should create user test data', () => {
      const user = MockUtils.testData.createUser({ name: 'Custom User' });

      expect(user.id).toBe(1);
      expect(user.name).toBe('Custom User');
      expect(user.email).toBe('test@example.com');
    });

    test('should create article test data', () => {
      const article = MockUtils.testData.createArticle({ title: 'Custom Title' });

      expect(article.id).toBe(1);
      expect(article.title).toBe('Custom Title');
      expect(article.content).toBe('Test content');
    });

    test('should create media file test data', () => {
      const mediaFile = MockUtils.testData.createMediaFile({ filename: 'custom.jpg' });

      expect(mediaFile.id).toBe(1);
      expect(mediaFile.filename).toBe('custom.jpg');
      expect(mediaFile.mimetype).toBe('image/jpeg');
    });

    test('should create paginated result', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = MockUtils.testData.createPaginatedResult(items, 10, 1, 5);

      expect(result.items).toEqual(items);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBe(2);
    });
  });
});
