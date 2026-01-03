# MockUtils 测试简化迁移指南

**版本**: 1.0
**目标**: 使用 MockUtils 统一测试模式，减少重复代码

---

## 📋 核心原则

1. **优先使用 MockUtils** - 避免手动创建 Mock 对象
2. **数据工厂优先** - 使用 `MockUtils.testData` 而非硬编码
3. **统一 Testing Module 配置** - 提取公共 provider 配置
4. **DatabaseMockBuilder 标准化** - 统一数据库 Mock 模式

---

## 🔧 四大简化模式

### Pattern 1: Mock Repository 创建

#### ❌ 避免：手动创建数据库 Mock

```typescript
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([mockData]),
};
```

#### ✅ 推荐：使用 DatabaseMockBuilder

```typescript
const dbMock = new DatabaseMockBuilder();
dbMock.setQueryResult([mockData]);
const mockDb = dbMock.build();
```

**高级用法**:

```typescript
// 多次查询
dbMock.setQueryResult([mockData1]).setQueryResult([mockData2]);

// 插入操作
dbMock.setInsertResult([insertedData]);

// 更新操作
dbMock.setUpdateResult([updatedData]);

// 删除操作
dbMock.setDeleteResult([deletedData]);
```

---

### Pattern 2: Testing Module 配置

#### ❌ 避免：重复的 providers 配置

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    MyService,
    { provide: DATABASE_CONNECTION, useValue: mockDb },
    { provide: ConfigService, useValue: mockConfig },
    { provide: HookService, useValue: mockHook },
  ],
}).compile();
```

#### ✅ 推荐：使用 MockUtils 辅助函数

**如果 MockUtils 已有 createTestingModule**:

```typescript
const module = await MockUtils.createTestingModule({
  providers: [MyService],
  mocks: {
    DATABASE_CONNECTION: mockDb,
    ConfigService: mockConfig,
    HookService: mockHook,
  },
}).compile();
```

**如果没有，创建模块级工厂函数**:

```typescript
// 在测试文件顶部创建
function createTestModule(overrides = {}) {
  const dbMock = new DatabaseMockBuilder();
  const mockHook = MockUtils.services.createHookServiceMock();
  const mockConfig = MockUtils.services.createConfigServiceMock();

  return Test.createTestingModule({
    providers: [
      MyService,
      { provide: DATABASE_CONNECTION, useValue: overrides.db || dbMock.build() },
      { provide: HookService, useValue: overrides.hook || mockHook },
      { provide: ConfigService, useValue: overrides.config || mockConfig },
    ],
  });
}

// 使用
const module = await createTestModule().compile();
```

---

### Pattern 3: 服务 Mock 创建

#### ❌ 避免：手动创建服务 Mock

```typescript
const mockMyService = {
  method1: vi.fn(),
  method2: vi.fn(),
  method3: vi.fn(),
  method4: vi.fn().mockResolvedValue(someData),
};
```

#### ✅ 推荐：使用 MockUtils.services 工厂

**已有的服务 Mock**:

```typescript
// 优先检查 test/mock-utils.ts 中是否已存在
const mockConfig = MockUtils.services.createConfigServiceMock();
const mockHook = MockUtils.services.createHookServiceMock();
const mockLogger = MockUtils.services.createLoggerMock();
const mockPermission = MockUtils.services.createPermissionServiceMock();
```

**创建新的服务 Mock**:

```typescript
// 在 test/mock-utils.ts 的 MockUtils.services namespace 中添加
export function createMyServiceMock(overrides: Partial<MyService> = {}): any {
  return {
    method1: vi.fn(),
    method2: vi.fn(),
    method3: vi.fn(),
    method4: vi.fn().mockResolvedValue(someDefaultData),
    ...overrides,
  };
}

// 使用
const mockService = MockUtils.services.createMyServiceMock({
  method4: vi.fn().mockResolvedValue(customData), // 覆盖默认值
});
```

---

### Pattern 4: 测试数据工厂

#### ❌ 避免：硬编码测试数据

```typescript
const mockArticle = {
  id: 1,
  title: 'Test Article',
  content: 'Test content',
  pathname: 'test-article',
  tags: ['tech', 'blog'],
  category: 'tech',
  author: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  // ... 15+ more fields
};

