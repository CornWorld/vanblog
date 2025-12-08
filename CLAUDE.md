# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VanBlog is a personal blog system with admin dashboard, public-facing website, and API server. This is a fork maintained by [CornWorld](https://github.com/CornWorld).

## Development Commands

```bash
# Install dependencies
pnpm i

# Development (all services)
pnpm dev                    # server-ng (3050) + admin (3002)
pnpm dev:server             # server-ng only
pnpm dev:admin              # admin only
pnpm dev:website            # website only (3001)

# Build
pnpm build                  # all packages
pnpm build:server           # server-ng
pnpm build:admin            # admin
pnpm build:website          # website

# Testing (server-ng)
pnpm --filter @vanblog/server-ng test        # unit tests
pnpm --filter @vanblog/server-ng test:e2e    # e2e tests
pnpm --filter @vanblog/server-ng test:cov    # coverage report

# Run single test file
pnpm --filter @vanblog/server-ng test path/to/file.spec.ts

# Database (server-ng uses Drizzle + SQLite)
pnpm --filter @vanblog/server-ng db:generate  # generate migrations
pnpm --filter @vanblog/server-ng db:push      # push schema to DB
pnpm --filter @vanblog/server-ng db:studio    # open Drizzle Studio

# Linting
pnpm lint                   # lint all
pnpm lint --fix             # auto-fix
```

## Monorepo Structure

```
packages/
├── server-ng/    # NestJS API server (Drizzle ORM, ts-rest) - ACTIVE
├── admin/        # React 19 + Vite + Ant Design dashboard
├── website/      # Next.js 15 public blog (SSG/ISR)
├── shared/       # Contracts, schemas, types (single source of truth)
├── server/       # Legacy NestJS + Mongoose server (being phased out / deprecated v1 api)
├── cli/          # CLI utilities
└── waline/       # Comment system
```

## Shared Package Type System

### Design: Single Source of Truth

```
Drizzle Tables (packages/shared/src/runtime/db.ts)
      ↓ drizzle-zod
Zod Schemas (packages/shared/src/runtime/schema.ts)
      ↓
ts-rest Contracts (packages/shared/src/contracts/*.contract.ts)
      ↓
Frontend (type inference) + Backend (runtime validation)
```

### Naming Convention

| Layer | Prefix     | Purpose              | Example                         |
| ----- | ---------- | -------------------- | ------------------------------- |
| DB    | `$` prefix | Database operations  | `$User`, `$UserIns`, `$UserUpd` |
| API   | No prefix  | API request/response | `User`, `UserReq`, `UserPatch`  |

- `$Entity` - SELECT schema (read from DB)
- `$EntityIns` - INSERT schema (write to DB)
- `$EntityUpd` - UPDATE schema (update DB)
- `Entity` - API response (usually $Entity without sensitive fields)
- `EntityReq` - API request body (create)
- `EntityPatch` - API request body (update)

### Package Exports

| Path                        | Content                      | Use Case              |
| --------------------------- | ---------------------------- | --------------------- |
| `@vanblog/shared`           | contracts + schemas          | Main entry            |
| `@vanblog/shared/type`      | Pure types (0 bytes JS)      | Frontend type imports |
| `@vanblog/shared/runtime`   | Zod schemas + Drizzle tables | Backend validation    |
| `@vanblog/shared/contracts` | ts-rest contracts            | API definitions       |
| `@vanblog/shared/drizzle`   | Drizzle database utilities   | DB operations         |

### Frontend Usage

```typescript
import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

const client = initClient(contract, { baseUrl: '/api' });
const { body: articles } = await client.article.findAll();
// articles automatically inferred as ArticleList type
```

## Tech Stack

- **Package Manager**: pnpm 10.x (workspace mode)
- **Node**: >=22 (server-ng), >=18 (admin)
- **Build**: Vite 6-7.x, Next.js 15.x
- **Testing**: Vitest (80% coverage threshold on CI)
- **Linting**: ESLint 9 (flat config) + Prettier
- **ORM**: Drizzle (SQLite) - replacing Mongoose
- **API**: ts-rest + NestJS 11

## Key Configuration Files

- `pnpm-workspace.yaml` - workspace config
- `tsconfig.base.json` - shared TypeScript config
- `eslint.config.js` - ESLint flat config
- `.prettierrc.js` - Prettier config
- `packages/server-ng/drizzle.config.ts` - Drizzle config
