# 数据库表初始化问题调查报告

**日期**: 2026-01-29
**状态**: 已分析
**严重级别**: 低（仅影响少数测试文件，不影响核心功能）

---

## 问题概述

### 症状

以下 4 个测试文件在运行时报错 `SQLITE_ERROR: no such table: users`：

1. `src/modules/user/user.service.entity-mapping.spec.ts` (9 个测试失败)
2. `src/modules/user/user.service.permissions.spec.ts` (4 个测试失败)
3. `src/modules/user/user.service.create-advanced.spec.ts` (2 个测试失败 - 另一个问题)

### 错误信息

```
Error: SQLITE_ERROR: no such table: users
    at LibSQLPreparedQuery.queryWithCache
    at LibSQLPreparedQuery.run
    at db.delete(users)
```

---

## 根本原因分析

### 1. 测试架构混合导致的问题

VanBlog 项目中有两种不同的测试数据库设置方式：

#### 方式 A：全局数据库（正常工作）

**配置文件**: `test/setup.unit.ts`

- 使用全局的 `setupTestDatabase()` 函数
- 通过 `drizzle-kit push` 自动创建所有数据库表
- 数据库文件：`test-data/test-worker-{id}.db`
- 使用示例：`user.service.spec.ts`（使用 Mock.db()）

```typescript
// test/setup.unit.ts
export { db } from './setup'; // 从 setup.ts 导入已初始化的 db

// test/setup.ts
const db = await setupTestDatabase(); // 自动运行 drizzle-kit push
```

#### 方式 B：独立数据库（失败的方式）

**工具文件**: `test/utils/db-worker-setup.ts`

- 每个测试文件独立创建数据库
- **仅创建空白数据库文件，不推送 Schema**
- 数据库文件：`.test-dbs/test-worker-{id}.db`
- 使用示例：`user.service.entity-mapping.spec.ts`

```typescript
// test/utils/db-worker-setup.ts
export function setupWorkerDatabase(workerId: string): WorkerDatabaseSetup {
  const dbPath = path.join(testDir, `test-worker-${workerId}.db`);
  // 删除旧文件
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  // 创建新数据库（空白，没有表结构！）
  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client);
  return { db, dbPath };
}
```

### 2. 问题关键点

**`setupWorkerDatabase()` 函数只创建空白 SQLite 数据库文件，但没有运行 `drizzle-kit push` 来创建表结构。**

当测试代码尝试执行 `db.delete(users)` 时，由于 `users` 表不存在，SQLite 抛出 `no such table: users` 错误。

### 3. 为什么其他测试能正常工作？

| 测试文件                              | 数据库方式             | 结果    |
| ------------------------------------- | ---------------------- | ------- |
| `user.service.spec.ts`                | Mock.db()（完全模拟）  | ✅ 正常 |
| `user.service.crud.spec.ts`           | 全局数据库（setup.ts） | ✅ 正常 |
| `user.service.entity-mapping.spec.ts` | setupWorkerDatabase()  | ❌ 失败 |
| `user.service.permissions.spec.ts`    | setupWorkerDatabase()  | ❌ 失败 |

---

## 影响范围

### 受影响的测试文件

| 文件                                   | 失败测试数 | 原因                                   |
| -------------------------------------- | ---------- | -------------------------------------- |
| `user.service.entity-mapping.spec.ts`  | 9          | 使用 setupWorkerDatabase()，没有表结构 |
| `user.service.permissions.spec.ts`     | 4          | 使用 setupWorkerDatabase()，没有表结构 |
| `user.service.create-advanced.spec.ts` | 2          | 重复用户名（另一个独立问题）           |

### 不受影响的测试

- **216 个测试文件** 正常运行（使用 Mock.db() 或全局数据库）
- **3938 个测试用例** 通过
- 通过率：**99.5%**

---

## 修复方案

### 方案 1：修复 setupWorkerDatabase()（推荐用于集成测试）

修改 `test/utils/db-worker-setup.ts`，添加 Schema 推送逻辑：