const mockArticles = [
  { id: 1, title: 'Article 1' /* ... */ },
  { id: 2, title: 'Article 2' /* ... */ },
  { id: 3, title: 'Article 3' /* ... */ },
];
```

#### ✅ 推荐：使用 MockUtils.testData 工厂

**已有的数据工厂**:

```typescript
// 优先检查 test/mock-utils.ts 中是否已存在
const article = MockUtils.testData.createArticle({ title: 'Custom Title' });
const articles = MockUtils.testData.createArticles(3); // 创建 3 篇文章
const user = MockUtils.testData.createUser({ username: 'testuser' });
const mediaFile = MockUtils.testData.createMediaFile();
```

**创建新的数据工厂**:

```typescript
// 在 test/mock-utils.ts 的 MockUtils.testData namespace 中添加
export function createMyEntity(overrides: Partial<MyEntity> = {}): MyEntity {
  return {
    id: 1,
    name: 'Test Entity',
    description: 'Test description',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isActive: true,
    ...overrides,
  };
}

// 批量创建版本
export function createMyEntities(count: number, overrides: Partial<MyEntity> = {}): MyEntity[] {
  return Array.from({ length: count }, (_, i) =>
    createMyEntity({ id: i + 1, name: `Test Entity ${i + 1}`, ...overrides }),
  );
}

// 使用
const entity = MockUtils.testData.createMyEntity({ name: 'Custom Name' });
const entities = MockUtils.testData.createMyEntities(5);
```

---

## 🎯 迁移步骤

### Step 1: 分析现有测试文件

1. 识别重复的 Mock 对象创建
2. 识别重复的 Testing Module 配置
3. 识别硬编码的测试数据
4. 检查是否已使用 DatabaseMockBuilder

### Step 2: 检查 MockUtils 可用工具

查看 `test/mock-utils.ts` 确认已有工具：

```typescript
// 已有的服务 Mock
MockUtils.services.createConfigServiceMock();
MockUtils.services.createHookServiceMock();
MockUtils.services.createLoggerMock();
MockUtils.services.createPermissionServiceMock();

// 已有的数据工厂
MockUtils.testData.createArticle();
MockUtils.testData.createUser();
MockUtils.testData.createMediaFile();

// 数据库工具
new DatabaseMockBuilder();
```

### Step 3: 扩展 MockUtils（如需要）

**添加新的服务 Mock**:

```typescript
// 在 test/mock-utils.ts 中
export namespace MockUtils {
  export namespace services {
    export function createNewServiceMock(overrides = {}): any {
      return {
        /* ... */
      };
    }
  }
}
```

**添加新的数据工厂**:

```typescript
// 在 test/mock-utils.ts 中
export namespace MockUtils {
  export namespace testData {
    export function createNewEntity(overrides = {}): Entity {
      return {
        /* ... */
      };
    }
  }
}
```

### Step 4: 逐步迁移测试文件

**优先级顺序**:

1. 替换数据库 Mock（Pattern 1）
2. 替换服务 Mock（Pattern 3）
3. 替换测试数据（Pattern 4）
4. 简化 Testing Module（Pattern 2）

### Step 5: 验证测试通过

```bash
# 运行单个测试文件
pnpm --filter @vanblog/server-ng test path/to/file.spec.ts

# 运行模块所有测试
pnpm --filter @vanblog/server-ng test src/modules/mymodule

