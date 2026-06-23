# 路由与反代策略

> **依据**:用户反馈 + [原项目 `caddy.provider.ts`](file:///Users/corn/Code/vanblog-upstream/packages/server/src/provider/caddy/caddy.provider.ts) + [Caddy Admin API 文档](https://caddyserver.com/docs/api)
>
> **核心矛盾**:用户需要自定义路由/反代(原项目 CustomPage 的真实诉求),但裸 Caddy admin API 风险大(SSRF / 配置覆盖 / 持久化丢失)。
>
> **解决思路**:**vanblog 作为 Caddy 的安全前置层**,用户配置经校验后由 vanblog 翻译为 caddy config,用户永远不直接操作 caddy admin api。

---

## 1. 原项目机制回顾

**CaddyfileTemplate 的两层用法**:

**层 1:静态路由**(启动时 Caddyfile 渲染):

```
handle /api/*       { reverse_proxy 127.0.0.1:3000 }   # NestJS 后端
handle /static/*    { reverse_proxy 127.0.0.1:3000 }   # 图床
handle /admin*      { root * /app/admin; file_server } # 后台静态
handle /api/comment { reverse_proxy 127.0.0.1:8360 }   # Waline
reverse_proxy 127.0.0.1:3001                            # 前台兜底
```

**层 2:动态路由**(`caddy.provider.ts:88-119`):

- `updateSubjects(domains)` → `PATCH /config/apps/tls/automation/policies/0/subjects`
- `updateHttpsDomains(domains)` → `PATCH /config/apps/tls/certificates/automate`
- `setRedirect(bool)` → `POST/DELETE /config/apps/http/servers/srv1/listener_wrappers`

**原项目没有做**:

- 用户自定义反代目标(没有 UI)
- 配置校验(任何调 admin API 的代码都直接生效)
- 持久化(admin API 改动重启后丢失,只能改 Caddyfile 模板)

---

## 2. 新设计:三层架构

```
┌──────────────────────────────────────────────────────────────┐
│  用户(后台 UI / JSON 配置)                                  │
│  site.routing = [...]                                         │
└──────────────┬───────────────────────────────────────────────┘
               │ ① 提交
               ▼
┌──────────────────────────────────────────────────────────────┐
│  vanblog 中间层(pb_hooks / Go extend)                       │
│  - 读 site.routing                                            │
│  - 校验(白名单 / SSRF 防护 / 路径冲突)                      │
│  - 翻译为 caddy JSON 路由                                     │
│  - 调用 caddy admin API(带 @id 标识)                        │
│  - 持久化到 site.routing + Caddyfile 模板                    │
│  - audit log 写入 audits 表                                  │
└──────────────┬───────────────────────────────────────────────┘
               │ ② 翻译后
               ▼
┌──────────────────────────────────────────────────────────────┐
│  Caddy(dev 镜像)/ 用户外置反代                              │
│  - 只接受 vanblog 中间层的调用(127.0.0.1:2019)              │
│  - admin API 不对外暴露                                       │
└──────────────────────────────────────────────────────────────┘
```

**核心原则**:**用户永远不直接调 caddy admin API**。所有变更经 vanblog 中间层校验+翻译+audit。

---

## 3. 用户配置 DSL(`site.routing`)

### 3.1 配置结构

```json
{
  "routing": [
    {
      "id": "internal-api",
      "type": "proxy",
      "from": "/api/internal/*",
      "to": "http://localhost:3000/*",
      "preserveHost": false,
      "headers": { "X-Forwarded-Proto": "https" }
    },
    {
      "id": "old-blog",
      "type": "redirect",
      "from": "/old/*",
      "to": "https://new.example.com/",
      "code": 301
    },
    {
      "id": "md-files",
      "type": "rewrite",
      "from": "/docs/*",
      "to": "/static/docs/*"
    },
    {
      "id": "block-admin-external",
      "type": "block",
      "from": "/admin/*",
      "when": "{remote.host} not_in private_ranges"
    }
  ]
}
```

### 3.2 支持的 `type`

| type       | 说明              | 对应 Caddy 指令 |
| ---------- | ----------------- | --------------- |
| `proxy`    | 反向代理          | `reverse_proxy` |
| `redirect` | 重定向(3xx)       | `redir`         |
| `rewrite`  | URL 重写(内部)    | `rewrite`       |
| `block`    | 拒绝访问(403/404) | `respond 403`   |
| `header`   | 修改响应头        | `header`        |

**不支持**(安全考虑):

- ❌ `file_server`(用户不能让 Caddy 任意目录列目录)
- ❌ `execute`(不能让 Caddy 执行命令)
- ❌ `tls`(TLS 由 vanblog 统一管理,见 HTTPS 策略)
- ❌ 任意 `route` 指令(Caddyfile 原生语法不开放)

### 3.3 `from` / `to` 路径匹配

- `from`:支持 glob(`*` / `/*` / `/api/*`),**不支持正则**(降低注入风险)
- `to`(proxy/redirect):**必须是绝对 URL 或绝对路径**,不接受相对路径

---

## 4. 中间层校验规则(pb_hooks)

> 这是你说的"中间件解决 caddy 随意配置的风险"的具体实现。

### 4.1 SSRF 防护(最关键)

**`to` 字段的 host 必须通过白名单校验**:

```javascript
// pb_hooks 路由变更前置校验
const SSRF_ALLOWLIST = [
  "127.0.0.1",
  "localhost",
  "172.16.0.0/12", // Docker 内网
  "10.0.0.0/8", // 内网
  "192.168.0.0/16", // 内网
  "*.svc.cluster.local", // K8s 内部
];

function validateProxyTarget(to) {
  const url = new URL(to);
  const host = url.hostname;

  // 1. 禁止云元数据 endpoint
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    throw new ValidationError("Forbidden: cloud metadata endpoint");
  }

  // 2. 必须命中白名单
  if (!matchAllowlist(host, SSRF_ALLOWLIST)) {
    throw new ValidationError(`Forbidden: host ${host} not in allowlist`);
  }

  // 3. 禁止 IPv6 link-local
  if (host.startsWith("fe80::"))
    throw new ValidationError("Forbidden: link-local");
}
```

**用户扩展白名单**:通过 `site.routing.allowlist` 显式声明(后台 UI 提示风险):

```json
{
  "routing": {
    "rules": [...],
    "allowlist": ["my-internal-service.docker"]
  }
}
```

### 4.2 路径冲突检测

- 用户的 `from` **不能与 vanblog 保留路径冲突**
- 保留路径:`/api/* /admin/* /static/* /c/* /rss/* /feed.* /sitemap.xml /favicon* /atom.xml`
- 后台 UI 实时提示冲突,不允许保存

### 4.3 配额限制

- 每用户最多 N 条路由(默认 50,可配置)
- 单条路由 `headers` 最多 10 个键值对
- 防止配置爆炸拖慢 Caddy

### 4.4 翻译为 caddy JSON

**翻译过程**(vanblog 中间层负责,不让用户接触 caddy 语法):

```javascript
// 用户配置 → caddy JSON route
function translateRoute(userRule) {
  switch (userRule.type) {
    case "proxy":
      return {
        "@id": `vanblog_${userRule.id}`, // 稳定标识,便于删改
        match: [{ path: [userRule.from] }],
        handle: [
          {
            handler: "reverse_proxy",
            upstreams: [{ dial: parseDial(userRule.to) }],
            headers: { request: userRule.headers || {} },
          },
        ],
      };
    case "redirect":
      return {
        "@id": `vanblog_${userRule.id}`,
        match: [{ path: [userRule.from] }],
        handle: [
          {
            handler: "static_response",
            status_code: userRule.code || 301,
            headers: { Location: [userRule.to] },
          },
        ],
      };
    // ... rewrite / block / header
  }
}
```

**调用 caddy admin api**(用 `@id` 标识,避免位置脆弱):

```
POST /config/apps/http/servers/srv0/routes/...
{ ...translatedRoute }
```

---

## 5. 持久化与启动流程

### 5.1 持久化(关键:caddy admin api 的弱点)

> 调研结论:`POST /load` 或 systemctl restart caddy **会清空 admin api 的临时改动**。

**vanblog 的解决**:

1. **权威源是 `site.routing`(数据库)**,不是 caddy 内存状态
2. **启动流程**:vanblog 启动 → 读 `site.routing` → 翻译为完整路由集合 → `POST /load` 全量替换 caddy config
3. **运行时变更**:用户改 `site.routing` → 中间层校验 → 增量 PATCH/DELETE 单条路由(by `@id`)→ 写入 audit log
4. **Caddyfile 模板**:dev 镜像的 Caddyfile 只包含**启动时必须的静态路由**(tls、admin、核心反代),动态部分全部走 admin api

### 5.2 启动顺序

```
1. Caddy 启动(用最小 Caddyfile,只配 admin + tls)
2. pb 启动
3. pb_hooks 启动钩子:
   a. GET /config/apps/http/servers/srv0/routes  (读取现有路由)
   b. 对比 site.routing,计算 diff
   c. PATCH 增量应用 diff
4. 用户访问 → Caddy 路由 → vanblog / 用户后端
```

---

## 6. 镜像形态与路由能力

| 镜像         | 路由能力    | 说明                                                      |
| ------------ | ----------- | --------------------------------------------------------- |
| **prod**     | ✅ 完整支持 | 与 dev 对齐                                               |
| **dev**      | ✅ 完整支持 | 同 prod + 支持外挂 Astro                                  |
| **外置反代** | 用户自管    | vanblog 输出 Caddyfile / Traefik labels / Nginx conf 片段 |

**prod 与 dev 都内嵌 Caddy 且功能对齐** —— 理由见 [`deployment-strategy.md`](./deployment-strategy.md) §1 和 [`https-strategy.md`](./https-strategy.md) §2。

---

## 7. 迁移影响

| 原项目配置                                         | 重构后                                       |
| -------------------------------------------------- | -------------------------------------------- |
| CaddyfileTemplate 的 `/c/* /custom/* /api/comment` | dev 镜像 Caddyfile 模板自动处理,不需用户配置 |
| 用户想加自定义反代(原项目不支持)                   | `site.routing` JSON 配置,后台 UI 操作        |
| `caddy.provider.ts` 的所有方法                     | pb_hooks 重写,加上校验层                     |
| Caddy admin api 裸暴露(原项目风险)                 | ✂️ 不再对外,只接受 vanblog 中间层调用        |

---

## 8. Audit 与可观测性

**所有路由变更必须留痕**(对比原项目的缺陷):

| 事件                       | 记录到                                           |
| -------------------------- | ------------------------------------------------ |
| 用户添加/修改/删除路由规则 | `logins` 表(扩展为 `audits`)+ 现有 `logins` 改名 |
| 校验失败(SSRF / 路径冲突)  | `audits` 表,带详细错误                           |
| caddy admin api 调用结果   | `audits` 表,带响应码                             |
| Caddy 启动/重载            | pb 启动日志                                      |

**Audit schema**(替代 v2 schema 中的 `logins` 表):

```
audits: {
  actor:    relation(single → users)     // 谁操作
  action:   text                          // "routing.add" / "routing.delete" / ...
  target:   text                          // 操作对象(路由 id / 域名)
  result:   select(success/failure)       // 结果
  detail:   json                          // 错误详情 / diff
  ip:       text
  userAgent: text
  created:  autodate
}
```

`logins` 改为 `audits` 的一个 `action = "auth.login"` 子集(单一表查询更简单)。

---

## 9. 待决细节

1. **中间层实现**:pb_hooks JSVM 调用 caddy admin api 需要 `$http` 内置(待验证);若不行,用 Go extend
2. **UI 预览**:后台路由配置 UI 应提供"试一下"按钮,校验通过才允许保存
3. **路由优先级**:用户路由 vs vanblog 保留路由的优先级(Caddy 是按顺序匹配,用户路由放在 vanblog 路由之后)
4. **Traefik labels 输出**:外置反代用户若用 Traefik,vanblog 生成对应 labels
5. **Rollback**:caddy admin api 调用失败 → 应回滚 `site.routing` 状态(事务)
