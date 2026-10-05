---
title: Pack 参考
---

# Pack — 事实 (SSOT)

> Pack = 可插拔的扩展单元（主题、前端贡献、自声明集合）。使用文档见 [guide/packs.md](../guide/packs.md)。

## 什么是 Pack

Pack 是 vanblog 的扩展单元，通过 `pack.json` 描述自身，可携带：
- **前端贡献**：`pages/`（路由页，如 `/p/bookmarks`）、`components/`、`hooks/`（JSVM 钩子）
- **自声明集合**：`migrations/*.js`（pb 迁移，Pack 可自建数据集合）
- **导航项**：`pack.json` 的 `nav` 字段（如收藏 → `/p/bookmarks`）

## pack.json 格式

```json
{
  "name": "bookmarks",
  "version": "1.0.0",
  "title": "收藏",
  "nav": { "label": "收藏", "href": "/p/bookmarks" },
  "frontend": {
    "scope": "public",
    "styles": ["style.css"],
    "scripts": ["script.js"],
    "static": ["widget"]
  }
}
```

- `styles`/`scripts`:**运行时注入**。SSR 布局每请求从
  `GET /api/vanblog/packs/frontend`（匿名，10s 缓存）读取清单，把
  `/pack-static/<pack>/<file>` 以 `<link>` / `<script type="module">` 注入每页。
  文件从**活目录**（内置 `/packs` + 用户卷，用户覆盖优先）经 Go 文件服务直出，
  ETag 重验（304）——装包/改文件即生效，无需 theme rebuild。
- `static`:列 `frontend/` 下的子目录,整树原样服务于同一
  `/pack-static/<pack>/<dir>/` URL 空间,供按相对路径加载兄弟文件的第三方 widget
  (如 live2d-widgets 的 `chunk/` 动态分块)。目录必须存在,拒绝越界路径。
  Caddy 有专用的 `/pack-static/*` 系统路由反代 PB(用户自定义路由不得占用,
  见 translator ReservedPaths);dev 模式由集成中间件按同前缀服务。
  示例:`packs/live2d-companion`。

### 前端生效边界

- `frontend/`（styles/scripts/static）与 `nav`:**装进卷即生效**(清单每请求
  重组;已缓存页面最迟 `maxAge`(默认 300s)后刷新,`PUT /api/vanblog/custom-code`
  会主动触发缓存失效)。
- `pages/*.astro`:**仍是 build-time**(需编译,内置 pack 随镜像/主题构建烧入)。
  运行时安装的 pack 没有编译产物,`/p/<name>` 页面 404——hooks/migrations/schema
  照常生效。

## 自定义代码(admin)

`PUT /api/vanblog/custom-code`(admin-only,body `{"css":"...","js":"..."}`,单项
≤512KiB)把站长手写的 CSS/JS 写成受管伪 pack `site-custom`(落盘
`VANBLOG_PACKS_DIR/site-custom`,带 `.vanblog-managed` 标记;两项均空则卸载)。
它与 CLI 安装的用户 pack 走**同一条机制**——同清单、同 `/pack-static` 服务、
同下次启动时的 pack 校验。名字 `site-custom` 保留:已存在非受管同名 pack 时
返回 400 拒绝覆盖。

## 生命周期与安装位置

- 内置 Pack：镜像内（`/build/packs`，只读）。
- 用户 Pack：持久卷 `VANBLOG_PACKS_DIR`（默认 `/var/lib/vanblog/packs`）。**用户覆盖优先**。
- `vanblog.sh pack list` 列出已安装 Pack；`pack status` 看生命周期状态；`pack plan` 部署预检（只读）；`pack inspect <name>` 看详情；`pack add <name>` 添加本地覆盖。
- 新写 Pack：`node scripts/build/pack-init.mjs <name> [dest]`（模板在 `scripts/pack-template/`，含 `__NAME__` 占位替换与 hook 文件重命名）。

## 现有 Pack（内置）

