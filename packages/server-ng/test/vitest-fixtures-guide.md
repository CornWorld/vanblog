# Vitest Fixtures 测试架构指南

## 概述

本指南介绍了如何使用 Vitest 的 `test.extend` 功能来创建更加模块化、可重用和易维护的测试架构。这种方法受到 Playwright Fixtures 的启发，提供了一种声明式的方式来管理测试依赖和状态。

## 文件命名约定

根据项目的 ESLint 规则，我们采用以下命名约定：

- `.spec.ts` - 单元测试文件
- `.e2e-spec.ts` - 端到端测试文件
- `.test.ts` - 测试工具和 fixtures 文件

## 核心概念

### 1. Test Context (测试上下文)

测试上下文允许你定义可在测试中使用的工具、状态和固定装置：

```typescript
interface TestContext {
  db: LibSQLDatabase;
  databaseMock: DatabaseMockBuilder;
  storageService: Partial<StorageService>;
  testData: typeof TestDataFactory;
  resetAllMocks: () => void;
}
```

### 2. Fixtures (固定装置)

Fixtures 是可重用的测试依赖，会在测试运行前自动初始化，测试结束后自动清理：

```typescript
export const test = baseTest.extend<TestContext>({
  databaseMock: async ({}, use) => {
    const mockBuilder = new DatabaseMockBuilder();
    await use(mockBuilder);
    mockBuilder.reset(); // 自动清理
  },
});
```

## 使用方式

### 基础用法

```typescript
import { test } from '../../../test/vitest-fixtures.test';

test('should work with fixtures', ({ db, testData, databaseMock }) => {
  // 所有依赖都已自动注入
  const mockFile = testData.createMediaFile();
  databaseMock.setQueryResult([mockFile]);

  // 执行测试逻辑...
});
```

### 扩展 Fixtures

你可以基于现有的 fixtures 创建新的扩展：

```typescript
const mediaTest = test.extend({
  mediaService: async ({ db, storageFactoryService }, use) => {
    const service = new MediaService(db, storageFactoryService);
    await use(service);
  },
});
```

### 作用域值 (Scoped Values)

使用 `test.scoped` 为特定测试套件覆盖 fixture 值：

```typescript
describe('with S3 storage', () => {
  const s3Test = mediaTest.extend({
    storageFactoryService: async ({ storageService }, use) => {
      const mock = createS3StorageFactoryMock(storageService);
      await use(mock);
    },
  });

  s3Test('should use S3 provider', ({ storageFactoryService }) => {
    // 这里使用的是 S3 存储提供商
  });
});
```

### 自动化 Fixtures

标记为 `auto: true` 的 fixtures 会在每个测试中自动运行：

```typescript
const autoTest = test.extend({
  autoSetup: [
    async ({}, use) => {
      console.log('Setting up...');
      await use();
      console.log('Cleaning up...');
    },
    { auto: true },
  ],
});
```

## 优势对比

### 传统方式 vs Fixtures 方式

#### 传统方式的问题：

```typescript
// ❌ 传统方式 - 重复的设置代码
describe('MediaService', () => {
  let service: MediaService;
  let mockDb: DatabaseMockBuilder;
  let mockStorage: StorageService;

  beforeEach(() => {
    // 每个测试文件都要重复这些设置
    mockDb = new DatabaseMockBuilder();
    mockStorage = createStorageServiceMock();
    service = new MediaService(mockDb.build(), mockStorage);
  });

  afterEach(() => {
    // 手动清理
    vi.clearAllMocks();
  });
});
```

#### Fixtures 方式的优势：

```typescript
// ✅ Fixtures 方式 - 声明式、可重用
const mediaTest = test.extend({
  mediaService: async ({ db, storageFactoryService }, use) => {
    const service = new MediaService(db, storageFactoryService);
    await use(service);
    // 自动清理，无需手动管理
  },
});

mediaTest('should work', ({ mediaService, testData }) => {
  // 直接使用，无需设置
});
```

### 主要优势：

1. **依赖注入**: 自动管理测试依赖
2. **智能初始化**: 只初始化测试中实际使用的 fixtures
3. **自动清理**: 测试结束后自动清理资源
4. **类型安全**: 完整的 TypeScript 支持
5. **可组合性**: 可以轻松组合和扩展 fixtures
6. **并发安全**: 每个测试都有独立的上下文

## 最佳实践

### 1. 使用对象解构

```typescript
// ✅ 正确
test('should work', ({ db, testData }) => {
  // 使用对象解构访问 fixtures
});

// ❌ 错误
test('should work', (context) => {
  // 不要直接访问 context 对象
  context.db; // 这样不会触发 fixture 初始化
});
```

### 2. 合理组织 Fixtures

```typescript
// 基础 fixtures
const baseTest = test.extend({
  db: async ({ databaseMock }, use) => {
    /* ... */
  },
  testData: TestDataFactory,
});

// 服务层 fixtures
const serviceTest = baseTest.extend({
  mediaService: async ({ db, storageFactoryService }, use) => {
    /* ... */
  },
});

// 特定功能 fixtures
const uploadTest = serviceTest.extend({
  uploadConfig: { maxSize: 1024 * 1024 },
});
```

### 3. 使用默认值和注入

```typescript
const test = baseTest.extend({
  apiUrl: [
    '/api/v1', // 默认值
    { injected: true }, // 允许在配置中覆盖
  ],
});
```

## 迁移指南

### 从传统测试迁移到 Fixtures

1. **识别重复的设置代码**
2. **提取为 fixtures**
3. **更新测试以使用对象解构**
4. **移除手动的 beforeEach/afterEach**

### 示例迁移：

```typescript
// 迁移前
beforeEach(() => {
  mockDb = new DatabaseMockBuilder();
  service = new MediaService(mockDb.build());
});

it('should work', async () => {
  mockDb.setQueryResult([testData]);
  const result = await service.getFiles();
  expect(result).toEqual([testData]);
});

// 迁移后
mediaTest('should work', async ({ mediaService, databaseMock, testData }) => {
  const mockFile = testData.createMediaFile();
  databaseMock.setQueryResult([mockFile]);
  const result = await mediaService.getFiles();
  expect(result).toEqual([mockFile]);
});
```

## 总结

Vitest Fixtures 提供了一种现代化的测试架构方法，通过声明式的依赖管理和自动化的生命周期管理，显著提高了测试代码的质量和可维护性。建议在新的测试中采用这种模式，并逐步迁移现有的测试代码。
