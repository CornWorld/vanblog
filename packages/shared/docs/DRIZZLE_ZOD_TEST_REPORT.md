# drizzle-zod 0.8.3 + Zod v4 兼容性测试报告

**测试日期**: 2025-12-26
**测试环境**:

- drizzle-orm: 0.44.7
- drizzle-zod: 0.8.3
- zod: 4.1.13

---

## 测试目标

验证 drizzle-zod 0.8.3 升级后是否修复了与 Zod v4 的兼容性问题，特别是对于 JSON 字段使用 `.$type<T>()` 自定义类型的场景。

**参考文档**: `packages/server-ng/docs/ESLINT_ERROR_ANALYSIS_DETAILED.md` (lines 64-112)

---

## 测试方法

使用 `createSelectSchema()` 对包含 JSON 字段的 Drizzle 表生成 Zod Schema，检查生成的 Schema 类型是否正确。

### 测试用例

| 表名        | 字段     | 原始定义                                                       | 期望 Schema           | 实际 Schema                              |
| ----------- | -------- | -------------------------------------------------------------- | --------------------- | ---------------------------------------- |
| `pipelines` | `deps`   | `text('deps', { mode: 'json' }).$type<string[]>().notNull()`   | `z.array(z.string())` | `z.union([...])` 包含 `z.array(z.any())` |
| `webhooks`  | `events` | `text('events', { mode: 'json' }).$type<string[]>().notNull()` | `z.array(z.string())` | `z.union([...])` 包含 `z.array(z.any())` |

---

## 测试结果

### ❌ 问题未修复

drizzle-zod 0.8.3 **仍然无法** 正确处理 `.$type<T>()` 自定义类型。

### 生成的 Schema 结构

对于所有使用 `mode: 'json'` + `.$type<T>()` 的字段，drizzle-zod 生成的是一个泛型的 JSON Schema：

```typescript
z.union([
  z.union([z.string(), z.number(), z.boolean(), z.null()]), // JSON 原始类型
  z.record(z.string(), z.any()), // JSON 对象
  z.array(z.any()), // JSON 数组 (应该是 z.array(z.string()))
]);
```

**关键问题**：

- ✅ 不再是 `z.any()`（相比之前有所改善）
- ❌ 但生成的是 **泛型 JSON Schema**，忽略了 `.$type<>` 的类型信息
- ❌ `z.array(z.any())` 而不是 `z.array(z.string())`
- ❌ 运行时验证**无法拒绝错误类型**（例如 `[1, 2, 3]` 被接受）

### 运行时验证测试

```javascript
// pipelines.deps 字段测试
depsSchema.parse(['dep1', 'dep2']); // ✅ 通过
depsSchema.parse([1, 2, 3]); // ❌ 也通过（应该失败！）
depsSchema.parse(null); // ❌ 通过（应该失败！）

// webhooks.events 字段测试
eventsSchema.parse(['event1']); // ✅ 通过
eventsSchema.parse([1, 2, 3]); // ❌ 也通过（应该失败！）
```

### 影响范围

项目中所有使用 `.$type<T>()` 的 JSON 字段都受影响：

| 表名               | 字段          | 类型                 | 影响          |
| ------------------ | ------------- | -------------------- | ------------- |
| `users`            | `permissions` | `string[] \| null`   | ❌ 无类型安全 |
| `articles`         | `tags`        | `string[] \| null`   | ❌ 无类型安全 |
| `drafts`           | `tags`        | `string[] \| null`   | ❌ 无类型安全 |
| `draftVersions`    | `tags`        | `string[] \| null`   | ❌ 无类型安全 |
| `permissionGroups` | `permissions` | `string[] \| null`   | ❌ 无类型安全 |
| `webhooks`         | `events`      | `string[]` (notNull) | ❌ 无类型安全 |
| `pipelines`        | `deps`        | `string[]` (notNull) | ❌ 无类型安全 |
| `siteMeta`         | `value`       | `unknown`            | ⚠️ 预期行为   |
| `analytics`        | `data`        | `unknown`            | ⚠️ 预期行为   |
| `webhookLogs`      | `payload`     | `unknown` (notNull)  | ⚠️ 预期行为   |

---

## 根本原因

drizzle-zod 的 `createSelectSchema()` 函数只能访问 Drizzle 列定义的**运行时信息**，而 TypeScript 的 `.$type<T>()` 是**编译时类型注解**，在 JavaScript 运行时不存在。

### 代码层面分析

```typescript
// Drizzle 表定义
export const pipelines = sqliteTable('pipelines', {
  deps: text('deps', { mode: 'json' })
    .$type<string[]>()      // 这只是 TypeScript 类型提示，运行时不存在！
    .notNull()
    .$defaultFn(() => []),
});

// 运行时 drizzle-zod 只能看到：
{
  columnType: 'text',
  dataType: 'json',
  notNull: true,
  // .$type<string[]>() 的信息已丢失！
}
```

