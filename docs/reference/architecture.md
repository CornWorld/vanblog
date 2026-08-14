# 架构 — 事实 (SSOT)

> 部署相关事实见 [部署](deployment.md)。详细分层见 [architecture-layering.md](../architecture-layering.md)（内部）。

## 三服务

| 服务 | 内部端口 | 职责 |
|---|---|---|
| PocketBase | `127.0.0.1:8090` | 数据 / API / 权限（Go + SQLite） |
| Theme Host (Astro SSR) | `127.0.0.1:4321` | 前台主题 SSR + admin SSR |
| Caddy | `:80/:443`（对外） | 路由、TLS、静态文件、反代 pb / theme host |

## 请求流

```
Request → Caddy (:80/:443)
           ├── /api/*       → PocketBase (:8090)
           ├── /_/          → PocketBase Admin UI
           ├── /themes/*    → Caddy file_server（主题静态）
           ├── /_astro/* + /emoji-data.json + /robots.txt → Caddy file_server（admin 静态）
           └── /*           → Theme Host (:4321)
                                ├── /admin /login /setup → admin SSR
                                └── 其余 → 激活主题 SSR
```

- **所有外部流量必须经过 Caddy**：pb 只绑 `127.0.0.1`，SSRF 防护与自定义路由都在 Caddy 层。
- Caddy 路由由 `site.routing` 驱动，修改后**热重载**（pb 的 `BootstrapSyncFromDB` 调 Caddy admin API LoadConfig）。
- 管理端口 `:8080`：只放行 `/api/*` `/admin/*` `/_/*`，纯 HTTP 应急通道。

## 数据

- SQLite 于 `/pb_data`。核心集合：`tags, categories, users, posts, revisions, media, site, visits, audits`。
- 上传可落 S3（`site.s3Config` 同步到 pb settings）。
- 软删除：`posts.deleted` + 回收站。

## 缓存 / 发布

- 前台为 Astro SSR + 缓存失效机制；文章发布/修改/恢复触发缓存失效。
- 增量渲染（ISR）与主题切换见 `docs/theme-host-design.md`（内部）。

> 架构演进与分层决策（为什么 Go hooks vs JS hooks 等）见 [lessons-learned.md](../lessons-learned.md) §5。
