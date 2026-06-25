# Vanblog SDK 设计

> **定位**:@vanblog/sdk 是 PocketBase JS SDK 的超集 —— 预配置 + 类型增强 + vanblog 服务命名空间 + 用户扩展能力。

## 核心原则

1. **pb 原生完全透传** — `pb.collection()`, `pb.files()`, `pb.authStore` 等全部保留,零封装
2. **vanblog 自定义 API 按 pb 风格挂载** — `client.feed.rss()` / `client.timeline.list()` / `client.search.query()`
3. **用户可扩展** — `client.extend('bookmarks', { list, add })` 注册自定义路由服务
4. **多上下文适配** — 服务端(SSR + cookie)、客户端(hydration + localStorage)、build(SSG)

## API 设计

### 内置服务(vanblog 自定义路由)

```typescript
const client = createVanblogClient(opts);

// pb 原生(完全透传)
await client.collection('posts').getList(1, 10, {
  filter: 'status = "published" && deleted = false',
  sort: '-created',
});
await client.collection('users').authWithPassword('email', 'password');
client.authStore.loadFromCookie(cookie);
client.authStore.exportToCookie();

// vanblog 服务(和 pb.collection/files 同层级)
await client.feed.rss();                              // GET /api/feed.xml
await client.feed.atom();                             // GET /api/atom.xml
await client.feed.sitemap();                          // GET /api/sitemap.xml
await client.timeline.list();                         // GET /api/vanblog/timeline
await client.search.query('golang', { limit: 10 });   // GET /api/vanblog/search?q=golang
await client.tls.status();                            // GET /api/vanblog/tls/status
await client.migrate.import(data);                    // POST /api/vanblog/migrate/import
```

### 用户扩展(自定义 hook 路由)

```typescript
// 用户在 pb_hooks 里加了 routerAdd("GET", "/api/bookmarks/list", ...)
// SDK 侧注册:
client.extend('bookmarks', {
  list: () => client.send('/api/bookmarks/list'),
  add: (url: string) => client.send('/api/bookmarks/add', { method: 'POST', body: { url } }),
});

// 使用:
await client.bookmarks.list();
await client.bookmarks.add('https://...');
```

### 多上下文

```typescript
// SSR (Astro middleware)
import { createServerClient } from '@vanblog/sdk';

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createServerClient({
    url: import.meta.env.PB_URL || 'http://127.0.0.1:8090',
    cookie: context.request.headers.get('cookie') || '',
  });
  
  context.locals.pb = client;
  
  const response = await next();
  
  // 写回刷新后的 auth cookie
  const authCookie = client.authStore.exportToCookie();
  response.headers.append('set-cookie', authCookie);
  
  return response;
});

// Astro 页面中使用
---
const pb = Astro.locals.pb;
const posts = await pb.collection('posts').getList(1, 10);
---

// 客户端 hydration
import { createBrowserClient } from '@vanblog/sdk';

const pb = createBrowserClient({
  url: '/api',  // 同源代理,走 Caddy
});

await pb.collection('posts').create({ title: 'New Post' });
```

## Monorepo 结构

```
vanblog/                      ← git root
  pnpm-workspace.yaml         ← workspace 声明
  package.json                ← root (scripts, devDeps)
  packages/
    sdk/                      ← @vanblog/sdk
      package.json
      tsconfig.json
      src/
        index.ts              ← 统一导出
        client.ts             ← createVanblogClient (工厂函数)
        server.ts             ← createServerClient (SSR + cookie)
        browser.ts            ← createBrowserClient (客户端 + 同源)
        services/
          feed.ts             ← feed.rss/atom/sitemap
          timeline.ts         ← timeline.list
          search.ts           ← search.query
          tls.ts              ← tls.status
          migrate.ts          ← migrate.import
        types.ts              ← Post, Site, Tag, Category, TLSStatus 等
        extend.ts             ← client.extend() 类型机制
  app/                        ← Astro 前端
    package.json              ← "dependencies": { "@vanblog/sdk": "workspace:*" }
    astro.config.mjs
    src/
      ...
  vault/                      ← Go 后端 (不变)
  Dockerfile
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'app'
```

### app/package.json 依赖

```json
{
  "dependencies": {
    "@vanblog/sdk": "workspace:*",
    "astro": "^5.0.0",
    "@astrojs/node": "^9.0.0"
  }
}
```

## 缓存失效(revalidate)

方向:**后端(Go)通知前端(Astro)**。

```
pb hook (OnRecordAfterUpdateSuccess "posts")
  → Go: HTTP POST http://127.0.0.1:4321/api/revalidate { tags: ["posts"] }
  → Astro: cache.invalidate({ tags: ["posts"] })
```

SDK 不负责 revalidate(这是 Go → Astro 的内部通信,不走 SDK)。

## 已有 vanblog 自定义路由 → SDK 服务映射

| Go 路由 | SDK 服务 | 方法签名 |
|---|---|---|
| `GET /api/feed.xml` | `client.feed.rss()` | `() => Promise<string>` (XML) |
| `GET /api/atom.xml` | `client.feed.atom()` | `() => Promise<string>` (XML) |
| `GET /api/sitemap.xml` | `client.feed.sitemap()` | `() => Promise<string>` (XML) |
| `GET /api/vanblog/timeline` | `client.timeline.list()` | `() => Promise<TimelineEntry[]>` |
| `GET /api/vanblog/search?q=` | `client.search.query(q, opts?)` | `(q: string, opts?: {limit?: number}) => Promise<SearchResult[]>` |
| `GET /api/vanblog/tls/status` | `client.tls.status()` | `() => Promise<TLSStatus>` |
| `POST /api/vanblog/migrate/import` | `client.migrate.import(data)` | `(data: unknown) => Promise<MigrationResult>` |
| `GET /api/hooks/caddy/ask` | *(内部使用,不暴露)* | — |
