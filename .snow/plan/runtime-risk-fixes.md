# 修复运行时风险 + 架构加固

## Context

QA 二轮审查后，代码逻辑错误已修复。但审查中发现更深层问题：Admin 无 auth gate、图片 URL 硬编码 127.0.0.1、entrypoint 无进程守护、uploadImages 无错误处理等。这些问题不是孤立的 bug，反映出几个系统性缺失：

1. **Admin 页面缺少认证约定** — 每个页面各自判断，容易遗漏
2. **pb 文件 URL 生成散落在前端** — 编辑器和文章页各自拼接，不统一
3. **容器编排缺少健康检查和进程管理** — sleep 2 硬编码，崩溃无感知

## Analysis

- **Affected files**:
  - `app/src/middleware.ts` — 加 auth gate helper（所有 admin 页共用）
  - `app/src/pages/admin/index.astro` — 接线 auth gate
  - `app/src/pages/admin/edit/[id].astro` — 接线 auth gate
  - `app/src/components/ByteMdEditor.astro` — uploadImages 错误处理 + 图片 URL 改相对路径
  - `docker/entrypoint.prod.sh` — 健康检查轮询 + trap 进程守护
  - `docker/entrypoint.dev.sh` — 同上
  - `docker/Caddyfile.prod` — 删除死路由 `handle_path /api/files/*`
  - `docker/Caddyfile.dev` — 同步检查
- **New files**: 无
- **Dependencies**: 无新增
- **Complexity**: medium
- **Risk areas**: entrypoint 改动影响容器启动流程，需仔细测试

## Phases

### Phase 1: Admin auth gate + middleware helper

- **Goal**: 建立统一的 admin 认证检查机制，未登录时 redirect 到 pb Admin UI
- **Files**: `app/src/middleware.ts`, `app/src/pages/admin/index.astro`, `app/src/pages/admin/edit/[id].astro`
- **Steps**:
  - [ ] middleware.ts: 新增 `requireAuth(context)` helper，检查 `client.authStore.isValid`，无效时返回 redirect 到 `/_/`
  - [ ] admin/index.astro: SSR frontmatter 调用 `requireAuth(Astro)`，未登录 redirect
  - [ ] admin/edit/[id].astro: 同上
  - [ ] 构建验证 `tsc --noEmit` + `pnpm build`
- **Done when**: tsc + build 通过；admin 页面未登录时返回 302 redirect

### Phase 2: 编辑器图片上传修复（错误处理 + 相对 URL）

- **Goal**: uploadImages 失败时给用户反馈；图片 URL 使用相对路径，不再硬编码 127.0.0.1
- **Files**: `app/src/components/ByteMdEditor.astro`
- **Steps**:
  - [ ] uploadImages: 每个 file 上传加 try/catch，失败跳过该文件，全部失败时 alert
  - [ ] uploadImages: `pb.files.getRecordUrl()` 改为手动拼接相对路径 `/api/files/media/${rec.id}/${rec.file}`
  - [ ] 构建验证
- **Done when**: tsc + build 通过；上传失败有用户反馈；生成的 URL 是 `/api/files/...` 格式

### Phase 3: Docker entrypoint 进程管理 + 健康检查

- **Goal**: 替换 `sleep 2` 为轮询健康检查；pb/Astro 崩溃时容器退出而非僵尸
- **Files**: `docker/entrypoint.prod.sh`, `docker/entrypoint.dev.sh`
- **Steps**:
  - [ ] 新增 `wait_for(url, name, timeout)` 函数：轮询 HTTP 端点直到 ready
  - [ ] pb 启动后调用 `wait_for http://127.0.0.1:8090/api/health "PocketBase" 30`
  - [ ] Astro 启动后调用 `wait_for http://127.0.0.1:4321/ "Astro SSR" 30`（dev 用 4321）
  - [ ] Caddy 前台运行前确保两个服务已 ready
  - [ ] 添加 `trap` 信号处理：Caddy 收到 SIGTERM 时 kill 子进程后退出
  - [ ] 后台进程加 `wait -n PB_PID ASTRO_PID` 监控（任一崩溃则全部退出）
- **Done when**: 脚本语法检查 `sh -n` 通过；逻辑正确

### Phase 4: Caddyfile 清理 + 小修

- **Goal**: 删除死路由、同步 dev Caddyfile
- **Files**: `docker/Caddyfile.prod`, `docker/Caddyfile.dev`
- **Steps**:
  - [ ] Caddyfile.prod: 删除 `handle_path /api/files/*` 块（被 `/api/*` handle 先匹配，永不执行）
  - [ ] Caddyfile.dev: 同步检查是否有同样问题
  - [ ] entrypoint: VANBLOG_EMAIL 为默认值时打印警告
- **Done when**: `caddy validate` 通过（如果容器可用）或人工审查通过

## Risks & Mitigations

| Risk                                 | Impact          | Mitigation                                                                 |
| ------------------------------------ | --------------- | -------------------------------------------------------------------------- |
| requireAuth 逻辑误判                 | 管理员被踢出    | 仅检查 `authStore.isValid`（token 存在且未过期），不额外验证角色           |
| 相对 URL 在 SSR 预览中不工作         | 图片可能不显示  | pb 在同域，Caddy 反代 `/api/files/*` 到 pb，相对路径在 SSR 和 CSR 都能工作 |
| wait_for 超时导致容器无法启动        | 服务不可用      | 设 30s 超时，足够冷启动；超时后打印诊断信息并退出（比静默 502 好）         |
| trap + wait -n 在 Alpine sh 中不可用 | entrypoint 失败 | Alpine 用 busybox sh，支持 trap 和 wait；`wait -n` 不支持则用轮询          |

## Completion Summary

**Status**: Completed
**Phases**: 4 / 4

### Results

- **Phase 1**: middleware.ts 导出 `isAuthenticated()` helper；admin/index.astro 和 admin/edit/[id].astro 未登录时 302 redirect 到 `/_/`（pb Admin UI）
- **Phase 2**: uploadImages 每个 file 独立 try/catch，失败跳过不影响其他文件；全部失败 alert 提示；图片 URL 改为相对路径 `/api/files/media/${id}/${file}`（不再硬编码 127.0.0.1）
- **Phase 3**: entrypoint.prod.sh 和 entrypoint.dev.sh 重写：`wait_for()` 健康检查轮询（30s 超时）替换 sleep 2；`trap cleanup` 确保 SIGTERM/SIGINT 时 kill 子进程；后台 monitor 线程每 5s 检查 pb/Astro 进程存活，任一崩溃则容器退出；VANBLOG_EMAIL 为默认值时打印警告
- **Phase 4**: Caddyfile.prod 和 Caddyfile.dev 删除 `handle_path /api/files/*` 死路由（被 `/api/*` handle 先匹配，永不执行）

### Verification

- [x] `tsc --noEmit`: 0 errors
- [x] `pnpm build`: passes
- [x] `go build && go test && go vet`: all pass
- [x] `sh -n entrypoint.*.sh`: syntax OK

### Follow-up

- 考虑给 ScanArticleImages 加 debounce（目前每次 post update 都扫描）
- 考虑给 middleware site 缓存加负面缓存区分（fetch 失败后 60s 内不重试）
