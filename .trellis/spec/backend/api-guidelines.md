# API Guidelines

> ts-rest contract patterns and controller conventions for VanBlog.

---

## Overview

VanBlog uses **ts-rest** for type-safe API contracts. This ensures frontend and backend stay in sync.

---

## Contract-First Development

### The Flow

1. **Define contract** in `packages/shared/src/contracts/*.contract.ts`
2. **Implement controller** in `packages/server-ng/src/modules/*/`
3. **Frontend gets types** automatically via ts-rest client

### Why Contract-First?

- **Type safety**: Frontend knows exact API types
- **Single source of truth**: Contract defines the API
- **No manual typing**: Types are inferred, not duplicated
- **Early validation**: Contract errors caught at compile time

---

## Contract Structure

### Basic Contract

```typescript
// packages/shared/src/contracts/article.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const articleContract = c.router({
  // List articles
  findAll: {
    method: 'GET',
    path: '/articles',
    responses: {
      200: z.object({
        items: z.array(ArticleSchema),
        total: z.number(),
      }),
    },
    query: z.object({
      page: z.optional(z.number()),
      limit: z.optional(z.number()),
    }),
  },

  // Get single article
  findById: {
    method: 'GET',
    path: '/articles/:id',
    responses: {
      200: ArticleSchema,
      404: z.object({ message: z.string() }),
    },
  },

  // Create article
  create: {
    method: 'POST',
    path: '/articles',
    responses: {
      200: ArticleSchema,
      400: z.object({ message: z.string() }),
    },
    body: z.object({
      title: z.string(),
      content: z.string(),
    }),
  },

  // Update article
  update: {
    method: 'PATCH',
    path: '/articles/:id',
    responses: {
      200: ArticleSchema,
      404: z.object({ message: z.string() }),
    },
    body: z.partialObject({
      title: z.string(),
      content: z.string(),
    }),
  },

  // Delete article
  delete: {
    method: 'DELETE',
    path: '/articles/:id',
    responses: {
      200: z.object({ success: z.boolean() }),
      404: z.object({ message: z.string() }),
    },
  },
});
```

---

## Naming Conventions

### Contract Methods

| Operation | Method | Path             | Naming     |
| --------- | ------ | ---------------- | ---------- |
| List all  | GET    | `/resources`     | `findAll`  |
| Get one   | GET    | `/resources/:id` | `findById` |
| Create    | POST   | `/resources`     | `create`   |
| Update    | PATCH  | `/resources/:id` | `update`   |
| Delete    | DELETE | `/resources/:id` | `delete`   |

### Path Parameters

Use `:id` for entity identifiers:

```typescript
path: '/articles/:id',
path: '/users/:id',
path: '/articles/:id/comments/:commentId',
```

---

## Controller Implementation

### Using ts-rest Router

```typescript
// packages/server-ng/src/modules/article/article.controller.ts
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { articleContract } from '@vanblog/shared/contracts';
import { ArticleService } from './article.service';

@Controller()
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @TsRestHandler(articleContract)
  async handler() {
    return tsRestHandler(articleContract, {
      findAll: async ({ query }) => {
        const articles = await this.articleService.findAll(query);
        return { status: 200, body: articles };
      },
      findById: async ({ params }) => {
        const article = await this.articleService.findById(params.id);
        if (!article) {
          return { status: 404, body: { message: 'Article not found' } };
        }
        return { status: 200, body: article };
      },
      create: async ({ body }) => {
        const article = await this.articleService.create(body);
        return { status: 200, body: article };
      },
      update: async ({ params, body }) => {
        const article = await this.articleService.update(params.id, body);
        if (!article) {
          return { status: 404, body: { message: 'Article not found' } };
        }
        return { status: 200, body: article };
      },
      delete: async ({ params }) => {
        await this.articleService.delete(params.id);
        return { status: 200, body: { success: true } };
      },
    });
  }
}
```

---

## Response Patterns

### Success Response

```typescript
return { status: 200, body: data };
```

### Not Found

```typescript
if (!entity) {
  return { status: 404, body: { message: 'Resource not found' } };
}
```

### Validation Error

```typescript
try {
  const result = await this.service.create(body);
  return { status: 200, body: result };
} catch (error) {
  return { status: 400, body: { message: error.message } };
}
```

### Server Error

```typescript
return { status: 500, body: { message: 'Internal server error' } };
```

---

## Frontend Usage

### Initialize Client

```typescript
// packages/admin/src/lib/api.ts
import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

export const apiClient = initClient(contract, {
  baseUrl: '/api',
  baseHeaders: {
    // Add auth headers if needed
  },
});
```

### Use in Components

```typescript
import { apiClient } from '@/lib/api';

// Get all articles
const { body, status } = await apiClient.article.findAll({
  query: { page: 1, limit: 10 },
});

// Create article
const newArticle = await apiClient.article.create({
  body: { title: 'Hello', content: 'World' },
});

// Types are automatically inferred!
```

---

## Common Mistakes

1. **Not defining contract first** - Always start with contract, not implementation
2. **Inconsistent response shapes** - Use consistent response objects across endpoints
3. **Missing error responses** - Always define 400, 404, 500 responses
4. **Wrong import path** - Import contracts from `@vanblog/shared/contracts`
5. **Forgetting pagination** - List endpoints should support `page` and `limit`

---

## Reference Examples

- Article contract: `packages/shared/src/contracts/article.contract.ts`
- Main contract: `packages/shared/src/contracts/index.ts`
- Article controller: `packages/server-ng/src/modules/article/article.controller.ts`
- API client: `packages/admin/src/lib/api.ts`
