# Mock API 迁移指南

**版本**: 1.0.0
**日期**: 2026-01-03
**状态**: ✅ 当前推荐

---

## 概述

MockUtils 已重构为更简洁的 Mock API。本指南帮助你从旧 API 迁移到新 API。

### 关键变化

| 方面         | 旧 API (MockUtils)                    | 新 API (Mock)       | 改进     |
| ------------ | ------------------------------------- | ------------------- | -------- |
| **导入路径** | `test/mock-utils`                     | `test/mock`         | 更简短   |
| **API 深度** | 3 层 (`MockUtils.services.createXxx`) | 1 层 (`Mock.xxx`)   | -67%     |
| **字符数**   | 平均 40+ 字符                         | 平均 15 字符        | -60%     |
| **方法数**   | 分散在多个命名空间                    | 80+ 方法集中在 Mock | 更易发现 |

---

## 快速迁移

### 1. 更新导入

```diff
- import { MockUtils } from '../test/mock-utils';
+ import { Mock } from '../test/mock';
```

### 2. 数据库 Mock

```diff
- const dbMock = new MockUtils.database();
- dbMock.setQueryResult([...]);
- const db = dbMock.build();
+ const db = Mock.db().setQueryResult([...]).build();
```

### 3. 服务 Mock

```diff
- const config = MockUtils.services.createConfigServiceMock({ 'app.port': 4000 });
+ const config = Mock.config({ 'app.port': 4000 });

- const hookService = MockUtils.services.createHookServiceMock();
+ const hookService = Mock.hook();

- const logger = MockUtils.services.createLoggerMock();
+ const logger = Mock.logger();
```

### 4. 测试数据

```diff
- const user = MockUtils.testData.createUser({ id: 1 });
+ const user = Mock.user({ id: 1 });

- const article = MockUtils.testData.createArticle({ title: 'Test' });
+ const article = Mock.article({ title: 'Test' });
```

### 5. 批量数据

```diff
- const users = Array.from({ length: 10 }, (_, i) =>
-   MockUtils.testData.createUser({ id: i + 1 })
- );
+ const users = Mock.users(10);
```

---

## 完整 API 对照表

### 数据库 Mock

| 旧 API                           | 新 API                 | 说明                |
| -------------------------------- | ---------------------- | ------------------- |
| `new MockUtils.database()`       | `Mock.db()`            | 创建数据库构建器    |
| `MockUtils.createDatabaseMock()` | `createDatabaseMock()` | 直接创建数据库 mock |

### NestJS 框架 Mock

| 旧 API                                            | 新 API                                        |
| ------------------------------------------------- | --------------------------------------------- |
| `MockUtils.services.createLoggerMock()`           | `Mock.logger()`                               |
| `MockUtils.services.createExecutionContextMock()` | `Mock.context()` 或 `Mock.executionContext()` |
| `MockUtils.services.createModuleRefMock()`        | `Mock.moduleRef()`                            |
| `MockUtils.services.createReflectorMock()`        | `Mock.reflector()`                            |

### 核心服务 Mock

| 旧 API                                                 | 新 API                  |
| ------------------------------------------------------ | ----------------------- |
| `MockUtils.services.createConfigServiceMock()`         | `Mock.config()`         |
| `MockUtils.services.createHookServiceMock()`           | `Mock.hook()`           |
| `MockUtils.services.createStorageServiceMock()`        | `Mock.storage()`        |
| `MockUtils.services.createStorageFactoryServiceMock()` | `Mock.storageFactory()` |
| `MockUtils.services.createStorageConfigServiceMock()`  | `Mock.storageConfig()`  |

### 业务服务 Mock (部分列表)

