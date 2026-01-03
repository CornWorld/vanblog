# Drizzle Mock API 分析报告

**日期**: 2026-01-04
**Drizzle ORM 版本**: 0.44.7
**驱动**: drizzle-orm/libsql

---

## 发现

Drizzle ORM 从某个版本开始提供了官方的 Mock API：

```typescript
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// 无 Schema
const db = drizzle.mock();

// 带 Schema（类型支持）
const db = drizzle.mock({ schema });
```

---

## 验证结果

### ✅ 可用功能

1. **基础方法存在**：
   - `db.select()` ✓
   - `db.insert()` ✓
   - `db.update()` ✓
   - `db.delete()` ✓
   - `db.transaction()` ✓

2. **类型安全**：
   - 提供完整的 TypeScript 类型推导
   - 支持传入 Schema 以获得表级别的类型

### ❌ 局限性

1. **不支持实际查询执行**：

   ```typescript
   // 这会报错：Cannot read properties of undefined
   const result = await db.select().from(schema.$Article).all();
   ```

2. **主要用途是类型检查**：
   - `drizzle.mock()` 返回的是**空实现**
   - 只能用于静态类型分析
   - 不能用于单元测试中的实际 Mock

---

## 结论

### Drizzle 官方 Mock 的定位

**Drizzle 官方文档说明**：

> 此 API 是未定义的 `drizzle({} as any)` API 的替代方案，我们曾将其内部用于 Drizzle 测试。

**实际用途**：

- 主要用于 **Drizzle 内部测试**
- 用于 **类型推导和类型检查**
- **不适合**用于实际的单元测试 Mock

### 我们的自定义 Mock 仍然必要

我们的 `createDatabaseMock()` 和 `DatabaseMockBuilder` **必须保留**，因为：

1. **支持实际查询结果 Mock**：

   ```typescript
   const db = Mock.db()
     .setQueryResult([{ id: 1, title: 'Test' }])
     .setInsertResult([{ id: 1 }])
     .build();

   const result = await db.select().from(articles).all();
   // result = [{ id: 1, title: 'Test' }] ✓
   ```

2. **支持完整的 Drizzle ORM 链式调用**：
   - `select().from().where().limit().orderBy()`
   - `insert().values().returning()`
   - `update().set().where().returning()`
   - `delete().where().returning()`

3. **支持测试各种场景**：
   - 查询结果
   - 插入/更新/删除
   - 事务
   - 计数查询
   - 错误场景

---

## 建议

### ✅ 保留当前实现

**不建议**迁移到 `drizzle.mock()`，原因：

1. 功能不足以支持单元测试
2. 只提供类型检查，无法 Mock 查询结果
3. 我们的实现更完善，覆盖更多场景

### 📝 可能的改进

我们可以**参考** Drizzle 官方 Mock 的类型定义来改进我们的类型：

```typescript
import { drizzle } from 'drizzle-orm/libsql';
import type * as schema from './schema';

// 使用官方类型作为基础
type DrizzleDb = ReturnType<typeof drizzle.mock<typeof schema>>;

// 在此基础上扩展我们的 Mock
export class DatabaseMockBuilder<TSelect = any, ...> {
  build(): DrizzleDb {
    // 返回与官方类型兼容的 Mock
  }
}
```

### 🎯 文档更新

建议在 Mock 工具文档中说明：

- Drizzle 官方提供了 `drizzle.mock()`，但**仅用于类型检查**
- 单元测试应继续使用我们的 `Mock.db()` 或 `createDatabaseMock()`
- 我们的实现提供了完整的 Mock 功能，支持实际测试场景

---

## 测试文件

验证测试位置：`test/drizzle-mock.spec.ts`

```bash
# 运行验证测试
pnpm test test/drizzle-mock.spec.ts
```

---

## 参考资料

- **Drizzle ORM 文档**: https://orm.drizzle.team/
- **Mock API**: 暂无官方文档（推测为内部 API）
- **我们的 Mock 实现**: `test/mock.ts`
