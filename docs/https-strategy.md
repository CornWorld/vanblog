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

## 3. Caddy 配置:单一真相源(范式 X)

> 详见 [`.snow/plan/caddy-single-source.md`](../.snow/plan/caddy-single-source.md) 完整设计。

vanblog **不再使用 Caddyfile 作为运行时配置**。Caddy 配置分两层:

### 3.1 Bootstrap 配置(维护模式)

`docker/bootstrap.json` 是一份静态最小 JSON,由 Dockerfile COPY 进容器。Caddy 启动时加载它,进入维护模式:

- `:443` 返回 `503 Service Unavailable` + `Retry-After: 30` + 中文维护页
- `:80` 永久重定向到 `:443`
- `:8080` 管理端口反代到 pb / Astro(保证 admin UI 在故障时仍可达)
- `admin.origins = ["127.0.0.1"]`(零信任,绝不用 `["*"]`)

### 3.2 完整运行时配置(pb OnBootstrap 注入)

pb 启动后,`OnBootstrap` 钩子**同步**调用 `caddy.BootstrapSync(app, "http://127.0.0.1:2019")`:

1. 读 `site.routing`(用户规则)+ `site.allowedDomains` + `VANBLOG_EMAIL` env
2. 合并系统缓存规则(`SystemCacheRules`)
3. `BuildFullConfig(opts, rules)` 翻译为 `caddyadmin.Config` struct
4. `ValidateConfig`(dry-run)→ `LoadConfig`(原子替换 bootstrap 配置)
5. 失败重试 5 次,指数退避(1s/2s/4s/8s/16s);全部失败时持久化到 `site.caddyLastError`,容器不崩,管理端口仍可达

### 3.3 dev / prod 差异

dev 和 prod 的唯一差异是 `AstroTarget`(`127.0.0.1:4321` 都一样,但 prod 是 Astro SSR standalone,dev 是 Astro dev server HMR)。由 `BuildOpts` 控制,不再有两份 Caddyfile。

### 3.4 Legacy 回滚通道

运维设置 `VANBLOG_CADDY_MODE=legacy` env 可回退到旧的 Caddyfile 模式(用 `docker/Caddyfile.legacy.{prod,dev}`)。这是回滚通道,不建议长期使用。

---

## 4. pb_hooks `/api/hooks/caddy/ask` 端点

> 替代原项目 NestJS 的 `/api/admin/caddy/ask`。

```javascript
routerAdd("GET", "/api/hooks/caddy/ask", (e) => {
  const domain = e.request.url.query().get("domain");
  const site = $app.findFirstRecordByFilter("site", "1=1");
  const allowed = site.get("allowedDomains") || [];

  // 空列表 = 允许所有(原项目默认行为,首次启动场景)
  if (allowed.length === 0) return e.json(200, {});

  // 非空 = 白名单校验
  if (allowed.includes(domain)) return e.json(200, {});
  return e.json(403, { error: "domain not allowed" });
});
```

---

## 5. 启动流程

```
1. 容器启动 → entrypoint.sh(见 deployment-strategy.md §2)
2. Caddy 启动(用 docker/bootstrap.json,维护模式)
3. pb 启动
4. pb OnBootstrap 钩子(同步):
   a. 读取 site.routing + site.allowedDomains + VANBLOG_EMAIL
   b. BuildFullConfig → ValidateConfig → LoadConfig(替换维护配置)
   c. 失败重试 5 次(指数退避)
5. 用户访问 → Caddy(HTTPS + 完整路由)→ pb / Astro / 用户后端
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
| `Setting.https.redirect`   | `srv_http` 静态 301 路由(由 `BuildFullConfig` 生成)                                   |
| `Setting.https.domains[]`  | `site.allowedDomains` JSON 字段(pb_hooks 查询)                                        |
| Caddy Admin API 操作       | pb_hooks 封装 + vanblog 中间层校验(见 [`routing-strategy.md`](./routing-strategy.md)) |
| `caddy.provider.ts` 整文件 | pb_hooks 重写                                                                         |
| `CaddyfileTemplate`        | `docker/bootstrap.json` + `BuildFullConfig`(详见 §3)                                  |

---

## 9. 待决细节

1. **pb_hooks 调用 caddy admin api**:已决策 — Go extend 实现(见 [`architecture-layering.md`](./architecture-layering.md) §9),JSVM 通过 `vanblog.caddy.*` 调用
2. ~~**TLS 证书持久化**~~ **已完成**:bootstrap.json 配置 `storage.file_system.root = /data/caddy`,Dockerfile 声明 `VOLUME ["/data/caddy"]`,用户挂载 `-v caddy_data:/data/caddy` 即可持久化证书
3. **Astro dev server 的 TLS**:dev 镜像里 Astro dev server 默认 HTTP,Caddy 终止 TLS 后转发 —— 符合预期(prod 无此问题,Astro SSR standalone 由 Caddy 直接反代)