| 旧 API                                             | 新 API                   |
| -------------------------------------------------- | ------------------------ |
| `MockUtils.services.createUserServiceMock()`       | `Mock.userService()`     |
| `MockUtils.services.createPermissionServiceMock()` | `Mock.permission()`      |
| `MockUtils.services.createArticleServiceMock()`    | `Mock.articleService()`  |
| `MockUtils.services.createCategoryServiceMock()`   | `Mock.categoryService()` |
| `MockUtils.services.createTagServiceMock()`        | `Mock.tagService()`      |
| `MockUtils.services.createMediaServiceMock()`      | `Mock.mediaService()`    |

### 测试数据工厂

| 旧 API                                    | 新 API                |
| ----------------------------------------- | --------------------- |
| `MockUtils.testData.createUser()`         | `Mock.user()`         |
| `MockUtils.testData.createArticle()`      | `Mock.article()`      |
| `MockUtils.testData.createArticleDto()`   | `Mock.articleDto()`   |
| `MockUtils.testData.createTag()`          | `Mock.tag()`          |
| `MockUtils.testData.createCategory()`     | `Mock.category()`     |
| `MockUtils.testData.createMediaFile()`    | `Mock.mediaFile()`    |
| `MockUtils.testData.createDraft()`        | `Mock.draft()`        |
| `MockUtils.testData.createDraftVersion()` | `Mock.draftVersion()` |
| `MockUtils.testData.createPipeline()`     | `Mock.pipeline()`     |

### 批量数据工厂

| 旧 API                                | 新 API                              |
| ------------------------------------- | ----------------------------------- |
| 手动循环创建                          | `Mock.users(count, overrides)`      |
| `MockUtils.testData.createArticles()` | `Mock.articles(count, overrides)`   |
| 手动循环创建                          | `Mock.tags(count, overrides)`       |
| 手动循环创建                          | `Mock.categories(count, overrides)` |

### 专用数据工厂

| 旧 API                                          | 新 API                  |
| ----------------------------------------------- | ----------------------- |
| `MockUtils.testData.createPaginatedResult()`    | `Mock.paginated()`      |
| `MockUtils.testData.createWalineSetting()`      | `Mock.walineSetting()`  |
| `MockUtils.testData.createAnalyticsChartData()` | `Mock.analyticsChart()` |

---

## 实际迁移示例

### 示例 1: 简单服务测试

**旧代码**:

```typescript
import { MockUtils } from '../../../test/mock-utils';

describe('MyService', () => {
  let service: MyService;
  let mockConfig: ReturnType<typeof MockUtils.services.createConfigServiceMock>;
  let mockDb: any;

  beforeEach(() => {
    mockConfig = MockUtils.services.createConfigServiceMock({
      'app.port': 3000,
    });

    const dbBuilder = new MockUtils.database();
    dbBuilder.setQueryResult([]);
    mockDb = dbBuilder.build();

    service = new MyService(mockConfig, mockDb);
  });

  it('should work', () => {
    expect(service).toBeDefined();
  });
});
```

**新代码**:

```typescript
import { Mock } from '../../../test/mock';

describe('MyService', () => {
  let service: MyService;
  let mockConfig: ReturnType<typeof Mock.config>;
  let mockDb: any;

  beforeEach(() => {
    mockConfig = Mock.config({ 'app.port': 3000 });
    mockDb = Mock.db().setQueryResult([]).build();
    service = new MyService(mockConfig, mockDb);
  });

  it('should work', () => {
    expect(service).toBeDefined();
  });
});
```

### 示例 2: 复杂测试数据

**旧代码**:

```typescript
import { MockUtils } from '../../../test/mock-utils';

const users = Array.from({ length: 10 }, (_, i) =>
  MockUtils.testData.createUser({
    id: i + 1,
    username: `user${i + 1}`,
  }),
);

const articles = users.map((user) =>
  MockUtils.testData.createArticle({
    author: user.id,
    title: `Article by ${user.username}`,
  }),
);
```

**新代码**:

```typescript
import { Mock } from '../../../test/mock';

const users = Mock.users(10).map((user, i) => ({
  ...user,
  username: `user${i + 1}`,
}));

const articles = users.map((user) =>
  Mock.article({
    author: user.id,
    title: `Article by ${user.username}`,
  }),
);
```