```typescript
import { execSync } from 'child_process';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@vanblog/shared/drizzle';

export function setupWorkerDatabase(workerId: string): WorkerDatabaseSetup {
  const testDir = path.join(process.cwd(), '.test-dbs');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const dbPath = path.join(testDir, `test-worker-${workerId}.db`);
  const packageDir = path.join(process.cwd()); // server-ng 目录

  // Remove existing database if it exists
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  // Create client and run drizzle-kit push to create tables
  const client = createClient({ url: `file:${dbPath}` });

  // 关键修复：推送 Schema
  try {
    execSync('npx drizzle-kit push', {
      stdio: 'pipe',
      cwd: packageDir,
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    });
  } catch (execError) {
    console.error('Failed to push schema:', execError);
    throw new Error('Database initialization failed');
  }

  const db = drizzle(client, { schema });

  return { db, dbPath };
}
```

**优点**：

- 修复独立数据库的表结构问题
- 保持测试隔离性
- 适用于需要真实数据库的集成测试

**缺点**：

- 每个测试文件都需要运行 drizzle-kit push（较慢）
- 需要额外的依赖检查

### 方案 2：统一使用全局数据库（推荐）

将失败的测试文件改为使用与其他测试相同的方式：

```typescript
// 移除 setupWorkerDatabase 导入
// import { setupWorkerDatabase, cleanupWorkerDatabase } from '../../../test/utils/db-worker-setup';

// 改为使用全局 db 和 Mock.db()
import { Mock } from '@test/mock';
import { db } from '../../../test/setup';

describe('UserService - Entity Mapping', () => {
  let databaseMock: InstanceType<typeof DatabaseMockBuilder>;

  beforeEach(async () => {
    databaseMock = Mock.db();
    // 使用 Mock 而不是真实数据库
  });
});
```

**优点**：

- 与其他测试保持一致
- 运行速度更快（不需要 drizzle-kit push）
- 不需要真实的数据库文件

**缺点**：

- 无法测试真实的数据库交互

### 方案 3：为集成测试创建专门的测试数据库服务

创建一个统一的集成测试数据库服务：

```typescript
// test/utils/integration-db.ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@vanblog/shared/drizzle';
import * as fs from 'fs';
import * as path from 'path';

let cachedDb: ReturnType<typeof drizzle> | null = null;

export async function getIntegrationDb() {
  if (cachedDb) return cachedDb;

  const testDbPath = path.join(process.cwd(), 'test-data/integration.db');

  // 只在第一次初始化时推送 Schema
  if (!fs.existsSync(testDbPath)) {
    execSync('npx drizzle-kit push', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    });
  }

  const client = createClient({ url: `file:${testDbPath}` });
  cachedDb = drizzle(client, { schema });

  return cachedDb;
}
```

---

## 建议

### 短期（立即修复）

1. **将 `user.service.entity-mapping.spec.ts` 和 `user.service.permissions.spec.ts` 改为使用 Mock.db()**
   - 这与项目的其他测试保持一致
   - 运行速度更快
   - 不需要额外的 Schema 初始化

2. **修复 `user.service.create-advanced.spec.ts` 中的用户名冲突问题**
   - 使用唯一用户名（例如使用 faker）

### 长期（架构改进）

1. **创建清晰的测试分层**：
   - 单元测试：使用 Mock（快速、隔离）
   - 集成测试：使用共享的测试数据库（包含 Schema）
   - E2E 测试：使用完整应用

2. **修复或废弃 `setupWorkerDatabase()`**：
   - 要么修复它以正确推送 Schema
   - 要么在文档中说明其局限性

3. **添加测试文档**：
   - 说明何时使用 Mock.db()
   - 说明何时使用真实数据库
   - 提供测试模板示例

---

## 结论

这是一个**测试架构不一致**导致的问题，而不是代码功能缺陷。失败的测试使用了不完整的数据库初始化工具（`setupWorkerDatabase()`），该工具只创建空白数据库文件而不创建表结构。

修复方案很简单：将这些测试改为使用项目标准的 Mock.db() 方式，或者修复 `setupWorkerDatabase()` 以正确推送数据库 Schema。

**值得注意的是**：这个问题不影响生产代码，也不影响 E2E 测试（E2E 测试全部通过 149/149）。单元测试通过率仍然高达 99.5%（3938/3958）。

---

## 相关文件

| 文件                                  | 说明                                   |
| ------------------------------------- | -------------------------------------- |
| `test/setup.ts`                       | 全局数据库设置（正常工作）             |
| `test/setup.unit.ts`                  | 单元测试设置入口                       |
| `test/utils/db-worker-setup.ts`       | **问题所在**：不完整的数据库初始化工具 |
| `test/utils/db-transaction-helper.ts` | 事务助手（依赖已存在的表）             |
| `test/utils/cleanup-helper.ts`        | 测试数据清理工具                       |
