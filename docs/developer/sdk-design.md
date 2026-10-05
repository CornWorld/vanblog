# Vanblog SDK 设计

> **定位**:@vanblog/sdk 是 PocketBase JS SDK 的超集 —— 预配置 + 类型增强 + vanblog 服务命名空间 + 用户扩展能力。
>
> **稳定性定位（2026-10-05 起）**：SDK 是 vanblog 的内部承重模块（admin / theme / loaders 直接消费），**不是对外 semver 契约**。公开类型尽量保持稳定，但破坏性调整随仓库版本演进，不承诺 major 版本纪律。

## 核心原则

1. **pb 原生完全透传** — `pb.collection()`, `pb.files()`, `pb.authStore` 等全部保留,零封装
2. **vanblog 自定义 API 按 pb 风格挂载** — `client.vanblog.feed.rss()` / `client.vanblog.timeline.list()` / `client.vanblog.search.query()`
3. **用户可扩展** — `client.extend('bookmarks', { list, add })` 注册自定义路由服务
4. **多上下文适配** — 服务端(SSR + cookie)、客户端(hydration + localStorage)、build(SSG)

## API 设计

### 内置服务(vanblog 自定义路由)

```typescript
const client = createVanblogClient(opts);

// pb 原生(完全透传)
await client.collection("posts").getList(1, 10, {
  filter: 'status = "published" && deleted = false',
  sort: "-created",
});
await client.collection("users").authWithPassword("email", "password");
client.authStore.loadFromCookie(cookie);
client.authStore.exportToCookie();

// vanblog 服务(挂载在 client.vanblog 命名空间下)
await client.vanblog.feed.rss(); // GET /api/feed.xml
await client.vanblog.feed.atom(); // GET /api/atom.xml
await client.vanblog.feed.sitemap(); // GET /api/sitemap.xml
await client.vanblog.timeline.list(); // GET /api/vanblog/timeline
await client.vanblog.search.query("golang", { limit: 10 }); // GET /api/vanblog/search?q=golang
await client.vanblog.tls.status(); // GET /api/vanblog/tls/status
await client.vanblog.migrate.import(data); // POST /api/vanblog/migrate/import
```

### 用户扩展(自定义 hook 路由)

