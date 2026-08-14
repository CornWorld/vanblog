# API — 事实 (SSOT)

> 面向开发者。SDK 架构见 [sdk-design.md](../sdk-design.md)（内部）。

## 路由划分

| 前缀 | 归属 | 说明 |
|---|---|---|
| `/api/vanblog/*` | 自定义 Go 路由 | 业务 API（文章、主题、迁移、TLS 状态、Pack 等） |
| `/api/collections/*` | pb 原生 CRUD | PocketBase Record API（列表/详情/创建/更新/删除，受集合权限规则约束） |
| `/api/files/*` | pb 原生 | 上传文件访问（支持 `?thumb=` 缩略图） |
| `/_/` | pb Admin UI | PocketBase 管理界面 |

## 常用端点

| 方法/路径 | 用途 |
|---|---|
| `GET /api/vanblog/setup/status` | 判断是否首次启动（引导 setup） |
| `GET /api/vanblog/tls/status` | TLS 状态（HTTP_ONLY 下降级 `onDemandTLS: false`） |
| `POST /api/vanblog/migrate/import` | 数据导入（ZIP，限 100MB，事务） |
| `POST /api/vanblog/themes/reload` | 手动重扫主题 |
| `GET/POST /api/vanblog/posts/...` | 文章（含回收站 `posts/trash`、恢复 `posts/{id}/restore`） |
| `POST /api/vanblog/mcp/*` | MCP（admin-only，agent 扩展） |

## 鉴权

- 前台只读接口走 pb 公开权限。
- 管理/写操作需 pb 用户鉴权（`users` 集合）。协作者权限见后台「用户管理」。
- 所有外部请求经 Caddy 路由层（pb 只绑 127.0.0.1）。

## SDK

官方 SDK（TypeScript）位于 `sdk/`，用法：

```ts
import { createVanblogClient } from "@vanblog/sdk";
const client = createVanblogClient({ url: process.env.PB_URL });
await client.pb.collection("users").authWithPassword(email, password);
```

> 详细 API 契约见 `sdk/src/` 的公开签名（L0 契约，破坏需 major 版本）。