### 示例 3: 数据库 Mock 链式调用

**旧代码**:

```typescript
const dbBuilder = new MockUtils.database();
dbBuilder.setQueryResult([mockUser]);
dbBuilder.setInsertResult([{ id: 1 }]);
dbBuilder.setUpdateResult([{ id: 1, updated: true }]);
dbBuilder.setCountResult(5);
const db = dbBuilder.build();
```

**新代码**:

```typescript
const db = Mock.db()
  .setQueryResult([mockUser])
  .setInsertResult([{ id: 1 }])
  .setUpdateResult([{ id: 1, updated: true }])
  .setCountResult(5)
  .build();
```

---

## 向后兼容性

### 渐进式迁移

旧 API 仍然可用，你可以选择渐进式迁移：

```typescript
// 新旧 API 可以共存
import { Mock, MockUtils } from '../test/mock';

// 使用新 API
const user = Mock.user();

// 使用旧 API（仍然有效）
const article = MockUtils.testData.createArticle();
```

### 何时需要使用旧 API

- **向后兼容**: 如果你的代码库尚未完全迁移
- **类型引用**: 某些情况下需要直接引用类（如 `DatabaseMockBuilder`）

```typescript
import { Mock, DatabaseMockBuilder } from '../test/mock';

// 类型注解需要 DatabaseMockBuilder
let dbMock: InstanceType<typeof DatabaseMockBuilder>;

beforeEach(() => {
  dbMock = Mock.db(); // 使用新 API 创建
});
```

---

## 迁移检查清单

- [ ] 更新导入路径 (`mock-utils` → `mock`)
- [ ] 替换数据库 Mock API (`new MockUtils.database()` → `Mock.db()`)
- [ ] 替换服务 Mock API (`MockUtils.services.createXxx` → `Mock.xxx`)
- [ ] 替换测试数据 API (`MockUtils.testData.createXxx` → `Mock.xxx`)
- [ ] 使用批量工厂替代手动循环
- [ ] 运行测试验证
- [ ] 更新团队文档

---

## 常见问题

### Q1: 为什么要迁移？

**A**: 新 API 提供：

- 更简洁的语法（减少 40-70% 字符）
- 更好的开发体验（扁平化结构）
- 更快的开发速度（更少的嵌套）
- 保持向后兼容

### Q2: 旧 API 何时会被移除？

**A**: 目前没有移除计划。旧 API 将保持可用以支持渐进式迁移。

### Q3: 如何处理类型错误？

**A**: 确保导入必要的类型：

```typescript
import { Mock, DatabaseMockBuilder, createDatabaseMock } from '../test/mock';

// 类型注解
let db: ReturnType<typeof createDatabaseMock>;
let builder: InstanceType<typeof DatabaseMockBuilder>;
```

### Q4: 批量迁移工具？

**A**: 可以使用 sed/find 进行批量替换：

```bash
# 更新导入
find . -name "*.spec.ts" -exec sed -i '' 's/mock-utils/mock/g' {} \;

# 更新 API 调用
find . -name "*.spec.ts" -exec sed -i '' 's/new MockUtils\.database()/Mock.db()/g' {} \;
```

### Q5: 如何验证迁移？

**A**: 运行测试套件：

```bash
# 运行所有测试
pnpm test

# 检查特定模块
pnpm test src/modules/my-module
```

---

## 获取帮助

- **文档**: [MOCK_REFACTORING_SUMMARY.md](../MOCK_REFACTORING_SUMMARY.md)
- **API 参考**: 查看 `test/mock.ts` 中的 JSDoc 注释
- **示例**: 查看现有测试文件中的用法

---

## 相关文档

- [测试组织指南](./TEST_ORGANIZATION_GUIDE.md)
- [测试快速参考](./TEST_QUICK_REFERENCE.md)
- [Mock 重构总结](../MOCK_REFACTORING_SUMMARY.md)
