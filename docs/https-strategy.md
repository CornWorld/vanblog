# HTTPS 策略

> **依据**:[`deployment-strategy.md`](./deployment-strategy.md)(双镜像)+ [`routing-strategy.md`](./routing-strategy.md)(Caddy 承担路由)
>
> **核心决策**:prod 与 dev 镜像**都内嵌 Caddy**,通过 on-demand TLS 实现"零域名 HTTPS"。

---

## 1. 原项目机制回顾

**CaddyfileTemplate 核心**:

```
{
  on_demand_tls {
    ask http://127.0.0.1:3000/api/admin/caddy/ask
  }
  admin 0.0.0.0:2019
  email VAN_BLOG_EMAIL
}

https:// {
  tls { on_demand }
  handle /api/*     { reverse_proxy 127.0.0.1:3000 }
  handle /admin*    { root * /app/admin; file_server }
  reverse_proxy 127.0.0.1:3001   # 前台兜底
}
```

- Caddy on-demand TLS:握手时发现新域名 → 调 `/api/admin/caddy/ask` 校验 → 自动签发
- `caddy.provider.ts` 通过 admin API(`127.0.0.1:2019/config/...`)增删 subjects / redirect
- **这是 Vanblog 的核心卖点**:用户不需要预填域名

---

## 2. 为什么 prod 也内嵌 Caddy(不使用 pb 原生 TLS)

**pb 原生 TLS 两个致命问题**:

1. `pocketbase serve --tlsDomain=xxx` **必须预填域名** —— 失去"零配置"卖点
2. pb 不具备反代能力 —— prod 镜像仍需另一个进程分发 `/api/*` `/static/*` 等路由,不如让 Caddy 统一管

**Caddy 不重**:

- ~30MB 二进制,稳态几 MB 内存
- prod 镜像本来就不是单二进制(详见 [`deployment-strategy.md`](./deployment-strategy.md) §1.2):pb + Astro 产物 serve + 可能的 Waline
- 既然 prod 必须用 Caddy 做反代,HTTPS 也由它管是自然的

**结论**:**统一用 Caddy on-demand TLS,prod 与 dev 能力完全对齐**。

---

## 3. Caddyfile 模板

### 3.1 设计原则

**prod 和 dev 的 Caddyfile 不同**,因为渲染策略不同:

- **prod**:**纯 SSG**(Astro 预编译静态产物),Caddy 直接 `file_server`,无 Node 常驻
- **dev**:Astro dev server(`127.0.0.1:4321`),Caddy `reverse_proxy` 到它

**重建触发**:

- prod 镜像无 Node,无法在容器内重建 —— 用户在 dev 镜像或 CI 中 build 后重新部署
- pb_hooks JSVM(Go 内嵌 JS 解释器)**不能调用外部命令**,只能写数据库 / 调 HTTP API
- 未来的"自动重建"路径:pb hook → webhook → 外部 CI → 重新 build → 滚动部署(v1 不实现)

### 3.2 prod Caddyfile

```caddyfile
{
  on_demand_tls {
    ask http://127.0.0.1:8090/api/hooks/caddy/ask
  }
  admin 127.0.0.1:2019
  email {$VANBLOG_EMAIL}
  log {
    output file /var/log/caddy.log
    level {$VANBLOG_CADDY_LOG_LEVEL:warn}    # 默认 warn,可配
  }
}

https:// {
  tls { on_demand }
  encode zstd gzip

  handle /api/* {
    reverse_proxy 127.0.0.1:8090
  }
  handle_path /static/* {
    reverse_proxy 127.0.0.1:8090
  }

  # 用户自定义路由(vanblog 中间层 PATCH 注入,见 routing-strategy.md)

  # 兜底:前台(纯静态文件)
  root * /app/dist
  try_files {path} /index.html
  file_server
}

http:// {
  redir https://{host}{uri} permanent
}
```

### 3.3 dev Caddyfile

```caddyfile
{
  on_demand_tls {
    ask http://127.0.0.1:8090/api/hooks/caddy/ask
  }
  admin 127.0.0.1:2019
  email {$VANBLOG_EMAIL}
}

https:// {
  tls { on_demand }
  encode zstd gzip

  handle /api/* {
    reverse_proxy 127.0.0.1:8090
  }
  handle_path /static/* {
    reverse_proxy 127.0.0.1:8090
  }

  # 用户自定义路由(同 prod)

  # 兜底:前台(Astro dev server)
  reverse_proxy 127.0.0.1:4321
}

http:// {
  redir https://{host}{uri} permanent
}
```