```typescript
// 用户在 pb_hooks 里加了 routerAdd("GET", "/api/bookmarks/list", ...)
// SDK 侧注册:
client.extend("bookmarks", {
  list: () => client.send("/api/bookmarks/list"),
  add: (url: string) =>
    client.send("/api/bookmarks/add", { method: "POST", body: { url } }),
});

// 使用:
await client.bookmarks.list();
await client.bookmarks.add("https://...");
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

> 注:`sdk/`、`app/`、`lab/`、`themes/*` 直接位于仓库根目录(不是 `packages/…`)。
> `pnpm-workspace.yaml` 声明 `packages: ['sdk', 'app', 'lab', 'themes/*']`。
> SDK 的 vanblog 服务集中在 `sdk/src/services.ts`;`client.extend()` 机制**内联在
> `sdk/src/client.ts`**(无独立 extend.ts);共享 record 模型在 `sdk/src/models/`。

```
vanblog/                      ← git root
  pnpm-workspace.yaml         ← workspace 声明(packages: ['sdk', 'app', 'lab', 'themes/*'])
  package.json                ← root (scripts, devDeps)
  sdk/                        ← @vanblog/sdk(根目录)
    package.json
    tsconfig.json
    src/
      index.ts                ← 统一导出
      client.ts               ← createVanblogClient (工厂函数;extend() 类型机制也在此)
      server.ts               ← createServerClient (SSR + cookie)
      browser.ts              ← createBrowserClient (客户端 + 同源)
      cookie.ts               ← cookie 读写辅助
      dates.ts                ← 日期格式化
      theme.ts                ← 主题侧辅助
      services.ts             ← vanblog 服务命名空间(feed/timeline/search/tls/migrate/setup/posts/site/media/categories/tags/users/routing)
      models/                 ← 共享 record 模型(posts/tags/categories/site/audits/visits/…)
      types.ts                ← Post, Site, Tag, Category, TLSStatus 等
      utils.ts                ← 通用工具
  app/                        ← Astro admin 前端
    package.json              ← "dependencies": { "@vanblog/sdk": "workspace:*" }
    astro.config.mjs
    src/
      ...
  themes/<name>/              ← 各主题(独立 Astro 项目)
  lab/                        ← dev 实验工具(非产品组件)
  vault/                      ← Go 后端 (不变)
  Dockerfile
```

### pnpm-workspace.yaml

```yaml
packages:
  - "sdk"
  - "app"
  - "lab"
  - "themes/*"
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

> 所有 vanblog 自定义服务挂在 `client.vanblog.*` 命名空间下(见 `sdk/src/client.ts`、`sdk/src/services.ts`)。下表的 `client.vanblog.<service>` 是实际调用路径。

| Go 路由                                | SDK 服务                                                       | 方法签名                                                          |
| -------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /api/feed.xml`                    | `client.vanblog.feed.rss()`                                    | `() => Promise<string>` (XML)                                     |
| `GET /api/atom.xml`                    | `client.vanblog.feed.atom()`                                   | `() => Promise<string>` (XML)                                     |
| `GET /api/sitemap.xml`                 | `client.vanblog.feed.sitemap()`                                | `() => Promise<string>` (XML)                                     |
| `GET /api/vanblog/timeline`            | `client.vanblog.timeline.list()`                               | `() => Promise<TimelineEntry[]>`                                  |
| `GET /api/vanblog/search?q=`           | `client.vanblog.search.query(q, opts?)`                        | `(q: string, opts?: {limit?: number}) => Promise<SearchResult[]>` |
| `GET /api/vanblog/tls/status`          | `client.vanblog.tls.status()`                                  | `() => Promise<TLSStatus>`                                        |
| `POST /api/vanblog/migrate/import`     | `client.vanblog.migrate.import(data)`                          | `(data: unknown) => Promise<MigrationResult>`                     |
| `GET /api/vanblog/setup/status`        | `client.vanblog.setup.status()`                                | `() => Promise<{ bootstrap: boolean }>`                           |
| `POST /api/vanblog/setup/complete`     | `client.vanblog.setup.complete(req)`                           | `(req) => Promise<{ ok, adminId?, error? }>`                      |
| `GET /api/vanblog/posts/trash`         | `client.vanblog.posts.trash()`                                 | `() => Promise<TrashEntry[]>`                                     |
| `POST /api/vanblog/posts/{id}/restore` | `client.vanblog.posts.restore(id)`                             | `(id: string) => Promise<void>`                                   |
| `POST /api/vanblog/posts/{id}/purge`   | `client.vanblog.posts.purge(id)`                               | `(id: string) => Promise<void>`                                   |
| `DELETE /api/vanblog/media/{id}`       | `client.vanblog.media.delete(id)`                              | `(id: string) => Promise<void>`                                   |
| `DELETE /api/vanblog/categories/{id}`  | `client.vanblog.categories.delete(id)`                         | `(id: string) => Promise<void>`                                   |
| `DELETE /api/vanblog/tags/{id}`        | `client.vanblog.tags.delete(id)`                               | `(id: string) => Promise<void>`                                   |
| `DELETE /api/vanblog/users/{id}`       | `client.vanblog.users.delete(id)`                              | `(id: string) => Promise<void>`                                   |
| `GET/PUT /api/vanblog/routing/rules`   | `client.vanblog.routing.list()` / `.replace(rules, allowlist)` | 见 `services.ts`                                                  |
| `POST /api/vanblog/routing/apply`      | `client.vanblog.routing.apply()`                               | `() => Promise<{ applied, restart_needed, error? }>`              |
| `site` collection                      | `client.vanblog.site.get()` / `.update(id, patch)`             | 封装 `pb.collection('site')`                                      |
| `posts` collection(查询)               | `client.vanblog.posts.listPublished(...)`                      | 封装 `pb.collection('posts').getList`                             |
| `GET /api/hooks/caddy/ask`             | _(内部使用,不暴露)_                                            | —                                                                 |
