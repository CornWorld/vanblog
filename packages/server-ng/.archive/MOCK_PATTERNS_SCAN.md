# Auth Guards 测试文件 - Mock 对象模式扫描结果

扫描时间: 2025-12-27
扫描范围: 6 个 Auth Guard 测试文件
总发现问题文件数: 4

---

## 发现问题的文件列表

### 1. demo-mode.guard.spec.ts

**问题**: 手动创建 ConfigService Mock + ExecutionContext

**代码位置**: 第 13-27 行（ConfigService）, 第 34-43 行等（ExecutionContext）

**手动实现模式**:

```typescript
// 手动 Mock ConfigService
{
  provide: ConfigService,
  useValue: {
    get: vi.fn(),
  },
}

// 手动创建 ExecutionContext（5 次重复）
const mockContext = {
  getHandler: () => ({}),
  getClass: () => ({}),
  switchToHttp: () => ({
    getRequest: () => ({
      method: 'POST',
      url: '/api/v2/admin/users',
    }),
  }),
} as ExecutionContext;
```

**改进建议**:

- ConfigService: 使用 `MockUtils.services.createConfigServiceMock()`
- ExecutionContext: 提取到辅助函数（如 `createMockExecutionContext()`）

---

### 2. jwt-auth.guard.spec.ts

**问题**: 大量手动创建 ExecutionContext Mock

**代码位置**: 第 25-34 行等（出现 11 次）

**重复模式**:

```typescript
// 重复出现 11 次的模式
const mockContext = {
  switchToHttp: () => ({
    getRequest: () => ({
      headers: {
        authorization: 'Bearer ...',
      },
      user: { ... },
    }),
  }),
} as ExecutionContext;
```

**改进建议**:

- 创建通用的 `createMockExecutionContext()` 或 `createMockHttpContext()` 函数
- 将其放入 `test/mock-utils.ts` 的导出中

---

### 3. permissions.guard.spec.ts

**问题**: 手动创建 PermissionService Mock + ExecutionContext

**代码位置**: 第 16-19 行（Service Mock）, 第 43-51 行等（ExecutionContext）

**手动实现模式**:

```typescript
// 手动创建 Service Mock
const mockPermissionService = {
  hasPermissions: vi.fn(),
  resolvePermissionNames: vi.fn(),
};

// 手动创建 ExecutionContext（6 次重复）
const mockContext = {
  getHandler: () => ({}),
  getClass: () => ({}),
  switchToHttp: () => ({
    getRequest: () => ({
      user: { id: 1, username: 'testuser' },
    }),
  }),
} as ExecutionContext;
```

**改进建议**:

- PermissionService Mock: 添加到 `MockUtils.services` 中
- ExecutionContext: 提取到公共辅助函数

---

### 4. rate-limit.guard.spec.ts

**问题**: 手动创建 ConfigService Mock + ExecutionContext

**代码位置**: 第 29-45 行（ConfigService）, 第 74-85 行等（ExecutionContext）

**手动实现模式**:

```typescript
// 手动 Mock ConfigService（内联实现）
configService = {
  get: vi.fn((key: string, defaultValue?: any) => {
    const config: Record<string, any> = {
      'auth.rateLimit.userAttempts': 5,
      'auth.rateLimit.ipAttempts': 10,
      'auth.rateLimit.windowMinutes': 30,
    };
    return config[key] ?? defaultValue;
  }),
};

// 手动创建 ExecutionContext + 辅助函数（但重复实现）
const createMockContext = (body: any, ip = '127.0.0.1'): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        ip,
        socket: { remoteAddress: ip },
        headers: {},
      }),
    }),
  } as ExecutionContext;
};

// 重复定义：第 11-22 行与第 74-85 行相同
```

**改进建议**:

- ConfigService Mock: 使用已有的 `MockUtils.services.createConfigServiceMock()`
- ExecutionContext: 将 `createMockContext()` 函数提升到文件顶部或 `test/mock-utils.ts`

---

## 未发现问题的文件

### local-auth.guard.spec.ts

✅ **状态**: 已正确实现

**原因**: 只使用了手动创建的 ExecutionContext，但文件较小且无 ConfigService 依赖。相对可接受。

---

### roles.guard.spec.ts

✅ **状态**: 已正确实现

**原因**: 使用 `Reflector` 作为真实依赖，ExecutionContext Mock 数量适中，无 ConfigService 重复。

---

## 统计汇总

| 指标                         | 数值                      |
| ---------------------------- | ------------------------- |
| 扫描总文件数                 | 6                         |
| 发现问题文件数               | 4                         |
| ConfigService 手动 Mock 数量 | 3 处                      |
| ExecutionContext 重复定义数  | 27+ 次                    |
| Service 手动 Mock 数量       | 1 处（PermissionService） |

---

## 改进优先级

### 高优先级

1. **创建统一的 ExecutionContext 工厂函数** - 影响最广（27+ 处重复）
2. **使用 MockUtils.services.createConfigServiceMock()** - 配置服务标准化

### 中优先级

3. **为 PermissionService 添加 Mock 工厂** - 可复用（permission.guard.spec.ts）
4. **提取 createMockContext() 到 test/mock-utils.ts** - rate-limit.guard.spec.ts 优化

---

## 方案建议

创建以下辅助函数在 `test/mock-utils.ts` 中导出：

```typescript
/**
 * 创建基础 HTTP ExecutionContext Mock
 * @param config 自定义 request 属性
 */
export function createMockHttpExecutionContext(config: Record<string, any> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body: {},
        headers: {},
        ...config,
      }),
    }),
  } as ExecutionContext;
}

/**
 * 创建完整 ExecutionContext Mock（含 handler/class）
 */
export function createMockExecutionContext(config: Record<string, any> = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    ...createMockHttpExecutionContext(config),
  } as ExecutionContext;
}

/**
 * 为 PermissionService 创建 Mock
 */
export function createPermissionServiceMock(
  overrides: Record<string, any> = {},
): Partial<PermissionService> {
  return {
    hasPermissions: vi.fn().mockResolvedValue(true),
    resolvePermissionNames: vi.fn().mockReturnValue([]),
    ...overrides,
  };
}
```

然后在测试文件中使用：

```typescript
import {
  createMockExecutionContext,
  createConfigServiceMock,
  createPermissionServiceMock,
} from '../test/mock-utils';

// 在测试中直接使用
const mockContext = createMockExecutionContext({
  method: 'POST',
  url: '/api/v2/admin/users',
});

const configService = createConfigServiceMock({
  'auth.rateLimit.userAttempts': 5,
});

const permissionService = createPermissionServiceMock();
```
