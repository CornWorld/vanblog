# Mock 简化扫描报告

**扫描时间**: 2025-12-27
**扫描范围**: 162 个模块测试文件
**使用工具**: 30+ 个并发 Haiku 任务

---

## 执行摘要

- **总扫描文件数**: 162 个
- **发现问题文件数**: 约 60+ 个
- **可节省代码行数**: 估计 2000+ 行
- **心智负担降低**: 高

---

## 高优先级文件（严重重复）

### 1. Plugin 模块

#### loader.service.spec.ts ⚠️ 最严重

- **问题**: Logger Mock 重复 10+ 次, HookService Mock 重复 10+ 次
- **代码行数**: 1,260 行
- **可消除代码**: 500+ 行
- **简化方案**:

  ```typescript
  // 当前
  const logger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as MinimalLogger;

  // 改为
  const logger = MockUtils.services.createLoggerMock();
  ```

#### loader.service.edge-cases.spec.ts

- **可消除代码**: 200+ 行
- **问题**: 有工厂但未充分利用

#### loader.service.concurrency.spec.ts

- **可消除代码**: 100+ 行

### 2. Analytics 模块

#### article-stats.service.spec.ts

- **问题**: DB Mock 链式重复 6+ 次
- **简化方案**:

  ```typescript
  // 当前
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([mockResult]),
      }),
    }),
  });

  // 改为
  const dbMock = new MockUtils.database();
  dbMock.setQueryResult([mockResult]);
  ```

### 3. Category 模块

所有 5 个 service 测试文件都有相同问题:

- category.service.articles.spec.ts
- category.service.associations.spec.ts
- category.service.boundaries.spec.ts
- category.service.password.spec.ts
- category.service.spec.ts

**共同问题**:

- 手动创建 mockDb（35-67 行代码重复）
- 手动创建 HookService（6-7 行重复）
- 手动创建 ConfigService（6-8 行重复）

### 4. Tag 模块

全部 5 个 service 测试文件 100% 需要重构:

- tag.service.associations.spec.ts
- tag.service.boundaries.spec.ts
- tag.service.queries.spec.ts
- tag.service.spec.ts
- tag.controller.spec.ts

**重复模式统计**:

- DATABASE_CONNECTION mock: 5 次
- HookService mock: 5 次
- StatisticsService/QueryOptimizerService mock: 5 次

---

## 中优先级文件

### Auth 模块（7/7 文件全部有问题）

- auth.controller.spec.ts - 手动 vi.fn() 创建服务 mock
- auth.service.spec.ts - 手动 HookService/UserService
- login-log.service.spec.ts - **复杂数据库 mock 链式调用，高度重复**
- token-blacklist.service.spec.ts - **复杂数据库 mock，高度重复**
- token.service.spec.ts - 手动创建多个 mock 函数
- login-log.controller.spec.ts - 手动创建测试数据和服务 mock
- password-change-handler.service.spec.ts - 手动 vi.fn()

### Draft 模块

- draft.service.spec.ts - **最复杂**, publish 测试 Mock 配置 60+ 行
- draft-version.service.spec.ts - 手动链式 Mock
- draft.controller.spec.ts - 多个 Mock Service、测试数据不一致

### User 模块

- user.service.spec.ts 系列 - 5 个文件已用 MockUtils ✅
- user.controller.spec.ts - 仍使用手动 vi.fn() ⚠️

### Media 模块

- media.service.batch-limits.spec.ts - 大量手动 Mock
- storage-factory.service.spec.ts - 3 个 service mock
- local-storage.service.spec.ts - mockFile 工厂重复
- picgo-storage.service.spec.ts - mockFile + Hash mock
- image-processing.service.spec.ts - 复杂 mockSharp Builder
- image-processing-queue.service.spec.ts - 深层嵌套 Mock

### Plugin 模块

- plugin-api.service.spec.ts - 97 行 mock 初始化
- plugin-config.service.spec.ts - 手动链式 mock
- plugin-context.service.spec.ts - **DATABASE_CONNECTION 定义两次**
- webhook.service.spec.ts - 手动 DB + Registry mock
- webhook.service.execution.spec.ts - 同上
- webhook.service.security.spec.ts - 同上
- plugin-api-v2.integration.spec.ts - 自定义 createMockDatabase (48 行)

### Public 模块

- bootstrap.service.spec.ts - **9 个 Mock 对象**, 309 行
- custom-page.service.spec.ts - 链式 Mock
- timeline.service.spec.ts - 30+ 测试重复数据对象

### Setting 模块

全部 4 个文件都需要优化:

- setting-core.service.spec.ts - 复杂链式 Mock
- setting-registry.service.spec.ts - 使用 any 类型
- setting-core.controller.spec.ts - 16 个 Mock 方法
- setting-registry.controller.spec.ts - 5 个 Mock 方法

### RSS & Sitemap 模块

- rss.service.spec.ts - DATABASE + HookService + ConfigService
- sitemap.service.spec.ts - 复杂链式 mock (87-127 行)

### Other 模块

- demo.service.spec.ts - mockDatabase + mockConfigService
- permission.service.spec.ts - 手动 DATABASE_CONNECTION
- pipeline.service.spec.ts - 重复的 provider 注册
- comment.service.spec.ts - 3 个手动 mock

