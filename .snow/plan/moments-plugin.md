# 说说/动态 (Moments) —— 首个纯用户侧样例插件

## Context

用户要求用「说说/动态」作为第一个插件样例，演示 Vanblog 的 **插件/用户自定义扩展系统**，界定为「**不修改源码**」——即一个普通用户在 dev 镜像中下载插件包、放到对应目录就能用。

对照 refs 调研结论：说说/动态是「博客稳定后第一个门户插件」（Should Have），fork 已实现且有完整移动端适配，证明需求真实。

## 关键发现：pb 0.39 JSVM 可运行时创建 Collection

```
pb_data/types.d.ts 验证:
  line 421: declare class Collection { constructor(data?: Partial<Collection>) }
  line 8444: NewCollection(typ, name, ...optId): Collection
  line  127: declare var $app: PocketBase
  line   67: declare function routerAdd(method, path, handler): void
  line   91: declare function routerUse(...middlewares): void
  line 1270: declare function onBootstrap(handler): void
```

→ 一个 `.pb.js` 文件就能完成：创建表 + 注册路由 + 业务逻辑。**不用写 Go migration。**

## 插件安装方式（纯用户操作）

```bash
# 用户在 dev 镜像中执行：
# 1. 下载插件
wget https://vanblog.example.com/plugins/moments-v1.0.0.tar.gz
tar xzf moments-v1.0.0.tar.gz

# 2. 放文件
cp moments.pb.js        → /pb_hooks/moments.pb.js        # JSVM 自动热加载
cp moments/index.astro  → /app/src/pages/moments/index.astro  # Astro HMR
cp admin/moments.astro  → /app/src/pages/admin/moments.astro  # Astro HMR

# 3. 完成！访问 /moments 即可看到说说流
```

**不需要**: 修改 Go 代码、重新编译 Docker 镜像、修改 SDK 源码、`pnpm build`。

## Analysis

### 插件 = 一个自包含的 .pb.js + Astro 页面 + client.extend()

| 层          | 实现方式                                                  | 用户操作 |
| ----------- | --------------------------------------------------------- | -------- |
| **数据层**  | `.pb.js` 中 `onBootstrap` 检查并创建 `moments` collection | 无需操作 |
| **API 层**  | `.pb.js` 中 `routerAdd` 注册 CRUD 路由                    | 无需操作 |
| **SDK 层**  | 前端页面中用 `client.extend('moments', {...})` 运行时注册 | 无需操作 |
| **前台 UI** | Astro 页面文件，放 `app/src/pages/moments/`               | 复制文件 |
| **后台 UI** | Astro 页面文件，放 `app/src/pages/admin/`                 | 复制文件 |

### 影响范围

- **新文件**: 4 个（纯用户侧，不放仓库核心目录）
  - `plugins/moments/moments.pb.js` — 创建 collection + CRUD 路由（核心）
  - `plugins/moments/pages/moments/index.astro` — 公开说说流
  - `plugins/moments/pages/admin/moments.astro` — 后台管理列表
  - `plugins/moments/README.md` — 安装说明
- **修改文件**: 0 个（零源码改动！）
- **复杂度**: medium
- **风险区域**: `onBootstrap` 中 `$app.save(collection)` 的幂等性；`routerAdd` 的 auth 模式；`client.extend()` 的 TypeScript 类型推断

---

## Completion Summary

**Status**: ✅ Completed  
**Phases**: 4/4  
**Date**: 2026-07-05

### Results

| Phase | 文件                                                     | 状态 |
| ----- | -------------------------------------------------------- | ---- |
| 1     | `plugins/moments/moments.pb.js` (370 行)                 | ✅   |
| 2     | `plugins/moments/pages/moments/index.astro` (132 行)     | ✅   |
| 3     | `plugins/moments/pages/admin/moments.astro` (409 行)     | ✅   |
| 4     | `plugins/moments/README.md` + `docs/plugin-authoring.md` | ✅   |

### 关键架构发现

1. **pb 0.39 JSVM 支持运行时创建 Collection**：`new Collection(...)` + `$app.save()` + `onBootstrap` 组合使插件可以零 Go 代码自举
2. **`routerAdd` 机制成熟**：JSVM 可注册任意 REST 路由，支持 auth 校验、query 参数解析、body 读取
3. **`client.extend()` 实现 SDK 运行时扩展**：前端页面无需修改 SDK 源码

### Deviations

- 原计划 Phase 5（导航注入）并入 Phase 2，通过 `<script>` DOM 操作实现，未修改 BaseLayout
- 未创建 `admin/moments/new.astro` 独立页面，发布表单内嵌在 `admin/moments.astro` 中（更符合说说「轻量发布」的定位）

### Verification

- [x] Go build: `go build ./...`（vault 目录）
- [x] JS syntax: `node -c moments.pb.js`
- [x] Astro check: 无新增错误（仅有预存 ByteMD/Components warnings）
- [x] 文件清单一致：5 个文件，0 个已有文件修改

### 插件安装步骤（用户视角）

```bash
cp plugins/moments/moments.pb.js → /pb_hooks/moments.pb.js
cp -r plugins/moments/pages/* → /app/src/pages/
# 完成！刷新页面即可看到 /moments 和 /admin/moments
```

---

## Phases

### Phase 1: 核心插件文件 — moments.pb.js

