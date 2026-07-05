# 数据迁移功能

## Context

为 VanBlog V4 添加内容迁移入口。两种原始格式：

1. **后台 JSON 导出** (`temp.json`) — 后端已实现 `POST /api/vanblog/migrate/import`，缺前端上传页
2. **目录 tar 打包** (`vanblog.sh backup`) — 缺解包 + 数据替换逻辑

## Analysis

- **Format 1 后端状态**: `vault/internal/migration/migration.go` 已完整实现，`routes.go` 已注册路由
- **Format 2 复杂度**: 需要关闭 pb → 替换数据目录 → 重启，不适合做在线迁移。
  建议方案：在前端引导用户手动操作（上传 tar → 后端解包到 `/tmp` → 提示用户 `docker cp` 替换）
- **Affected files**:
  - `app/src/pages/admin/migrate.astro` — **新建**，迁移上传页面
  - `vault/internal/migration/routes.go` — 添加 GET status + tar 上传路由
  - `vault/internal/migration/migration.go` — 添加 tar 解包 + 校验逻辑
- **Complexity**: medium
- **Risk areas**: 大文件上传 (>100MB JSON 或 >1GB tar)；事务超时

## Phases

### Phase 0: 评论数据迁移支持（Waline → Artalk）

- **Goal**: 迁移完成后引导用户迁移 Waline 评论数据到 Artalk
- **Files**: `app/src/pages/admin/migrate.astro`
- **Steps**:
  - [ ] 迁移结果页增加"评论数据迁移"区域
  - [ ] 展示 Artransfer-CLI 命令（从 Waline 数据库导出 Artrans）
  - [ ] 展示 Artalk 导入命令
  - [ ] 提供一键复制命令按钮
- **Done when**: 用户可按步骤迁移 Waline → Artalk 评论

### Phase 1: 迁移上传 UI（Format 1: JSON）

- **Goal**: 管理员可通过后台页面上传 JSON 文件并执行迁移
- **Files**: `app/src/pages/admin/migrate.astro` (new)
- **Steps**:
  - [ ] 创建 `/admin/migrate` 页面：文件选择器 + 上传按钮 + 结果展示
  - [ ] 前端调用 `POST /api/vanblog/migrate/import` 上传 JSON
  - [ ] 展示导入结果（posts/categories/tags/media 数量、errors 列表）
  - [ ] 在 admin 导航栏添加入口
- **Done when**: 上传 `temp.json` 后显示"导入 42 篇文章、8 个分类、15 个标签"

### Phase 2: Format 2 tar.gz 上传 + 解包

- **Goal**: 接受 tar.gz 文件，解包到临时目录，引导用户手动替换
- **Files**: `vault/internal/migration/migration.go`, `vault/internal/migration/routes.go`
- **Steps**:
  - [ ] `POST /api/vanblog/migrate/import-tar` — 接收 multipart tar.gz
  - [ ] `ImportTar()` — 解包到 `/tmp/vanblog-migrate/`，校验 pb_data 完整性
  - [ ] 返回解包结果 + 手动操作指南
  - [ ] 前端展示操作步骤（`docker cp` 替换 + 重启命令）
- **Done when**: 上传 tar.gz 后显示解包路径和后续操作指令

### Phase 3: 验证 + 文档

- **Files**: `docs/deployment-strategy.md`
- **Steps**:
  - [ ] 用真实 `temp.json` 验证完整迁移流程
  - [ ] 更新部署文档补充迁移步骤
- **Done when**: 端到端可跑通 + 文档完整

## Risks & Mitigations

| Risk                     | Impact   | Mitigation                                            |
| ------------------------ | -------- | ----------------------------------------------------- |
| JSON >100MB 导致事务超时 | 迁移失败 | pb `RunInTransaction` 有内置超时；前端显示进度反馈    |
| tar 解包恶意覆盖系统文件 | 安全     | 解包前校验目录结构，限制在 `/tmp/vanblog-migrate/` 内 |
| pb_data SQLite 被锁定    | 解包失败 | 提示用户先停止 pb                                     |

## Rollback Strategy

- 迁移操作在事务内执行（Format 1），失败自动回滚
- Format 2 仅解包到 /tmp，不修改活跃数据