| Pack | title | 说明 |
|---|---|---|
| `bookmarks` | 收藏 | 收藏夹页，路由 `/p/bookmarks` |
| `moments` | 说说/动态 | 短动态流 |
| `online` | 当前在线 | 会话心跳在线人数 |
| `live2d-companion` | — | Live2D 看板娘（widget 已 vendor 本地化） |
> **权威 API 清单**：PB 0.39.5 启动时会把完整 JSVM 类型声明写入 hooks 目录（`types.d.ts`，787KB）——即 `docs/reference/pb-jsvm-types.d.ts`（仓库内留存，与运行时同版本）。它声明了**全部**可用全局与签名（`routerAdd`/`routerUse`/`$app`/`$security`/`$apis`/`$dbx`/`$os`/`$filepath`/事件对象等）。**写 hook 前先 `grep` 这份文件确认 API 存在与签名**，例如：
>
> ```bash
> grep -n "declare function routerAdd" docs/reference/pb-jsvm-types.d.ts
> grep -n "namespace \$security" docs/reference/pb-jsvm-types.d.ts
> ```
>
> 升级 PB 后此文件需随版本同步（从新版本 `plugins/jsvm/internal/types/generated/types.d.ts` 重新复制）。

### 顶层限制

- hook 顶层**不能声明 `const`/`function`/`let`**：`routerAdd` 回调会在 executor VM 中被重新编译执行，顶层变量不可见。所有逻辑内联进回调（参考 `packs/online/hooks/online.pb.js`）。
- 每个 `.pb.js` 会被级联为 `pack--<name>--<orig>.pb.js`，路由注册在加载时完成。

### 路由与请求

```js
routerAdd("GET", "/api/packs/<name>/xxx", (c) => { … });
routerAdd("POST", "/api/packs/<name>/yyy", (c) => { … });
```

- 回调参数 `c` 是 PB 的 `core.RequestEvent`（可命名 `e`）：
  - `c.request.url.query()` → 查询参数 map（`q.get("key")`）
  - `c.request.body` → **`io.Reader`**；读 JSON body 用 `toString(c.request.body)` + `JSON.parse`
  - `c.json(status, obj)` → JSON 响应；`c.error(status, msg)` 亦可
- 路由前缀统一用 `/api/packs/<name>/…`（自定义业务路由 `/api/vanblog/*` 是 Go 层的，hook 不要抢占）。

### 可用全局（PB 0.39）

| 全局 | 用途 | 例 |
|---|---|---|
| `$app` | 查集合/记录 | `$app.findCollectionByNameOrId("site_visits")` |
| `$security` | 哈希/随机串/JWT | `$security.sha256(text)`（**hex 字符串**）、`$security.randomString(n)`、`$security.hs256(text, secret)` |
| `$apis` | 仅 record CRUD handler 上下文（`onRecord*` 回调） | `$apis.requestInfo(e)` |
| `$dbx` / `$os` / `$filepath` | 查询构造 / OS / 路径 | — |

- **难度 = 前导 `0` hex 字符数**：verify 用 `"0".repeat(difficulty)` 做 hex 前缀匹配（`$security.sha256` 返回 64 位 hex）。challenge 建议读 `?min=&max=` 查询参数（默认 1..3）；**difficulty 上限 ≤ 4**（2^16 次求解，超过 evaluator 的 50 万次预算会解不出）。
- 响应结构建议：challenge 返回 `{ challenge, difficulty, algorithm, ttl }`；verify 返回 `{ ok, token }`。

### 不存在的 API（会 400，且日志无报错）

以下写法**在 PB 0.39 不存在**，运行时报 400 且上层静默（错误只在 staging 日志）：

- `$crypto`（无此全局）→ 用 `$security`
- `$apis.requestInfo(c)` 用在 `routerAdd` 回调里（只属于 record CRUD hook）→ 直接读 `c.request.body`
- `info.data`（`RequestInfo` 字段是 `body`）→ `info.Body` 或直接读 body

> 排查手段：hook 加载失败会在 PB 启动日志出现 `failed to execute pack--<name>--<orig>.pb.js`（SyntaxError/ReferenceError）；运行期 handler 抛错则返回 400 且日志无痕——用 `try/catch` + `console.log` 探针定位。
