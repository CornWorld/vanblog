# Database Guidelines

> Drizzle ORM patterns and conventions for VanBlog.

---

## Overview

VanBlog uses **Drizzle ORM** with **SQLite** as the database. The type system follows a Single Source of Truth pattern.

---

## Type System Flow

```
packages/shared/src/runtime/db.ts      # Drizzle table definitions
            ↓ drizzle-zod
packages/shared/src/runtime/schema.ts  # Zod schemas (auto-generated)
            ↓
packages/shared/src/contracts/*.contract.ts  # ts-rest contracts
            ↓
Frontend (type inference) + Backend (runtime validation)
```

**Key Principle**: Always start with `db.ts`. Everything else flows from there.

---

## Naming Conventions

| Prefix       | Purpose       | Example    | Usage              |
| ------------ | ------------- | ---------- | ------------------ |
| `$Entity`    | SELECT schema | `$User`    | Read from database |
| `$EntityIns` | INSERT schema | `$UserIns` | Write to database  |
| `$EntityUpd` | UPDATE schema | `$UserUpd` | Update database    |

**API Layer** (no `$` prefix):

- `Entity` - API response (usually `$Entity` with sensitive fields removed)
- `EntityReq` - API request body (create)
- `EntityPatch` - API request body (update)

---

## Database Commands

```bash
# Generate migration files from schema changes
pnpm --filter @vanblog/server-ng db:generate

# Push schema to database (development only - use migrations in production)
pnpm --filter @vanblog/server-ng db:push

# Open Drizzle Studio (GUI for database)
pnpm --filter @vanblog/server-ng db:studio
```

---

## Adding a New Table

### Step 1: Define Table in `packages/shared/src/runtime/db.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const $Post = sqliteTable('post', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

### Step 2: Generate Migration

```bash
pnpm --filter @vanblog/server-ng db:generate
```

This creates a migration file in `src/database/migrations/`.

### Step 3: Push to Database

```bash
pnpm --filter @vanblog/server-ng db:push
```

### Step 4: Update Contracts

Update `packages/shared/src/contracts/*.contract.ts` with the new entity types.

---

## Query Patterns

### Import Patterns

```typescript
// Backend (server-ng) - for database operations
import { $User, $UserIns, $UserUpd } from '@vanblog/shared/drizzle';
import { db } from './database';

// Frontend - for types only
import type { User, UserReq, UserPatch } from '@vanblog/shared/type';
```

### Select Queries

```typescript
import { eq, and, desc } from 'drizzle-orm';
import { $User } from '@vanblog/shared/drizzle';

// Simple select
const users = await db.select().from($User);

// With condition
const user = await db.select().from($User).where(eq($User.id, id));

// With multiple conditions
const activeUsers = await db
  .select()
  .from($User)
  .where(and(eq($User.status, 'active'), gt($User.createdAt, new Date('2024-01-01'))));

// With ordering
const recentUsers = await db.select().from($User).orderBy(desc($User.createdAt));
```

### Insert Queries

```typescript
import { $UserIns } from '@vanblog/shared/drizzle';

const newUser = await db
  .insert($User)
  .values({
    username: 'john',
    email: 'john@example.com',
  })
  .returning()
  .then((rows) => rows[0]);
```

### Update Queries

```typescript
import { $UserUpd, $User } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

const updated = await db
  .update($User)
  .set({ email: 'new@example.com' })
  .where(eq($User.id, userId))
  .returning()
  .then((rows) => rows[0]);
```

### Delete Queries

```typescript
import { $User } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

await db.delete($User).where(eq($User.id, userId));
```

---

## Column Naming

- **Snake case in database**: `created_at`, `updated_at`
- **Camel case in TypeScript**: `createdAt`, `updatedAt`
- Drizzle handles the mapping automatically

```typescript
export const $Post = sqliteTable('post', {
  id: integer('id').primaryKey(), // 'id' in DB
  createdAt: integer('created_at'), // Maps to 'created_at' in DB
  updatedAt: integer('updated_at'), // Maps to 'updated_at' in DB
});
```

---

## Timestamp Pattern

```typescript
import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';

export const $Post = sqliteTable('post', {
  // ...
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

---

## Common Mistakes

1. **Not using `$` prefix imports** - Always use `$Entity`, `$EntityIns`, `$EntityUpd` for DB operations
2. **Forgetting `.returning()`** - Insert/update queries don't return the entity by default in SQLite
3. **Direct schema edits** - Always edit `db.ts`, then run `db:generate`
4. **Using raw SQL** - Use Drizzle query builder for type safety
5. **Importing from wrong path** - Backend uses `@vanblog/shared/drizzle`, not `@vanblog/shared/runtime`

---

## Reference Examples

- Table definitions: `packages/shared/src/runtime/db.ts`
- Schema generation: `packages/shared/src/runtime/schema.ts`
- Database service: `packages/server-ng/src/database/database.service.ts`
- Migration examples: `packages/server-ng/src/database/migrations/`
