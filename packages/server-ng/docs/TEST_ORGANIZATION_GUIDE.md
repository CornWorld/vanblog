# 测试文件组织规范

**最后更新**: 2025-12-25
**版本**: 1.0.0

---

## 📋 目录

- [核心原则](#核心原则)
- [文件命名规范](#文件命名规范)
- [目录结构规范](#目录结构规范)
- [测试分类规范](#测试分类规范)
- [常见误区](#常见误区)
- [迁移指南](#迁移指南)

---

## 核心原则

### 1. 一对一原则

**每个源文件只能有一个对应的测试文件**

```
✅ 正确：
src/modules/media/media.service.ts
src/modules/media/media.service.spec.ts

❌ 错误：
src/modules/media/media.service.ts
src/modules/media/media.service.spec.ts       # 基础测试
src/modules/media/media.service.basic.spec.ts # 重复！
```

### 2. 就近原则

**测试文件必须与源文件在同一目录**

```
✅ 正确：
src/modules/media/services/media.service.ts
src/modules/media/services/media.service.spec.ts

❌ 错误：
src/modules/media/services/media.service.ts
src/modules/media/media.service.spec.ts  # 父目录 - 误导！
```

### 3. 场景拆分原则

**如果测试文件过大（>800 行），按场景拆分，使用描述性后缀**

```
✅ 正确（场景拆分）：
src/modules/media/media.service.ts
src/modules/media/media.service.spec.ts               # 核心 CRUD (500 行)
src/modules/media/media.service.concurrency.spec.ts  # 并发场景 (300 行)
src/modules/media/media.service.batch-limits.spec.ts # 批量限制 (200 行)
src/modules/media/media.service.transaction.spec.ts  # 事务场景 (250 行)

❌ 错误（数字编号）：
src/modules/media/media.service.spec.ts
src/modules/media/media.service.2.spec.ts  # 不清晰
src/modules/media/media.service.3.spec.ts  # 不清晰
```

---

## 文件命名规范

### 基础命名

| 源文件类型 | 测试文件命名 | 示例 |
|-----------|------------|------|
| Service | `*.service.spec.ts` | `article.service.spec.ts` |
| Controller | `*.controller.spec.ts` | `article.controller.spec.ts` |
| Module | `*.module.spec.ts` | `article.module.spec.ts` |
| Guard | `*.guard.spec.ts` | `jwt-auth.guard.spec.ts` |
| Interceptor | `*.interceptor.spec.ts` | `performance.interceptor.spec.ts` |
| Filter | `*.filter.spec.ts` | `http-exception.filter.spec.ts` |
| Middleware | `*.middleware.spec.ts` | `compression.middleware.spec.ts` |
| DTO | `*.dto.spec.ts` | `create-article.dto.spec.ts` |
| Entity | `*.entity.spec.ts` | `user.entity.spec.ts` |
| Util | `*.util.spec.ts` | `date.util.spec.ts` |

### 场景拆分命名

**使用 `<base-name>.<scenario>.spec.ts` 格式**

| 场景类型 | 后缀示例 | 用途 |
|---------|---------|------|
| 并发测试 | `.concurrency.spec.ts` | 并发操作、竞态条件 |
| 批量操作 | `.batch-limits.spec.ts` | 批量限制、边界测试 |
| 事务处理 | `.transaction.spec.ts` | 事务回滚、一致性 |
| 性能测试 | `.performance.spec.ts` | 性能基准、压力测试 |
| 集成测试 | `.integration.spec.ts` | 跨模块集成 |
| 边界测试 | `.edge-cases.spec.ts` | 边界条件、异常输入 |

**示例**：

```typescript
// ✅ 正确：清晰的场景命名
media.service.spec.ts               // 核心 CRUD + 基础功能
media.service.concurrency.spec.ts  // 并发上传、队列管理
media.service.batch-limits.spec.ts // 批量删除限制、大文件处理
media.service.transaction.spec.ts  // 数据库事务、回滚场景

// ❌ 错误：模糊的命名
media.service.test2.spec.ts        // 什么测试？
media.service.more.spec.ts         // 不清晰
media.service.advanced.spec.ts     // 太宽泛
```

---

## 目录结构规范

### 模块级测试组织

```
src/modules/article/
├── article.module.ts
├── article.module.spec.ts           # 模块测试
├── article.service.ts
├── article.service.spec.ts          # 服务主测试
├── article.controller.ts
├── article.controller.spec.ts       # 控制器测试
├── dto/
│   ├── create-article.dto.ts
│   ├── create-article.dto.spec.ts   # DTO 验证测试
│   └── update-article.dto.spec.ts
├── guards/
│   ├── article-access.guard.ts
│   └── article-access.guard.spec.ts # Guard 测试
└── entities/
    ├── article.entity.ts
    └── article.entity.spec.ts       # Entity 测试
```

### 复杂服务的测试组织

```
src/modules/media/
├── services/
│   ├── media.service.ts                      # 主服务
│   ├── media.service.spec.ts                 # 主服务核心测试
│   ├── media.service.concurrency.spec.ts     # 并发场景
│   ├── media.service.batch-limits.spec.ts    # 批量限制
│   ├── media.service.transaction.spec.ts     # 事务处理
│   ├── storage-factory.service.ts
│   ├── storage-factory.service.spec.ts
│   └── storages/
│       ├── local-storage.service.ts
│       ├── local-storage.service.spec.ts
│       ├── picgo-storage.service.ts
│       └── picgo-storage.service.spec.ts
├── media.module.ts
├── media.module.spec.ts
├── media.controller.ts
└── media.controller.spec.ts
```

**❌ 禁止的结构**：

```
# 错误示例 1：父目录重复测试
src/modules/media/
├── services/
│   ├── media.service.ts
│   └── media.service.spec.ts         # 详细测试 (1,000 行)
└── media.service.spec.ts             # 重复！容易误解

# 错误示例 2：测试集中到父目录
src/modules/media/
├── services/
│   ├── media.service.ts              # 源文件在这里
│   └── storage.service.ts
└── tests/                            # ❌ 不要集中
    ├── media.service.spec.ts         # 远离源文件
    └── storage.service.spec.ts
```

---

## 测试分类规范

### 1. 单元测试（*.spec.ts）

**位置**：与源文件同目录
**命名**：`<filename>.spec.ts`
**职责**：测试单个模块的逻辑

```typescript
// src/modules/article/article.service.spec.ts
describe('ArticleService', () => {
  describe('create', () => {
    it('should create article successfully', async () => {
      // 测试创建逻辑
    });
  });

  describe('findAll', () => {
    it('should return paginated articles', async () => {
      // 测试分页逻辑
    });
  });
});
```

### 2. E2E 测试（*.e2e-spec.ts）

**位置**：`test/` 根目录
**命名**：`<feature>.e2e-spec.ts`
**职责**：测试完整的用户流程

```
test/
├── auth.e2e-spec.ts          # 认证流程
├── article.e2e-spec.ts       # 文章 CRUD 流程
├── upload.e2e-spec.ts        # 上传流程
└── plugin.e2e-spec.ts        # 插件系统流程
```

### 3. 工具/共享测试

**位置**：`test/` 目录
**命名**：
- 工具：`<tool-name>.ts`（不是 `.spec.ts`）
- 共享夹具：`test/fixtures/<name>.fixture.ts`

```
test/
├── mock-utils.ts             # Mock 工具（不是测试文件）
├── test-utils.ts             # 测试辅助函数
└── fixtures/
    ├── user.fixture.ts       # 用户测试数据
    └── article.fixture.ts    # 文章测试数据
```

---

## 常见误区

### ❌ 误区 1：父目录简化版测试

```
# 错误示例
src/modules/media/
├── services/
│   ├── media.service.ts
│   └── media.service.spec.ts    # 完整测试 (1000 行)
└── media.service.spec.ts        # "简化版" (500 行) - 容易误导！

# 为什么错误？
# 1. 不清楚两个文件的关系
# 2. 容易被误认为是重复
# 3. 维护者不知道该修改哪个
```

**✅ 正确做法**：只保留一个测试文件

```
src/modules/media/
└── services/
    ├── media.service.ts
    └── media.service.spec.ts    # 唯一测试文件
```

### ❌ 误区 2：使用 `.test.ts` 后缀

```
# 错误示例
src/modules/article/
├── article.service.ts
├── article.service.spec.ts   # Vitest 测试
└── article.service.test.ts   # Jest 测试？混淆！

# 为什么错误？
# 1. .spec.ts 和 .test.ts 容易混淆
# 2. 不清楚项目使用哪个测试框架
```

**✅ 正确做法**：统一使用 `.spec.ts`

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['**/*.spec.ts'],  // 只匹配 .spec.ts
  },
});
```

### ❌ 误区 3：实验性测试文件混入

```
# 错误示例
src/modules/auth/
├── auth.service.ts
├── auth.service.spec.ts          # 标准测试
└── auth.service.fixtures.spec.ts # 实验性 - 混淆！

# 为什么错误？
# 1. 不清楚哪个是"正式"测试
# 2. fixtures 暗示是测试数据，但实际是测试文件
```

**✅ 正确做法**：实验性测试放在独立目录

```
src/modules/auth/
├── auth.service.ts
└── auth.service.spec.ts

experiments/
└── vitest-fixtures/
    └── auth.service.fixtures.spec.ts  # 明确标记为实验
```

### ❌ 误区 4：数字编号拆分

```
# 错误示例
src/modules/article/
├── article.service.spec.ts      # 第 1 部分？
├── article.service.2.spec.ts    # 什么内容？
└── article.service.3.spec.ts    # 不清晰

# 为什么错误？
# 1. 无法从文件名了解测试内容
# 2. 新增场景时不知道用什么编号
```

**✅ 正确做法**：使用描述性场景后缀

```
src/modules/article/
├── article.service.spec.ts               # 核心 CRUD
├── article.service.search.spec.ts        # 搜索功能
└── article.service.password.spec.ts      # 密码保护
```

---

## 测试拆分指南

### 何时拆分？

**触发条件**（满足任一即拆分）：

1. ✅ 单个测试文件 **>800 行**
2. ✅ 测试运行时间 **>30 秒**（单文件）
3. ✅ 存在 **明确的独立场景**（并发、事务、批量等）
4. ✅ 不同场景需要 **不同的 Mock 设置**

**不应拆分的情况**：

- ❌ 仅仅因为文件"看起来长"（<800 行可接受）
- ❌ 基础 CRUD 测试（create, read, update, delete 应在同一文件）
- ❌ 相关的业务逻辑测试（如用户注册流程）

### 拆分步骤

**Step 1：识别独立场景**

```typescript
// media.service.spec.ts (1,200 行 - 需要拆分)

describe('MediaService', () => {
  // 场景 1：核心 CRUD (400 行)
  describe('upload', () => { ... });
  describe('delete', () => { ... });
  describe('list', () => { ... });

  // 场景 2：并发处理 (300 行) - 独立场景！
  describe('concurrent uploads', () => { ... });
  describe('upload queue management', () => { ... });

  // 场景 3：批量限制 (250 行) - 独立场景！
  describe('batch delete limits', () => { ... });
  describe('bulk operations', () => { ... });

  // 场景 4：事务处理 (250 行) - 独立场景！
  describe('transaction rollback', () => { ... });
  describe('consistency checks', () => { ... });
});
```

**Step 2：创建场景文件**

```bash
# 保留核心测试
media.service.spec.ts                 # 核心 CRUD (400 行)

# 创建场景测试
media.service.concurrency.spec.ts    # 并发场景 (300 行)
media.service.batch-limits.spec.ts   # 批量限制 (250 行)
media.service.transaction.spec.ts    # 事务场景 (250 行)
```

**Step 3：文件头部注释**

```typescript
/**
 * MediaService - Concurrency Tests
 *
 * 测试并发上传、队列管理和竞态条件处理
 *
 * 相关测试：
 * - media.service.spec.ts - 核心 CRUD 测试
 * - media.service.batch-limits.spec.ts - 批量操作限制
 * - media.service.transaction.spec.ts - 事务处理
 */
describe('MediaService - Concurrency', () => {
  // 并发测试...
});
```

---

## 迁移指南

### 场景 1：发现重复的父子目录测试

```
# 当前结构（有问题）
src/modules/media/
├── services/
│   ├── media.service.ts
│   └── media.service.spec.ts    # 1,000 行完整测试
└── media.service.spec.ts        # 500 行"简化"测试

# 迁移步骤
```

**Step 1：比较两个文件**

```bash
# 检查是否真的重复
diff src/modules/media/media.service.spec.ts \
     src/modules/media/services/media.service.spec.ts
```

**Step 2：决策**

- 如果是 **100% 重复**：删除父目录的文件
- 如果 **测试不同场景**：重命名为场景文件

```bash
# 选项 A：删除重复
rm src/modules/media/media.service.spec.ts

# 选项 B：重命名为场景（如果测试不同内容）
mv src/modules/media/media.service.spec.ts \
   src/modules/media/services/media.service.basic.spec.ts
```

**Step 3：验证**

```bash
pnpm test src/modules/media
```

### 场景 2：重构过大的测试文件

```
# 当前：单个 1,500 行的测试文件
media.service.spec.ts  (1,500 行)

# 目标：拆分为 4 个场景文件
media.service.spec.ts               (500 行)
media.service.concurrency.spec.ts  (400 行)
media.service.batch-limits.spec.ts (300 行)
media.service.transaction.spec.ts  (300 行)
```

**执行脚本**：

```bash
#!/bin/bash
# scripts/split-test-file.sh

SOURCE_FILE="src/modules/media/media.service.spec.ts"
BASE_NAME="src/modules/media/media.service"

# 1. 备份原文件
cp "$SOURCE_FILE" "${SOURCE_FILE}.bak"

# 2. 提取场景到新文件
# (手动编辑，或使用工具)

# 3. 验证所有测试通过
pnpm test src/modules/media

# 4. 删除备份
rm "${SOURCE_FILE}.bak"
```

---

## 检查清单

### 新建测试文件时

- [ ] 测试文件与源文件在同一目录？
- [ ] 使用了正确的后缀（`.spec.ts`）？
- [ ] 文件名清晰表达了测试内容？
- [ ] 如果是场景拆分，是否添加了文件头注释说明？
- [ ] 没有与现有测试文件重复？

### Code Review 时

- [ ] 检查是否有父子目录重复的测试文件？
- [ ] 测试文件是否过大（>800 行）需要拆分？
- [ ] 场景拆分的命名是否清晰？
- [ ] 是否有使用 `.test.ts` 或 `.fixtures.spec.ts` 等非标准后缀？

### 重构测试时

- [ ] 是否保留了原有的测试覆盖率？
- [ ] 拆分后的文件是否添加了相互引用注释？
- [ ] 是否更新了相关文档？
- [ ] 所有测试是否仍然通过？

---

## 工具支持

### ESLint 规则（可选）

```javascript
// eslint.config.js
export default [
  {
    files: ['**/*.spec.ts'],
    rules: {
      // 禁止在测试文件中使用 .test.ts
      'filename-pattern': ['error', { pattern: '\\.spec\\.ts$' }],
    },
  },
];
```

### Vitest 配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // 只匹配 .spec.ts 文件
    include: ['**/*.spec.ts'],

    // 排除实验性测试
    exclude: [
      '**/node_modules/**',
      '**/experiments/**',
      '**/*.fixtures.spec.ts',
    ],
  },
});
```

### VS Code 设置

```json
// .vscode/settings.json
{
  "files.associations": {
    "*.spec.ts": "typescript",
    "*.e2e-spec.ts": "typescript"
  },
  "search.exclude": {
    "**/*.fixtures.spec.ts": true
  }
}
```

---

## 附录

### A. 文件后缀对照表

| 后缀 | 用途 | 是否推荐 |
|------|------|----------|
| `.spec.ts` | 单元测试 | ✅ 推荐 |
| `.e2e-spec.ts` | E2E 测试 | ✅ 推荐 |
| `.test.ts` | 单元测试（Jest 风格） | ❌ 不推荐 |
| `.fixtures.spec.ts` | 实验性测试 | ❌ 已废弃 |
| `.<scenario>.spec.ts` | 场景拆分测试 | ✅ 推荐 |

### B. 场景后缀推荐列表

| 场景 | 后缀 | 示例 |
|------|------|------|
| 并发测试 | `.concurrency.spec.ts` | `upload.concurrency.spec.ts` |
| 批量操作 | `.batch-limits.spec.ts` | `delete.batch-limits.spec.ts` |
| 事务处理 | `.transaction.spec.ts` | `order.transaction.spec.ts` |
| 性能测试 | `.performance.spec.ts` | `search.performance.spec.ts` |
| 集成测试 | `.integration.spec.ts` | `payment.integration.spec.ts` |
| 边界测试 | `.edge-cases.spec.ts` | `validation.edge-cases.spec.ts` |
| 搜索功能 | `.search.spec.ts` | `article.search.spec.ts` |
| 权限测试 | `.permissions.spec.ts` | `resource.permissions.spec.ts` |
| 密码保护 | `.password.spec.ts` | `category.password.spec.ts` |

---

**文档维护者**: VanBlog 团队
**最后审核**: 2025-12-25
**下次审核**: 2026-06-25
