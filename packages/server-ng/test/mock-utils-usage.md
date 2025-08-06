# Mock工具类使用指南

本文档展示如何使用新的Mock工具类来简化测试配置。

## 基本用法

### 1. 导入Mock工具类

```typescript
import { MockUtils, DatabaseMockBuilder } from '../../../test/mock-utils';
```

### 2. 在测试中使用

```typescript
describe('YourService', () => {
  let service: YourService;
  let databaseMock: DatabaseMockBuilder;
  let mockPipelineService: Partial<PipelineService>;

  beforeEach(async () => {
    // 创建数据库Mock
    databaseMock = MockUtils.createDatabaseMock();

    // 创建服务Mock
    mockPipelineService = MockUtils.services.createPipelineServiceMock();

    // 使用完整的测试模块配置
    const moduleConfig = MockUtils.createTestModuleConfig({
      providers: [YourService],
      additionalProviders: [
        {
          provide: PipelineService,
          useValue: mockPipelineService,
        },
      ],
    });

    const module = await Test.createTestingModule(moduleConfig).compile();
    service = module.get<YourService>(YourService);
  });
});
```

## 数据库Mock使用

### 设置查询结果

```typescript
// 设置查询结果
const mockArticles = MockUtils.testData.createArticles(2);
databaseMock.setQueryResult(mockArticles);

// 设置计数结果
databaseMock.setCountResult(10);

// 设置插入结果
const newArticle = MockUtils.testData.createArticle({ id: 1 });
databaseMock.setInsertResult([newArticle]);

// 设置更新结果
const updatedArticle = MockUtils.testData.createArticle({ id: 1, title: 'Updated' });
databaseMock.setUpdateResult([updatedArticle]);
```

### 链式调用Mock

```typescript
// 数据库Mock支持链式调用
const result = await databaseMock.build().select().from('articles').where('id', '=', 1).limit(1);
```

## 服务Mock使用

### 预定义的服务Mock

```typescript
// PipelineService Mock
const mockPipelineService = MockUtils.services.createPipelineServiceMock();

// HookService Mock
const mockHookService = MockUtils.services.createHookServiceMock();

// ConfigService Mock
const mockConfigService = MockUtils.services.createConfigServiceMock();

// StorageService Mock
const mockStorageService = MockUtils.services.createStorageServiceMock();
```

### 自定义服务行为

```typescript
// 自定义PipelineService行为
const mockPipelineService = MockUtils.services.createPipelineServiceMock();
mockPipelineService.dispatchEvent = vi.fn().mockResolvedValue(['custom-result']);

// 自定义ConfigService行为
const mockConfigService = MockUtils.services.createConfigServiceMock();
mockConfigService.get = vi.fn().mockImplementation((key: string) => {
  if (key === 'database.url') return 'test-db-url';
  return 'default-value';
});
```

## 测试数据工厂使用

### 创建测试数据

```typescript
// 创建单个文章
const article = MockUtils.testData.createArticle({
  id: 1,
  title: 'Test Article',
  tags: ['test', 'mock'],
});

// 创建多个文章
const articles = MockUtils.testData.createArticles(5);

// 创建用户
const user = MockUtils.testData.createUser({
  id: 1,
  username: 'testuser',
});

// 创建媒体文件
const mediaFile = MockUtils.testData.createMediaFile({
  id: 1,
  filename: 'test.jpg',
  mimeType: 'image/jpeg',
});

// 创建分页结果
const paginatedResult = MockUtils.testData.createPaginatedResult(articles, {
  total: 10,
  page: 1,
  pageSize: 5,
});
```

### 创建DTO对象

```typescript
// 创建文章DTO
const articleDto = MockUtils.testData.createArticleDto({
  title: 'New Article',
  content: 'Article content',
  tags: JSON.stringify(['new']),
});
```

## 完整示例

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { MockUtils, DatabaseMockBuilder } from '../../../test/mock-utils';
import { ArticleService } from './article.service';
import { PipelineService } from '../pipeline/services/pipeline.service';

describe('ArticleService', () => {
  let service: ArticleService;
  let databaseMock: DatabaseMockBuilder;

  beforeEach(async () => {
    // 使用Mock工具类简化配置
    databaseMock = MockUtils.createDatabaseMock();

    const moduleConfig = MockUtils.createTestModuleConfig({
      providers: [ArticleService],
      additionalProviders: [
        {
          provide: PipelineService,
          useValue: MockUtils.services.createPipelineServiceMock(),
        },
      ],
    });

    const module = await Test.createTestingModule(moduleConfig).compile();
    service = module.get<ArticleService>(ArticleService);
  });

  describe('findAll', () => {
    it('should return paginated articles', async () => {
      // 使用测试数据工厂创建数据
      const mockArticles = MockUtils.testData.createArticles(2);

      // 设置Mock结果
      databaseMock.setQueryResult(mockArticles);
      databaseMock.setCountResult(2);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        data: mockArticles,
        total: 2,
        page: 1,
        pageSize: 10,
      });
    });
  });

  describe('create', () => {
    it('should create a new article', async () => {
      // 使用测试数据工厂创建数据
      const articleDto = MockUtils.testData.createArticleDto({
        title: 'New Article',
        content: 'New content',
      });

      const createdArticle = MockUtils.testData.createArticle({
        id: 1,
        title: articleDto.title,
        content: articleDto.content,
      });

      // 设置Mock结果
      databaseMock.setInsertResult([createdArticle]);
      databaseMock.setQueryResult([]); // 标签查询结果

      const result = await service.create(articleDto);

      expect(result).toEqual(createdArticle);
    });
  });
});
```

## 优势

1. **简化配置**: 减少重复的Mock设置代码
2. **类型安全**: 提供完整的TypeScript类型支持
3. **一致性**: 确保所有测试使用相同的Mock模式
4. **可维护性**: 集中管理Mock配置，便于维护和更新
5. **可读性**: 测试代码更加清晰和易读
6. **复用性**: Mock配置可以在多个测试文件中复用

## 迁移指南

### 从旧的Mock配置迁移

**旧方式:**

```typescript
mockDb = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  // ... 更多方法
};

Object.keys(mockDb).forEach((key) => {
  mockDb[key].mockReturnValue(mockDb);
});
```

**新方式:**

```typescript
databaseMock = MockUtils.createDatabaseMock();
```

**旧方式:**

```typescript
mockPipelineService = {
  dispatchEvent: vi.fn().mockResolvedValue([]),
};
```

**新方式:**

```typescript
mockPipelineService = MockUtils.services.createPipelineServiceMock();
```

通过使用Mock工具类，可以显著减少测试代码的复杂性，提高测试的可维护性和可读性。