### 3.4 与原项目 CaddyfileTemplate 的差异

- 去掉 Waline 反代(Waline 独立容器,用户通过 `site.routing` 配置)
- 去掉 `/c/* /custom/*`(CustomPage 已砍,见 [`feature-decision-matrix.md`](./feature-decision-matrix.md) #4)
- admin endpoint 从 `0.0.0.0:2019` 改为 `127.0.0.1:2019`(只接受 vanblog 中间层调用)
- prod 兜底从 `reverse_proxy :3001`(NestJS)改为 `file_server`(Astro SSG 产物)
- Caddy 日志级别可配(`VANBLOG_CADDY_LOG_LEVEL`,默认 warn)

---

## 4. pb_hooks `/api/hooks/caddy/ask` 端点

> 替代原项目 NestJS 的 `/api/admin/caddy/ask`。

```javascript
routerAdd("GET", "/api/hooks/caddy/ask", (c) => {
  const domain = c.queryParam("domain");
  const site = $app.findFirstRecordByFilter("site", "1=1");
  const allowed = site.get("allowedDomains") || [];

  // 空列表 = 允许所有(原项目默认行为,首次启动场景)
  if (allowed.length === 0) return c.json(200, {});

  // 非空 = 白名单校验
  if (allowed.includes(domain)) return c.json(200, {});
  return c.json(403, { error: "domain not allowed" });
});
```

---

## 5. 启动流程

```
1. 容器启动 → entrypoint.sh(见 deployment-strategy.md §2)
2. Caddy 启动(用上述 Caddyfile 模板)
3. pb 启动
4. pb_hooks 启动钩子:
   a. 读取 site.routing + site.allowedDomains
   b. 调用 caddy admin api 应用路由配置(见 routing-strategy.md §5)
5. 用户访问 → Caddy(HTTPS + 路由)→ pb / Astro 产物 / 用户后端
```

---

## 6. 域名获取(零配置体验)

保留原项目的**零域名**体验(这是核心卖点):

- on-demand TLS 不需要用户预填域名
- 用户任意域名访问 → Caddy 握手时调 vanblog `/api/hooks/caddy/ask`
- 默认 `allowedDomains = []` = 允许所有(原项目行为)
- 用户可在后台 `site.allowedDomains` 白名单收紧

---

## 7. 外置反代场景(用户自备)

已有反代基础设施的用户(K8s / Traefik / Cloudflare Tunnel 等):

- vanblog 容器通过环境变量 `HTTP_ONLY=true` 禁用内嵌 Caddy,只暴露 HTTP `:8080`
- 文档提供三种反代的配置片段:`docs/deploy/caddy.md` / `docs/deploy/traefik.md` / `docs/deploy/npm.md`
- 由用户自管的反代承担 TLS 终止 + 路由

---

## 8. 迁移影响

| 原项目配置                 | 重构后归属                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `Setting.https.redirect`   | Caddyfile `redir https://{host}{uri} permanent`(固定)                                 |
| `Setting.https.domains[]`  | `site.allowedDomains` JSON 字段(pb_hooks 查询)                                        |
| Caddy Admin API 操作       | pb_hooks 封装 + vanblog 中间层校验(见 [`routing-strategy.md`](./routing-strategy.md)) |
| `caddy.provider.ts` 整文件 | pb_hooks 重写                                                                         |
| `CaddyfileTemplate`        | `docker/Caddyfile.prod` + `docker/Caddyfile.dev`(详见 §3)                             |

---

## 9. 待决细节

1. **pb_hooks 调用 caddy admin api**:JSVM 是否支持 `$http` 内置或需 Go extend(待验证)
2. **TLS 证书持久化**:Caddy 证书缓存路径需挂载到 volume,避免容器重启重新签发
3. **HTTP_ONLY 模式的实现**:prod/dev entrypoint 如何根据 `HTTP_ONLY=true` 跳过 Caddy 启动
4. **Astro dev server 的 TLS**:dev 镜像里 Astro dev server 默认 HTTP,Caddy 终止 TLS 后转发 —— 符合预期(prod 无此问题,纯静态文件)
