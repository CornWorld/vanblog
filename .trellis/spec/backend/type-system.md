# Type System

> Single Source of Truth type patterns for VanBlog.

---

## Overview

VanBlog uses a **Single Source of Truth** type system. Types flow from database definitions to API contracts to frontend types.

---

## Type Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  packages/shared/src/runtime/db.ts                              │
│  (Drizzle Table Definitions)                                    │
└────────────────────┬────────────────────────────────────────────┘
                     │ drizzle-zod
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│  packages/shared/src/runtime/schema.ts                          │
│  (Zod Schemas - Auto-generated)                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│  packages/shared/src/contracts/*.contract.ts                    │
│  (ts-rest API Contracts)                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
┌──────────────────┐    ┌──────────────────┐
│ Backend          │    │ Frontend         │
│ Runtime validation│    │ Type inference   │
└──────────────────┘    └──────────────────┘
```

---

## Shared Package Exports

| Export Path                 | Content                      | Usage                   |
| --------------------------- | ---------------------------- | ----------------------- |
| `@vanblog/shared`           | contracts + schemas          | Main entry point        |
| `@vanblog/shared/type`      | Pure types (0 bytes JS)      | Frontend type imports   |
| `@vanblog/shared/runtime`   | Zod schemas + Drizzle tables | Backend validation      |
| `@vanblog/shared/contracts` | ts-rest contracts            | API definitions         |
| `@vanblog/shared/drizzle`   | Drizzle database tools       | Database operations     |
| `@vanblog/shared/signals`   | Reactive signal system       | Plugin state management |
| `@vanblog/shared/plugin`    | Plugin API interfaces        | Plugin type definitions |

---

## Naming Conventions

### Database Layer (with `$` prefix)

| Type         | Meaning                         | Example                   |
| ------------ | ------------------------------- | ------------------------- |
| `$Entity`    | SELECT schema - full entity     | `$User`, `$Article`       |
| `$EntityIns` | INSERT schema - required fields | `$UserIns`, `$ArticleIns` |
| `$EntityUpd` | UPDATE schema - all optional    | `$UserUpd`, `$ArticleUpd` |

```typescript
// packages/shared/src/runtime/db.ts
export const $User = sqliteTable('user', {
  id: integer('id').primaryKey(),
  username: text('username').notNull(),
  email: text('email').notNull(),
});

// Auto-generated schemas
export const UserSchema = insertSchema($User); // All fields
export const UserInsSchema = insertSchema($User); // For insert
export const UserUpdSchema = updateSchema($User); // For update
```

### API Layer (no `$` prefix)

| Type          | Meaning                   | Example                     |
| ------------- | ------------------------- | --------------------------- |
| `Entity`      | API response (sanitized)  | `User`, `Article`           |
| `EntityReq`   | API request body (create) | `UserReq`, `ArticleReq`     |
| `EntityPatch` | API request body (update) | `UserPatch`, `ArticlePatch` |

```typescript
// packages/shared/src/contracts/user.contract.ts
import { z } from 'zod';

// API response - remove sensitive fields
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  // No password field!
});

// API request - create
export const UserReqSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  email: z.string().email(),
});

// API request - update
export const UserPatchSchema = z.partialObject(UserReqSchema);
```

---

## Import Patterns

### Backend (server-ng)

```typescript
// For database operations
import { $User, $UserIns, $UserUpd } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';
import { db } from './database';

// For validation
import { UserSchema, UserReqSchema } from '@vanblog/shared/runtime';

// For contract types
import type { User, UserReq } from '@vanblog/shared/contracts';
```

### Frontend (admin/website)

```typescript
// For types only (no runtime cost)
import type { User, UserReq, UserPatch } from '@vanblog/shared/type';

// For API client
import { apiClient } from '@/lib/api';

// Types are inferred from contract
const users: User[] = await apiClient.user.findAll();
```

---

## Schema Derivation

### From Drizzle to Zod

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { insertSchema, updateSchema, selectSchema } from 'drizzle-zod';

// Drizzle table
export const $Article = sqliteTable('article', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
});

// Auto-generated Zod schemas
export const ArticleInsSchema = insertSchema($Article); // For insert
export const ArticleUpdSchema = updateSchema($Article); // For update
export const ArticleSchema = selectSchema($Article); // For select
```

### Customizing Schemas

```typescript
import { z } from 'zod';

// Remove sensitive fields from API response
export const PublicUserSchema = UserSchema.pick({
  id: true,
  username: true,
  // Excludes: password, email
});

// Add computed fields
export const ArticleWithAuthorSchema = ArticleSchema.extend({
  author: PublicUserSchema,
  authorName: z.string(),
});
```

---

## Type Safety Benefits

1. **Compile-time checking**: Type errors caught before runtime
2. **Autocomplete**: IDE suggestions for API responses
3. **Refactoring safety**: Changing a contract updates all consumers
4. **No manual typing**: Types are inferred, not duplicated
5. **End-to-end safety**: From database to frontend

---

## Common Mistakes

1. **Importing from wrong path**:
   - ❌ `import { User } from '@vanblog/shared/runtime'`
   - ✅ `import { User } from '@vanblog/shared/type'` (frontend)

2. **Duplicating types**:
   - ❌ Manually defining `User` interface
   - ✅ Deriving from contract or schema

3. **Using `$` prefix in API layer**:
   - ❌ `return { status: 200, body: $User }`
   - ✅ `return { status: 200, body: User }`

4. **Forgetting sensitive field filtering**:
   - ❌ Returning `$User` with password
   - ✅ Returning `User` without password

5. **Not using `type` keyword**:
   - ❌ `import { User } from '@vanblog/shared/type'` (includes runtime)
   - ✅ `import type { User } from '@vanblog/shared/type'` (types only)

---

## Reference Examples

- Database types: `packages/shared/src/runtime/db.ts`
- Zod schemas: `packages/shared/src/runtime/schema.ts`
- API contracts: `packages/shared/src/contracts/`
- Type exports: `packages/shared/src/type/index.ts`