# 运行完整测试套件
pnpm --filter @vanblog/server-ng test
```

---

## 📚 实战示例

### 示例 1: 简化 Service 测试

**Before**:

```typescript
describe('MyService', () => {
  let service: MyService;
  let mockDb: any;
  let mockConfig: any;
  let mockHook: any;

  beforeEach(async () => {
    // 手动创建所有 Mock
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 1, name: 'Test', createdAt: new Date() }]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue([{ id: 1 }]),
    };

    mockConfig = {
      get: vi.fn((key) => {
        if (key === 'app.name') return 'TestApp';
        return null;
      }),
    };

    mockHook = {
      applyFilters: vi.fn().mockImplementation((name, data) => data),
      doAction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
        { provide: HookService, useValue: mockHook },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should find item', async () => {
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, name: 'Test', createdAt: expect.any(Date) });
  });
});
```

**After** (减少 30+ 行):

```typescript
describe('MyService', () => {
  let service: MyService;
  let dbMock: DatabaseMockBuilder;

  beforeEach(async () => {
    // 使用 MockUtils
    dbMock = new DatabaseMockBuilder();
    dbMock.setQueryResult([MockUtils.testData.createMyEntity()]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: DATABASE_CONNECTION, useValue: dbMock.build() },
        {
          provide: ConfigService,
          useValue: MockUtils.services.createConfigServiceMock({ 'app.name': 'TestApp' }),
        },
        { provide: HookService, useValue: MockUtils.services.createHookServiceMock() },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should find item', async () => {
    const result = await service.findOne(1);
    expect(result).toEqual(expect.objectContaining({ id: 1, name: expect.any(String) }));
  });
});
```

---

### 示例 2: 简化 Controller 测试

**Before**:

```typescript
describe('MyController', () => {
  let controller: MyController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyController],
      providers: [{ provide: MyService, useValue: mockService }],
    }).compile();

    controller = module.get<MyController>(MyController);
  });

  it('should return all items', async () => {
    const mockItems = [
      { id: 1, name: 'Item 1', createdAt: '2024-01-01' },
      { id: 2, name: 'Item 2', createdAt: '2024-01-02' },
    ];
    mockService.findAll.mockResolvedValue(mockItems);

    const result = await controller.findAll();
    expect(result).toEqual(mockItems);
  });
});
```

**After** (减少 15+ 行):

```typescript
describe('MyController', () => {
  let controller: MyController;
  let mockService: any;

  beforeEach(async () => {
    mockService = MockUtils.services.createMyServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyController],
      providers: [{ provide: MyService, useValue: mockService }],
    }).compile();

    controller = module.get<MyController>(MyController);
  });

  it('should return all items', async () => {
    const mockItems = MockUtils.testData.createMyEntities(2);
    mockService.findAll.mockResolvedValue(mockItems);

    const result = await controller.findAll();
    expect(result).toEqual(mockItems);
  });
});
```

---

## 🚨 常见陷阱

### 陷阱 1: 过度使用 overrides

❌ **不好**:

```typescript
const article = MockUtils.testData.createArticle({
  id: 1,
  title: 'Title',
  content: 'Content',
  pathname: 'path',
  tags: ['tag1'],
  category: 'cat',
  author: 'admin',
  // ... 覆盖所有字段
});
```

✅ **更好**:

```typescript
// 只覆盖测试关注的字段
const article = MockUtils.testData.createArticle({
  title: 'Specific Title', // 只覆盖需要的
});
```

---

### 陷阱 2: 忘记重置 Mock

❌ **不好**:

```typescript
it('test 1', () => {
  mockService.method.mockResolvedValue(data1);
  // ...
});

it('test 2', () => {
  // mockService.method 仍然返回 data1！
});
```

✅ **更好**:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // 或在每个测试中重新设置
});

it('test 1', () => {
  mockService.method.mockResolvedValue(data1);
  // ...
});

it('test 2', () => {
  mockService.method.mockResolvedValue(data2); // 明确设置
  // ...
});
```

---

### 陷阱 3: DatabaseMockBuilder 链式调用顺序错误

❌ **不好**:

```typescript
dbMock.setQueryResult([data]);
const mockDb = dbMock.build();
dbMock.setInsertResult([inserted]); // 太晚了，已经 build 了！
```

✅ **更好**:

```typescript
dbMock.setQueryResult([data]).setInsertResult([inserted]);
const mockDb = dbMock.build();
```

---

## ✅ 检查清单

在完成迁移后，确认：

- [ ] 所有手动数据库 Mock 已替换为 DatabaseMockBuilder
- [ ] 所有手动服务 Mock 已使用 MockUtils.services 工厂
- [ ] 所有硬编码测试数据已使用 MockUtils.testData 工厂
- [ ] Testing Module 配置已提取公共部分
- [ ] 运行测试套件确认所有测试通过
- [ ] 代码行数显著减少（10-20%）
- [ ] 代码可读性提升
- [ ] 没有引入新的测试失败

---

## 📞 获取帮助

遇到问题？

1. 查看 `test/mock-utils.ts` 了解所有可用工具
2. 参考已简化的模块测试（如 `plugin` 模块）
3. 查看本指南的实战示例
4. 运行测试确认修改正确

---

**最后更新**: 2025-12-28
**维护者**: VanBlog Team