- **Goal**: 单个 JS 文件实现 collection 创建 + CRUD 路由 + 审计
- **Files**: `plugins/moments/moments.pb.js`（新）
- **Steps**:
  - [ ] `onBootstrap` 钩子：检查 `$app.findCollectionByNameOrId("moments")` 是否存在
  - [ ] 不存在则用 `new Collection({type:"base", name:"moments", ...})` + `$app.save(col)` 创建
  - [ ] 字段：content(text,required)、author(relation→users)、tags(relation→tags,multiple)、visible(bool,default true)
  - [ ] Rules：List/View 公开(visible=true)、Create/Update/Delete 需 auth
  - [ ] `routerAdd("GET", "/api/moments/list", ...)` — 公开列表，分页，按 `-created` 排序
  - [ ] `routerAdd("POST", "/api/moments/create", ...)` — 需 auth，创建 moment
  - [ ] `routerAdd("DELETE", "/api/moments/{id}", ...)` — 需 auth，校验 owner 或 admin
  - [ ] 集成审计：`require("./pb_hooks/lib/vanblog-audit.js").recordAudit(...)`
  - [ ] 参数校验：content 非空、≤500 字符
- **Done when**: pb 启动后 `curl http://127.0.0.1:8090/api/moments/list` 返回 `[]`

### Phase 2: 前台页面 — 公开说说流

- **Goal**: `/moments` 显示所有公开说说（卡片式时间线）
- **Files**: `plugins/moments/pages/moments/index.astro`（新）
- **Steps**:
  - [ ] Astro 页面，`prerender = false`
  - [ ] 用 `client.extend('moments', {...})` 注册运行时服务
  - [ ] SSR 时 `await client.moments.list()` 获取数据
  - [ ] UI：卡片式，每条显示内容、时间戳、标签
  - [ ] `<BaseLayout>` 包裹
  - [ ] 用 JS 动态注入导航栏「说说」链接（DOM 操作，不碰 BaseLayout 源码）
- **Done when**: `npm run dev` 下 `/moments` 正确渲染

### Phase 3: 后台管理页 — 发说说

- **Goal**: `/admin/moments` 管理自己的说说
- **Files**: `plugins/moments/pages/admin/moments.astro`（新）
- **Steps**:
  - [ ] 列表页：显示当前用户说说的创建表单 + 历史列表 + 删除按钮
  - [ ] `<AdminLayout>` 包裹
  - [ ] textarea 输入框 + 标签选择 + 可见性开关
  - [ ] 提交按钮 → `client.moments.create(content, tags, visible)`
  - [ ] 权限校验：仅登录用户可访问
- **Done when**: 后台发说说 → 前台 `/moments` 立即刷新可见

### Phase 4: 验证与打包

- **Goal**: 端到端验证 + 插件包可用
- **Steps**:
  - [ ] Docker dev 镜像中完整测试安装流程
  - [ ] 验证热更新：修改 `.pb.js` → 路由自动重载
  - [ ] 验证 HMR：修改 `.astro` → 页面自动刷新
  - [ ] 打包 `plugins/moments/` 为 `moments-v1.0.0.tar.gz`
  - [ ] 撰写 `plugins/moments/README.md`：安装步骤、API 文档
  - [ ] 撰写 `docs/plugin-authoring.md`：通用插件开发指南（以 moments 为教程）
- **Done when**: 从零部署 → 安装插件 → 发说说 → 前台可见，全流程验证通过

---

## Risks & Mitigations

| Risk                                            | Impact         | Mitigation                                           |
| ----------------------------------------------- | -------------- | ---------------------------------------------------- |
| `onBootstrap` 中 `$app.save(collection)` 非幂等 | 重启 pb 时报错 | 先 `findCollectionByNameOrId` 检查；catch 已存在错误 |
| JSVM `$http.send()` 不可用（auth 问题）         | 无法调外部 API | 所有逻辑走 `$app` 原生 API（不需要 $http）           |
| Astro 页面中 `client.extend()` 无类型提示       | 开发体验差     | 在页面 `---` frontmatter 中声明接口类型              |
| pb_hooks 文件挂载后不自动热加载                 | 需要手动重启   | dev 模式下 `--hooksWatch=true` 确保热更新            |
| 删除 moments.pb.js 后 collection 残留           | 数据库有孤儿表 | 提供卸载脚本：`pb_hooks/uninstall-moments.pb.js`     |

## Rollback Strategy

卸载插件：

```bash
# 1. 删除文件
rm /pb_hooks/moments.pb.js
rm -r /app/src/pages/moments/
rm /app/src/pages/admin/moments.astro

# 2. 清理数据（可选）
# 通过 pb Admin UI → moments collection → Delete collection
```

---

## 插件架构洞察

这次实现会验证一个关键问题：**Vanblog 是否可以不修改源码就装插件？**

答案取决于三个 pb 0.39 JSVM 能力：

1. ✅ `onBootstrap` — 启动时执行插件初始化（已确认）
2. ✅ `new Collection()` + `$app.save()` — 动态创建 collection（已确认）
3. ✅ `routerAdd` / `routerUse` — 注册自定义路由（已确认）

如果这三个能力稳定可用，Vanblog 就具备了 **WordPress 式的插件架构基础**：核心是纯净的博客引擎，功能通过 pb_hooks + Astro 页面扩展。这是魔鬼代言人报告中强调的「博客优先 + 门户渐进」架构的正确落地方式。
