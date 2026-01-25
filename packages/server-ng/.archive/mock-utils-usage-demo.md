# MockUtils Usage Demo - Before and After

This document demonstrates the improvements from adding new utility mock helpers to `test/mock-utils.ts`.

## 1. ExecutionContext Mocking

### Before (Repetitive - 10+ lines per test):

```typescript
it('should allow GET requests', () => {
  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
      }),
    }),
  } as ExecutionContext;

  const result = guard.canActivate(mockExecutionContext);
  expect(result).toBe(true);
});

it('should allow HEAD requests', () => {
  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'HEAD',
      }),
    }),
  } as ExecutionContext;

  const result = guard.canActivate(mockExecutionContext);
  expect(result).toBe(true);
});
```

### After (Using MockUtils - 3 lines per test):

```typescript
import { createExecutionContextMock } from '../../../test/mock-utils';

it('should allow GET requests', () => {
  const context = createExecutionContextMock({ request: { method: 'GET' } });
  const result = guard.canActivate(context);
  expect(result).toBe(true);
});

it('should allow HEAD requests', () => {
  const context = createExecutionContextMock({ request: { method: 'HEAD' } });
  const result = guard.canActivate(context);
  expect(result).toBe(true);
});
```

**Impact**: ~7 lines saved per test × 73 occurrences = **~500 lines eliminated**

---

## 2. Reflector Mocking

### Before (Manual mocking):

```typescript
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [RolesGuard, Reflector],
  }).compile();

  guard = module.get<RolesGuard>(RolesGuard);
  reflector = module.get<Reflector>(Reflector);
});

it('should return true when user has required role', () => {
  const mockContext = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 1, type: UserType.ADMIN },
      }),
    }),
  } as ExecutionContext;

  const requiredRoles = [UserType.ADMIN];
  vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

  const result = guard.canActivate(mockContext);
  expect(result).toBe(true);
});
```

### After (Using MockUtils):

```typescript
import { createReflectorMock, createExecutionContextMock } from '../../../test/mock-utils';

beforeEach(() => {
  reflector = createReflectorMock();
  guard = new RolesGuard(reflector);
});

it('should return true when user has required role', () => {
  const context = createExecutionContextMock({
    request: { user: { id: 1, type: UserType.ADMIN } },
  });

  reflector.getAllAndOverride.mockReturnValue([UserType.ADMIN]);

  const result = guard.canActivate(context);
  expect(result).toBe(true);
});
```

**Impact**: ~5 lines saved per test × 33 occurrences = **~165 lines eliminated**

---

## 3. ModuleRef Mocking

### Before (Manual mocking):

```typescript
const mockModuleRef = {
  get: vi.fn((_token: any) => {
    throw new Error('Service not found in ModuleRef');
  }),
} as any;
```

### After (Using MockUtils):

```typescript
import { createModuleRefMock } from '../../../test/mock-utils';

const mockModuleRef = createModuleRefMock();
mockModuleRef.get.mockImplementation((_token: any) => {
  throw new Error('Service not found in ModuleRef');
});
```

**Impact**: More consistent API, easier to extend with new methods

---

## 4. ConfigService Mocking

### Before (Manual config object):

```typescript
const configService = {
  get: vi.fn((_key: string, defaultValue?: any) => defaultValue),
} as unknown as ConfigService;
```

### After (Using MockUtils with full config support):

```typescript
import { createConfigServiceMock } from '../../../test/mock-utils';

// Option 1: Default config
const configService = createConfigServiceMock();

// Option 2: Custom config with dot-notation
const configService = createConfigServiceMock({
  'app.port': 4000,
  'jwt.secret': 'test-secret',
});

// Option 3: Nested object override
const configService = createConfigServiceMock({
  app: { port: 5000, nodeEnv: 'production' },
});

// Full ConfigService API available (app, database, jwt, cors, etc.)
expect(configService.app.port).toBe(4000);
expect(configService.get('app.port')).toBe(4000);
```

**Impact**: Better test data control, type-safe config access

---

## Summary of Benefits

| Utility                        | Occurrences | Lines Saved | Additional Benefits                    |
| ------------------------------ | ----------- | ----------- | -------------------------------------- |
| `createExecutionContextMock()` | 73+         | ~500        | Consistent API, easier to customize    |
| `createReflectorMock()`        | 33+         | ~165        | All Reflector methods mocked           |
| `createModuleRefMock()`        | 3+          | ~15         | Support for get/resolve/create         |
| `createConfigServiceMock()`    | Many        | ~100+       | Dot-notation, nested overrides         |
| `createLoggerMock()`           | Many        | ~50+        | All logger methods (log/warn/error...) |

**Total estimated impact**: ~830+ lines of repetitive mock code eliminated, with improved consistency and maintainability.

---

## Usage Pattern Recommendations

### 1. Guard Tests

```typescript
import { createExecutionContextMock, createReflectorMock } from '../../../test/mock-utils';

describe('MyGuard', () => {
  let guard: MyGuard;
  let reflector: ReturnType<typeof createReflectorMock>;

  beforeEach(() => {
    reflector = createReflectorMock();
    guard = new MyGuard(reflector);
  });

  it('should allow access when authorized', () => {
    const context = createExecutionContextMock({
      request: { user: { id: 1, type: 'admin' } },
    });

    reflector.get.mockReturnValue(['admin']);

    expect(guard.canActivate(context)).toBe(true);
  });
});
```

### 2. Interceptor Tests

```typescript
import { createExecutionContextMock, createLoggerMock } from '../../../test/mock-utils';

describe('MyInterceptor', () => {
  let interceptor: MyInterceptor;
  let logger: ReturnType<typeof createLoggerMock>;

  beforeEach(() => {
    logger = createLoggerMock();
    interceptor = new MyInterceptor(logger);
  });

  it('should log request details', () => {
    const context = createExecutionContextMock({
      request: { url: '/api/test', method: 'GET' },
    });

    const callHandler = { handle: vi.fn().mockReturnValue(of({})) };
    interceptor.intercept(context, callHandler);

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('GET /api/test'));
  });
});
```

### 3. Plugin API Tests

```typescript
import { createModuleRefMock, createConfigServiceMock } from '../../../test/mock-utils';

describe('PluginAPI', () => {
  let moduleRef: ReturnType<typeof createModuleRefMock>;
  let configService: ReturnType<typeof createConfigServiceMock>;

  beforeEach(() => {
    moduleRef = createModuleRefMock();
    configService = createConfigServiceMock({ 'plugin.enabled': true });
  });

  it('should inject service via ModuleRef', () => {
    class TestService {}
    const mockService = new TestService();

    moduleRef.get.mockReturnValue(mockService);

    const injected = moduleRef.get(TestService);
    expect(injected).toBe(mockService);
  });
});
```

---

## Migration Checklist

When refactoring existing tests to use the new utilities:

- [ ] Import utilities from `test/mock-utils`
- [ ] Replace manual ExecutionContext creation with `createExecutionContextMock()`
- [ ] Replace manual Reflector creation with `createReflectorMock()`
- [ ] Replace manual ModuleRef creation with `createModuleRefMock()`
- [ ] Replace manual ConfigService creation with `createConfigServiceMock()`
- [ ] Replace manual Logger creation with `createLoggerMock()`
- [ ] Run tests to verify behavior is unchanged
- [ ] Update test file documentation if needed
