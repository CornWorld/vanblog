# 禁用 PocketBase 浏览器自动打开行为

## Status: ✅ Completed

## Context

PocketBase v0.39.5 在首次启动（没有自定义超管用户时）会自动打开浏览器访问安装页面。这是通过 `apis.DefaultInstallerFunc` 实现的，其调用链为：

1. `apis/serve.go` 设置 `serveEvent.InstallerFunc = DefaultInstallerFunc`
2. `OnServe` hook 的 finalizer 异步调用 `loadInstaller()` → `DefaultInstallerFunc()`
3. `DefaultInstallerFunc` 调用 `osutils.LaunchURL(url)` → 底层执行 `open` (macOS) / `rundll32` (Windows) / `xdg-open` (Linux)

在 vanblog 中，由于项目运行在 Docker 容器内，这个行为没有实际效果（容器内没有浏览器），但会产生不必要的错误日志和资源浪费。

## Analysis

- **Affected files**:
  - `vault/main.go` — 需要修改 OnServe hook，设置 `event.InstallerFunc = nil`
- **New files**: 无
- **Dependencies**: 无外部依赖
- **Complexity**: 简单
- **Risk areas**: 极低风险。`InstallerFunc` 仅在首次安装时用于创建第一个超管用户，vanblog 已经通过 `bootstrap.New(app)` 和 Caddy 集成提供了自己的管理面板配置流程，不需要 pb 默认的安装器

## Phases

### Phase 1: 在 OnServe hook 中禁用浏览器打开
- **Goal**: 阻止 PocketBase 启动时自动打开浏览器
- **Files**: `vault/main.go`
- **Steps**:
  - [ ] 在已有的 `app.OnServe().BindFunc(...)` 中，`return event.Next()` 之前添加 `event.InstallerFunc = nil`
- **Done when**: `event.InstallerFunc = nil` 已添加，`go build` 通过，没有诊断错误

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 影响首次安装体验 | 低 — 不再自动弹浏览器 | vanblog 有完整的 bootstrap + Caddy 配置流程替代 pb 默认安装器；用户仍可通过 `/admin` 访问管理面板 |
| 与未来 pb 版本冲突 | 低 — `InstallerFunc` 字段是 `core.ServeEvent` 的稳定公共 API | 如果用新 pb 版本，确认该字段仍然可用 |

## Rollback Strategy

使用 `git revert` 回退对 `vault/main.go` 的修改，或者直接删除添加的行即可恢复。
