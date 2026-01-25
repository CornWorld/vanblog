# MockUtils UX 分析与改进方案

## 当前 API 分析

### 使用示例（现状）

```typescript
import { MockUtils } from '../../../test/mock-utils';

// ❌ 冗长且不一致
const dbMock = new MockUtils.database();
const hookService = MockUtils.services.createHookServiceMock();
const article = MockUtils.testData.createArticle();

// ❌ 命名空间重复
MockUtils.services.xxx;
MockUtils.testData.xxx;
MockUtils.database;

// ❌ 混合使用 class 和 factory
new MockUtils.database(); // class
MockUtils.services.createXxx(); // factory
```

## 改进方案：重命名为 Mock + 扁平化 API

### 目标

1. **简化命名**：MockUtils → Mock
2. **统一 API**：都使用工厂函数（可选 Builder）
3. **扁平化**：减少嵌套层级
4. **语义化**：清晰的命名约定

### 新 API 设计

```typescript
import { Mock } from '../../../test/mock';

// ✅ 数据库 Mock - 保留 Builder 模式
const db = Mock.db();
db.setQueryResult([...]).setInsertResult([...]).build();

// ✅ 服务 Mock - 扁平化
const config = Mock.config({ 'app.name': 'Test' });
const hook = Mock.hook();
const logger = Mock.logger();
const storage = Mock.storage();

// ✅ 测试数据 - 扁平化
const user = Mock.user({ name: 'John' });
const article = Mock.article({ title: 'Test' });
const category = Mock.category();

// ✅ 批量数据
const users = Mock.users(5);
const articles = Mock.articles(10);

// ✅ NestJS 工具
const context = Mock.executionContext({ request: {...} });
const module = Mock.testModule({ providers: [...] });
```

### API 对比

| 现状                                         | 改进后              | 改进说明          |
| -------------------------------------------- | ------------------- | ----------------- |
| `new MockUtils.database()`                   | `Mock.db()`         | 简化 6 字符       |
| `MockUtils.services.createConfigServiceMock` | `Mock.config()`     | 简化 22 字符      |
| `MockUtils.testData.createArticle()`         | `Mock.article()`    | 简化 15 字符      |
| `MockUtils.createTestModuleConfig`           | `Mock.testModule()` | 简化 16 字符      |
| `MockUtils.services.createHookServiceMock`   | `Mock.hook()`       | 简化 21 字符      |
| `MockUtils.testData.createPaginatedResult()` | `Mock.paginated()`  | 简化 19 字符      |
| `DatabaseMockBuilder`                        | `DatabaseBuilder`   | 保持 Builder 模式 |

### 命名规范

#### 数据库相关

- `Mock.db()` - 创建 DatabaseBuilder 实例

#### 服务相关（Service Mocks）

- `Mock.config()` - ConfigService
- `Mock.hook()` - HookService
- `Mock.logger()` - Logger
- `Mock.storage()` - StorageService
- `Mock.storageFactory()` - StorageFactoryService
- `Mock.markdown()` - MarkdownService
- `Mock.analytics()` - AnalyticsService
- `Mock.articleStats()` - ArticleStatsService
- `Mock.category()` / `Mock.categoryService()` - CategoryService
- `Mock.tag()` / `Mock.tagService()` - TagService
- `Mock.articleService()` - ArticleService
- `Mock.backup()` - BackupService
- `Mock.demo()` - DemoService
- `Mock.draft()` - DraftService
- `Mock.draftVersion()` - DraftVersionService
- `Mock.media()` / `Mock.mediaService()` - MediaService
- `Mock.pipeline()` - PipelineService
- `Mock.sitemap()` - SitemapService
- `Mock.comment()` - CommentService
- `Mock.statistics()` - StatisticsService
- `Mock.queryOptimizer()` - QueryOptimizerService
- `Mock.settingCore()` - SettingCoreService
- `Mock.settingRegistry()` - SettingRegistryService

#### 测试数据（Test Data）

- `Mock.user()` - 单个用户
- `Mock.users(n)` - n 个用户
- `Mock.article()` - 单个文章
- `Mock.articles(n)` - n 个文章
- `Mock.category()` - 单个分类
- `Mock.categories(n)` - n 个分类
- `Mock.tag()` - 单个标签
- `Mock.tags(n)` - n 个标签
- `Mock.mediaFile()` - 单个媒体文件
- `Mock.mediaFiles(n)` - n 个媒体文件
- `Mock.draft()` - 单个草稿
- `Mock.drafts(n)` - n 个草稿
- `Mock.draftVersion()` - 单个草稿版本
- `Mock.draftVersions(n)` - n 个草稿版本
- `Mock.pipeline()` - 单个 Pipeline
- `Mock.pipelines(n)` - n 个 Pipelines
- `Mock.uploadSession()` - 上传会话
- `Mock.mockFile()` - Express 文件对象
- `Mock.mockFiles(n)` - n 个文件对象
- `Mock.paginated()` - 分页结果
- `Mock.walineSetting()` - Waline 设置
- `Mock.analyticsChart()` - Analytics 图表数据
- `Mock.deviceStats()` - 设备统计
- `Mock.browserStats()` - 浏览器统计
- `Mock.articleStats()` - 文章统计
- `Mock.performanceStats()` - 性能统计
- `Mock.healthStatus()` - 健康状态

#### NestJS 工具

- `Mock.executionContext()` - ExecutionContext
- `Mock.moduleRef()` - ModuleRef
- `Mock.reflector()` - Reflector
- `Mock.testModule()` - TestingModule 配置

