import { describe, it, expect, beforeEach } from 'vitest';

import { MockUtils } from './mock-utils';

import type { DatabaseMockBuilder } from './mock-utils';

describe('MockUtils', () => {
  describe('DatabaseMockBuilder', () => {
    let databaseMock: DatabaseMockBuilder;

    beforeEach(() => {
      databaseMock = new MockUtils.database();
    });

    it('should create database mock with chained methods', () => {
      const db = databaseMock.build();

      expect(db.select).toBeDefined();
      expect(db.from).toBeDefined();
      expect(db.where).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();
    });

    it('should set query result correctly', () => {
      const testData = [{ id: 1, name: 'test' }];
      const db = databaseMock.setQueryResult(testData).build();

      expect(db.offset).toBeDefined();
      expect(db.limit).toBeDefined();
    });

    it('should set insert result correctly', () => {
      const testData = [{ id: 1, name: 'test' }];
      const db = databaseMock.setInsertResult(testData).build();

      expect(db.returning).toBeDefined();
    });

    it('should set count result correctly', () => {
      const db = databaseMock.setCountResult(5).build();

      expect(db.count).toBeDefined();
    });

    it('should reset mock correctly', () => {
      databaseMock.setQueryResult([{ id: 1 }]);
      databaseMock.reset();
      const db = databaseMock.build();

      expect(db.select).toBeDefined();
    });
  });

  describe('ServiceMockBuilder', () => {
    it('should create hook service mock', () => {
      const hookMock = MockUtils.services.createHookServiceMock();

      expect(hookMock.doAction).toBeDefined();
    });

    it('should create config service mock with custom config', () => {
      const configMap = { 'app.name': 'Test App', 'app.port': 3000 };
      const configMock = MockUtils.services.createConfigServiceMock(configMap);

      expect(configMock.get('app.name')).toBe('Test App');
      expect(configMock.get('app.port')).toBe(3000);
      expect(configMock.get('nonexistent', 'default')).toBe('default');
    });

    it('should create storage service mock', () => {
      const storageMock = MockUtils.services.createStorageServiceMock();

      expect(storageMock.upload).toBeDefined();
      expect(storageMock.delete).toBeDefined();
      expect(storageMock.getUrl).toBeDefined();
    });

    it('should create storage factory service mock', () => {
      const factoryMock = MockUtils.services.createStorageFactoryServiceMock();

      expect(factoryMock.getStorageService).toBeDefined();
    });
  });

  describe('TestDataFactory', () => {
    it('should create user test data', () => {
      const user = MockUtils.testData.createUser({ name: 'Custom User' });

      expect(user.id).toBe(1);
      expect(user.name).toBe('Custom User');
      expect(user.email).toBe('test@example.com');
    });

    it('should create article test data', () => {
      const article = MockUtils.testData.createArticle({ title: 'Custom Title' });

      expect(article.id).toBe(1);
      expect(article.title).toBe('Custom Title');
      expect(article.content).toBe('Test content');
    });

    it('should create media file test data', () => {
      const mediaFile = MockUtils.testData.createMediaFile({ filename: 'custom.jpg' });

      expect(mediaFile.id).toBe(1);
      expect(mediaFile.filename).toBe('custom.jpg');
      expect(mediaFile.mimetype).toBe('image/jpeg');
    });

    it('should create paginated result', () => {
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
