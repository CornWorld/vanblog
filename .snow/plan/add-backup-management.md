# 增加 Backup 管理能力

## Context
在 /admin 增加 PocketBase v0.39.5 备份管理（列表、创建、下载、删除、恢复），仅 Vanblog users.role=admin 可用。采用 Vanblog 自有代理路由，不暴露 superuser token。

## Phases

### Phase 1: 后端 Backup 管理边界 ✅
- vault/internal/admin/admin.go: 注册 5 条 /api/vanblog/backups 路由
- vault/internal/admin/backups.go: CreateBackup/RestoreBackup/NewBackupsFilesystem 封装
- vault/internal/admin/admin_test.go: key 校验、命名、生命周期、冲突检测

### Phase 2: SDK 与后台管理页面 ✅
- sdk/src/services.ts: BackupFile 类型 + vanblog.backups namespace
- sdk/src/index.ts: 导出 BackupFile
- app/src/pages/admin/backups.astro: 管理 UI
- app/src/pages/admin/index.astro: 导航入口

### Phase 3: 全量构建验证 ✅
- go test ./... 通过
- SDK tsc --noEmit 通过
- Astro check + build 通过