### 完整使用示例

```typescript
import { Mock } from '../../../test/mock';

describe('ArticleService', () => {
  let service: ArticleService;
  let db: any;

  beforeEach(async () => {
    // ✅ 简洁的 setup
    db = Mock.db().setQueryResult([Mock.article(), Mock.article()]).build();

    const module = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: HookService, useValue: Mock.hook() },
        { provide: ConfigService, useValue: Mock.config() },
      ],
    }).compile();

    service = module.get(ArticleService);
  });

  it('should find all articles', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(2);
  });
});
```

## 实施计划

### Phase 1: 重命名文件和主导出

1. ✅ `test/mock-utils.ts` → `test/mock.ts`
2. ✅ `test/mock-utils.spec.ts` → `test/mock.spec.ts`
3. ✅ 创建扁平化 API 导出
4. ⏳ 保留旧 API 兼容（过渡期）

### Phase 2: 更新所有测试文件导入

1. ⏳ 批量替换导入路径（78 处）
2. ⏳ 更新调用方式（简化 API）
3. ⏳ 验证所有测试通过

### Phase 3: 文档更新

1. ⏳ 更新 CLAUDE.md
2. ⏳ 更新 JSDoc 注释
3. ⏳ 添加迁移指南

### Phase 4: 清理

1. ⏳ 移除旧 API 兼容层
2. ⏳ 清理冗余命名空间
3. ⏳ 优化类型导出

## 预期收益

### 代码简化

- 平均每个测试文件减少 30-50 字符的导入和调用
- 78 个测试文件总计减少约 3000-4000 字符

### 可读性提升

- ✅ 更直观的 API（`Mock.user()` vs `MockUtils.testData.createUser()`）
- ✅ 更少的嵌套层级（1 层 vs 2-3 层）
- ✅ 更一致的命名风格（统一使用工厂函数）

### 维护性改善

- ✅ 扁平化结构更容易扩展
- ✅ 统一的工厂函数模式
- ✅ 更清晰的职责划分

## 命名冲突解决方案

### 问题：部分名称冲突

- `Mock.category()` - 既可能是 CategoryService，也可能是测试数据
- `Mock.tag()` - 既可能是 TagService，也可能是测试数据
- `Mock.article()` - 既可能是 ArticleService，也可能是测试数据

### 解决方案：约定优于配置

1. **无后缀** = 测试数据（最常用）
   - `Mock.user()` → 创建用户测试数据
   - `Mock.article()` → 创建文章测试数据

2. **Service 后缀** = Service Mock（需要时明确）
   - `Mock.userService()` → UserService Mock
   - `Mock.articleService()` → ArticleService Mock
   - `Mock.categoryService()` → CategoryService Mock

3. **批量数据** = 复数形式
   - `Mock.users(5)` → 5 个用户
   - `Mock.articles(10)` → 10 个文章

### 最终 API 映射表

| 功能             | API                       | 说明                  |
| ---------------- | ------------------------- | --------------------- |
| 数据库 Builder   | `Mock.db()`               | DatabaseBuilder       |
| 用户数据         | `Mock.user()`             | 单个用户测试数据      |
| 批量用户         | `Mock.users(n)`           | n 个用户              |
| UserService      | `Mock.userService()`      | UserService Mock      |
| 文章数据         | `Mock.article()`          | 单个文章测试数据      |
| 批量文章         | `Mock.articles(n)`        | n 个文章              |
| ArticleService   | `Mock.articleService()`   | ArticleService Mock   |
| 分类数据         | `Mock.category()`         | 单个分类测试数据      |
| CategoryService  | `Mock.categoryService()`  | CategoryService Mock  |
| Logger           | `Mock.logger()`           | Logger Mock           |
| ConfigService    | `Mock.config()`           | ConfigService Mock    |
| HookService      | `Mock.hook()`             | HookService Mock      |
| ExecutionContext | `Mock.context()`          | ExecutionContext Mock |
| 测试模块配置     | `Mock.testModule()`       | TestingModule 配置    |
| 分页结果         | `Mock.paginated()`        | 分页结果工厂          |
| Waline 设置      | `Mock.walineSetting()`    | Waline 设置测试数据   |
| 健康状态         | `Mock.healthStatus()`     | 系统健康状态测试数据  |
| 性能统计         | `Mock.performanceStats()` | 性能统计测试数据      |

## 迁移示例

### Before (旧 API)

```typescript
import { MockUtils } from '../../../test/mock-utils';

const db = new MockUtils.database();
db.setQueryResult([MockUtils.testData.createArticle()]);

const config = MockUtils.services.createConfigServiceMock({ 'app.name': 'Test' });
const hook = MockUtils.services.createHookServiceMock();
const logger = MockUtils.services.createLoggerMock();

const user = MockUtils.testData.createUser({ name: 'John' });
const articles = MockUtils.testData.createArticles(5);

const context = MockUtils.services.createExecutionContextMock();
```

### After (新 API)

```typescript
import { Mock } from '../../../test/mock';

const db = Mock.db();
db.setQueryResult([Mock.article()]);

const config = Mock.config({ 'app.name': 'Test' });
const hook = Mock.hook();
const logger = Mock.logger();

const user = Mock.user({ name: 'John' });
const articles = Mock.articles(5);

const context = Mock.context();
```

**字符数减少**: 从 470 字符 → 280 字符（减少 40%）