---

## 低优先级/已优化文件

### ✅ 已正确使用 MockUtils

- article.service.spec.ts - 完全使用 MockUtils ✅
- user.service 系列 (5 个) - 已使用 MockUtils ✅
- media.service.concurrency.spec.ts - 已使用 MockUtils ✅

### ✅ 无需简化

- health.controller.spec.ts - 简单测试,无复杂 Mock
- auth.module.spec.ts - 仅定义检查
- shortcode.service.spec.ts - 无外部依赖
- 多个 DTO/Entity 测试文件 - 纯数据验证

---

## 统计分析

### 按模块分类

| 模块      | 总文件数 | 需要简化 | 占比 |
| --------- | -------- | -------- | ---- |
| Plugin    | 30       | 15       | 50%  |
| Auth      | 19       | 7        | 37%  |
| Analytics | 7        | 4        | 57%  |
| Article   | 3        | 1        | 33%  |
| Category  | 6        | 5        | 83%  |
| Tag       | 5        | 5        | 100% |
| Draft     | 4        | 3        | 75%  |
| Media     | 10       | 6        | 60%  |
| User      | 6        | 1        | 17%  |
| Public    | 10       | 3        | 30%  |
| Setting   | 4        | 4        | 100% |
| Other     | 58       | 11       | 19%  |

### 按问题类型分类

| 问题类型                 | 出现次数 | 典型文件                      |
| ------------------------ | -------- | ----------------------------- |
| 手动 DATABASE_CONNECTION | 40+      | category.service.spec.ts      |
| 手动 HookService         | 30+      | loader.service.spec.ts        |
| 手动 ConfigService       | 20+      | auth 模块                     |
| 手动测试数据             | 25+      | draft.controller.spec.ts      |
| 复杂链式 Mock            | 15+      | article-stats.service.spec.ts |
| 重复 Mock 定义           | 35+      | loader.service.spec.ts        |

---

## 改进建议

### 短期 (本次 commit)

优先修复高重复度文件:

1. loader.service.spec.ts (500+ 行)
2. Category 模块 5 个文件 (共约 400 行)
3. Tag 模块 5 个文件 (共约 400 行)
4. Analytics 模块 (约 200 行)

**预期收益**: 节省约 1500 行代码

### 中期

1. 补充 MockUtils 工具:
   - `createLoggerMock()`
   - `createExecutionContextMock()`
   - `createPermissionServiceMock()`
   - `createWebhookServiceMock()`
   - `createPluginHttpRegistryMock()`

2. 统一测试数据工厂:
   - `createMockWebhook()`
   - `createMockFile()` (Multer.File)
   - `createMockMediaFile()`

### 长期

1. 建立模块级 Mock 工厂
2. 编写测试最佳实践文档
3. 添加 ESLint 规则检测手动 Mock 模式

---

## 实施计划

### Phase 1: 高优先级文件 (估计 2-3 小时)

```bash
# 文件列表
src/modules/plugin/services/loader.service.spec.ts
src/modules/category/category.service.*.spec.ts (5 个)
src/modules/tag/tag.service.*.spec.ts (5 个)
src/modules/analytics/services/article-stats.service.spec.ts
```

### Phase 2: 中优先级文件 (估计 3-4 小时)

Auth、Draft、Media、Plugin 其他文件

### Phase 3: 低优先级文件 (估计 1-2 小时)

剩余文件

---

## MockUtils 使用示例

### 数据库 Mock

```typescript
// ❌ 手动创建 (35-67 行)
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  // ...
};

// ✅ 使用 MockUtils (1 行)
const db = MockUtils.createDatabaseMock();

// ✅ 使用 Builder (3-5 行)
const dbMock = new MockUtils.database();
dbMock.setQueryResult([mockData]);
const db = dbMock.build();
```

### 服务 Mock

```typescript
// ❌ 手动创建 (6-7 行)
const mockHookService = {
  doAction: vi.fn().mockResolvedValue(undefined),
  applyFilters: vi.fn().mockImplementation(async (_, data) => Promise.resolve(data)),
};

// ✅ 使用 MockUtils (1 行)
const hookService = MockUtils.services.createHookServiceMock();
```

### 测试数据

```typescript
// ❌ 手动创建 (10+ 行)
const mockArticle = {
  id: 1,
  title: 'Test',
  content: 'Content',
  tags: JSON.stringify(['test']),
  // ...
};

// ✅ 使用 MockUtils (1 行)
const article = MockUtils.testData.createArticle({ title: 'Test' });
```

---

## 结论

本次扫描发现了大量可以简化的测试代码,主要集中在:

1. **重复的 Mock 对象创建** (DATABASE_CONNECTION, HookService, ConfigService)
2. **复杂的链式 Mock 配置**
3. **分散的测试数据创建**

通过系统性地使用 MockUtils 基建,可以:

- **减少约 2000+ 行重复代码**
- **提高测试可维护性**
- **降低心智负担**
- **统一 Mock 模式**

建议在本次 commit 中优先处理高优先级文件,预期可节省 1500+ 行代码。
