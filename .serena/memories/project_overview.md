# VanBlog Project Overview

## Purpose
VanBlog is a modern personal blog system with admin backend, public website, and API server. It uses Drizzle ORM + SQLite for data, ts-rest for type-safe APIs, and supports 8 built-in plugins.

## Tech Stack
- **Backend**: NestJS 11 + ts-rest + Drizzle ORM + SQLite
- **Frontend**: React 19 (admin) + Next.js 15 (website)
- **Testing**: Vitest with 80% coverage threshold for server-ng
- **Build**: Vite 6-7.x, Next.js 15.x
- **Code Quality**: ESLint 9 (flat config) + Prettier 3.6.2
- **Package Manager**: pnpm >=10.x
- **Runtime**: Node.js >=22 (server-ng), >=18 (admin/website)

## Core Modules
1. **server-ng** - API service (active)
2. **admin** - Management backend (active)
3. **website** - Public blog (active)
4. **shared** - Type contracts & schemas (active)
5. **server** - Legacy service (deprecated)
6. **cli** - CLI tool (maintenance)
7. **waline** - Comment system (maintenance)

## Type System Convention
- Database layer uses `$` prefix: `$Entity`, `$EntityIns`, `$EntityUpd`
- API layer: `Entity`, `EntityReq`, `EntityPatch`
- Single source of truth: Drizzle tables → Zod schemas → ts-rest contracts

## Logger Usage
- **Backend (server-ng)**: MUST use NestJS Logger (100% migrated)
- **Frontend (admin/website)**: Can use console for debugging

## Testing Coverage
- **Current**: 80% threshold (Vitest + v8)
- **Goal**: 90% for business modules
- Common low-coverage modules: article, auth, category, draft, setting
