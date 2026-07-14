# Vanblog Backup 能力矩阵

> 目标：梳理 vanblog 所有需要备份的数据资产，评估 PocketBase 内置 backup 的覆盖程度，识别缺口。

---

## 1. 数据资产清单

### 1.1 SQLite 数据库

| 数据库文件 | 用途 | PB Backup 覆盖 | 优先级 |
|---|---|---|---|
| `pb_data/data.db` | 主库：全部 vanblog 集合（posts, users, media, site, tags, categories, revisions, visits, audits, moments, bookmarks） | ✅ 完整包含 | P0 |
| `pb_data/auxiliary.db` | PB 辅助数据（日志、缓存、内部状态） | ✅ 完整包含 | P1 |

### 1.2 文件存储

| 路径 | 用途 | PB Backup 覆盖 | 优先级 | 备注 |
|---|---|---|---|---|
| `pb_data/storage/{colId}/{recordId}/*` | 媒体文件（本地模式） | ✅ 完整包含 | P0 | FileField 默认存储位置 |
| S3 bucket（外部） | 媒体文件（S3 模式） | ❌ **不包含** | P0（如启用） | 需单独备份 S3 bucket |
| `pb_data/backups/` | PB 自身 backup 归档 | ⏭️ 主动排除 | — | 防止递归备份 |

### 1.3 配置与代码

| 路径 | 用途 | PB Backup 覆盖 | 优先级 |
|---|---|---|---|
| `pb_data/pb_data.json` | PB settings（S3、邮件等全局配置） | ✅ 完整包含 | P0 |
| `pb_hooks/` | Pack 生成的 JSVM hook 脚本 | ✅ 完整包含 | P1 |
| `pb_migrations/` | 迁移历史 | ✅ 完整包含 | P2 |

### 1.4 运行时/可重建数据

| 路径 | 用途 | PB Backup 覆盖 | 优先级 | 备注 |
|---|---|---|---|---|
| `pb_data/auxiliary.db` | 请求日志、速率限制状态 | ✅ 包含 | P3 | 丢失后自动重建 |
| 容器外 `caddy_data/` | Let's Encrypt 证书缓存 | ❌ **不包含** | P2 | 可自动重新签发 |
| 容器外 `pb_data/autocert/` | PB 自身 TLS 缓存 | ⏭️ 主动排除 | P3 | 可自动重新签发 |

---

## 2. PB `CreateBackup()` 能力矩阵

```
pb_backup_vanblog_20260713150405.zip
├── data.db                     ← ✅ posts, users, site, media, tags, ...
├── auxiliary.db                ← ✅ 日志/缓存（可重建）
├── storage/                    ← ✅ 本地媒体文件
│   ├── {colId1}/
│   │   ├── {recordA}/{file}
│   │   └── {recordB}/{file}
│   └── {colId2}/
│       └── {recordC}/{file}
├── pb_hooks/                   ← ✅ Pack hook 脚本
│   └── *.pbp
├── pb_migrations/              ← ✅ 迁移历史
│   └── *.go / *.js
└── pb_data.json                ← ✅ PB settings
```

### 覆盖度总结

| 类别 | 覆盖率 | 说明 |
|---|---|---|
| 业务数据（集合记录） | **100%** | 全部 vanblog 集合在 `data.db` |
| 本地媒体文件 | **100%** | `storage/` 目录完整归档 |
| 配置 | **100%** | site 集合在 data.db, PB settings 在 pb_data.json |
| 代码（hooks/migrations） | **100%** | 目录完整归档 |
| S3 文件 | **0%** | 需要外部备份策略 |
| TLS 证书 | **0%** | 可自动重新签发，非关键 |

---

## 3. 接入方式

PB v0.39.5 已内置全部 backup API，vanblog **零后端改动**即可使用：

| 操作 | API | 认证 | 状态 |
|---|---|---|---|
| 列出 backups | `GET /api/backups` | superuser | ✅ 现成可用 |
| 创建 backup | `POST /api/backups` | superuser | ✅ 现成可用 |
| 上传 backup | `POST /api/backups/upload` | superuser | ✅ 现成可用 |
| 下载 backup | `GET /api/backups/{key}?token=...` | superuser + file token | ✅ 现成可用 |
| 删除 backup | `DELETE /api/backups/{key}` | superuser | ✅ 现成可用 |
| 恢复 backup | `POST /api/backups/{key}/restore` | superuser | ✅ 现成可用 |

调用方式示例（通过 vanblog SDK）：

```ts
// 创建备份
await pb.collection("_superusers").authWithPassword("admin@...", "xxx");
await pb.send("/api/backups", {
  method: "POST",
  body: JSON.stringify({ name: "pre-upgrade-backup.zip" }),
});

// 列出备份
const list = await pb.send("/api/backups");

// 恢复（会重启进程）
await pb.send("/api/backups/pre-upgrade-backup.zip/restore", {
  method: "POST",
});
```

---

## 4. 缺口与对策

| 缺口 | 影响 | 对策 |
|---|---|---|
| **S3 媒体文件**不在 backup 中 | 如果使用 S3 存储图片，恢复后图片链接失效 | 单独备份 S3 bucket（AWS CLI / rclone）；或定期同步到本地 |
| **恢复会重启进程** | 短暂服务中断（3-10 秒） | 维护窗口执行；Docker 层面自动重启 |
| **无自动备份调度** | 需要手动触发 | 可配置 PB cron 自动备份（`Settings.Backups.Cron` + `CronMaxKeep`），或外部 cron Job 调 API |
| **PB backup 只存本地** `pb_data/backups/` | 备份文件在容器同一卷上，卷损坏则备份丢失 | 结合外部策略：Docker volume snapshot + rsync/cron 将 `pb_data/backups/` 同步到异地 |
| **恢复需 2x 磁盘空间** | 大 volume 可能空间不足 | 监控磁盘；或清理旧备份后再恢复 |

---

## 5. 综合建议

```
┌─────────────────────────────────────────────────────────┐
│                    Backup Strategy                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. PB API 层（零代码改动）                               │
│     └─ 已有 `/api/backups/*` 完整可用                    │
│                                                         │
│  2. 自动调度                                              │
│     └─ PB Settings.Backups.Cron + CronMaxKeep            │
│        或外部 cron: curl POST /api/backups               │
│                                                         │
│  3. 外部冷备（可选）                                      │
│     └─ rsync pb_data/backups/ → 异地存储                 │
│        或 Docker volume snapshot                          │
│                                                         │
│  4. S3 用户额外注意                                       │
│     └─ 单独备份 S3 bucket + 本地 backup 双保险            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**核心结论**：PB v0.39.5 的 backup API 覆盖 vanblog **100% 的业务数据**（`data.db` + `storage/` + 配置），无需任何后端代码改动即可使用。唯一需要注意的缺口是 S3 媒体文件和备份文件本身的外部存储。