---

## 解决方案

### ✅ 推荐方案 1：使用 Drizzle 原生类型推导

**不使用** `createSelectSchema()`，直接使用 Drizzle 的 `$inferSelect`：

```typescript
// ❌ 错误做法：使用 drizzle-zod
import { createSelectSchema } from 'drizzle-zod';
const PipelineSchema = createSelectSchema(pipelines);
type Pipeline = z.infer<typeof PipelineSchema>; // deps 是 any

// ✅ 正确做法：使用 Drizzle 原生推导
import { pipelines } from '@vanblog/shared/drizzle';
type Pipeline = typeof pipelines.$inferSelect; // deps 是 string[]
```

**优点**：

- ✅ 完美的类型安全
- ✅ 无需手动维护 Schema
- ✅ 性能更好（无运行时开销）

**缺点**：

- ❌ 失去 Zod 运行时校验能力
- ❌ 无法用于 API 请求体验证

### ✅ 推荐方案 2：手动覆盖 JSON 字段 Schema

对于需要 Zod 运行时校验的场景，手动覆盖 JSON 字段：

```typescript
import { createSelectSchema } from 'drizzle-zod';
import { pipelines } from '@vanblog/shared/drizzle';
import { z } from 'zod';

// 1. 生成基础 Schema
const PipelineSelectSchema = createSelectSchema(pipelines);

// 2. 手动覆盖 JSON 字段
const PipelineSchemaFixed = PipelineSelectSchema.extend({
  deps: z.array(z.string()), // 覆盖为正确类型
});

// 3. 用于运行时验证
type Pipeline = z.infer<typeof PipelineSchemaFixed>; // ✅ deps 是 string[]
```

**优点**：

- ✅ 保留 Zod 运行时校验
- ✅ 类型安全
- ✅ 适用于 API 契约

**缺点**：

- ❌ 需要手动维护（当表结构变化时需同步更新）
- ❌ 重复定义类型信息

### ❌ 不推荐方案：等待 drizzle-zod 修复

drizzle-zod 从设计上**无法解决**这个问题（TypeScript 类型信息在运行时不存在）。

---

## 项目影响评估

### 当前状态

项目中大量使用 `createSelectSchema()` + `.$type<T>()` 的组合：

```bash
$ grep -r "createSelectSchema" packages/shared/src/
packages/shared/src/drizzle/zod-schemas.ts:import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
packages/shared/src/drizzle/zod-schemas.ts:export const UserSelectSchema = createSelectSchema(users);
packages/shared/src/drizzle/zod-schemas.ts:export const ArticleSelectSchema = createSelectSchema(articles);
...
```

### 必要的修复

1. **高优先级**（影响 API 类型安全）：
   - `pipelines.deps`
   - `webhooks.events`
   - `users.permissions`
   - `permissionGroups.permissions`

2. **中优先级**（影响前端类型安全）：
   - `articles.tags`
   - `drafts.tags`
   - `draftVersions.tags`

3. **低优先级**（`unknown` 类型本身就是泛型）：
   - `siteMeta.value`
   - `analytics.data`
   - `webhookLogs.payload`

---

## 建议行动

### 立即行动

1. **更新 `packages/shared/src/drizzle/zod-schemas.ts`**：
   - 对所有 `string[]` 类型的 JSON 字段添加 `.extend()` 手动覆盖
   - 生成对应的测试用例验证类型安全

2. **更新 CLAUDE.md 文档**：
   - 添加 "JSON 字段类型安全最佳实践" 章节
   - 警告开发者不要直接使用 `createSelectSchema()` 处理 `.$type<T>()` 字段

### 后续行动

1. **评估是否完全迁移到 Drizzle 原生类型**：
   - 对于不需要运行时校验的场景，使用 `$inferSelect`
   - 只在 API 边界保留 Zod Schema

2. **创建代码生成脚本**：
   - 自动从 Drizzle Schema 生成正确的 Zod Schema 覆盖代码
   - 减少手动维护负担

---

## 测试文件

- `packages/shared/src/drizzle/type-inference-test.ts` - TypeScript 源码测试
- `packages/shared/run-type-test.mjs` - pipelines.deps 详细测试
- `packages/shared/test-webhooks.mjs` - webhooks.events 验证测试

---

## 结论

**drizzle-zod 0.8.3 升级并未修复** `.$type<T>()` 类型推导问题。根本原因是 TypeScript 类型信息在运行时不存在，drizzle-zod 无法从中推导。

**必须采用手动覆盖方案** 或 **迁移到 Drizzle 原生类型推导** 才能获得类型安全。

**ESLINT_ERROR_ANALYSIS_DETAILED.md 文档中的结论依然有效**：建议使用 `$inferSelect` 而不是 `createSelectSchema()`。
