# PocketBase v0.39.5 官方能力全景

> 按「vanblog 是否已利用」分三层：✅ 已利用 / ⚡ 可利用但未用 / ❌ 不适用

---

## 一、REST API

### 1.1 记录 CRUD — `/api/collections/{name}/records`

| 操作 | 端点 | 认证 | vanblog 状态 |
|---|---|---|---|
| 列表/搜索 | GET | listRule | ✅ SDK 和自定义 handler 均用 |
| 查看单条 | GET /{id} | viewRule | ✅ |
| 创建 | POST | createRule | ✅ |
| 更新 | PATCH /{id} | updateRule | ✅ |
| 删除 | DELETE /{id} | deleteRule | ✅ |
| **批量操作** | **POST /api/batch** | **需开启** | **⚡ 未用** |

> **批量 API** (`/api/batch`) 可在单个事务内执行多个 create/update/delete，对导入/迁移场景有用。需要 Settings 中显式启用。

### 1.2 集合管理 — `/api/collections`（superuser only）

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 列表 | GET | ⚡ 未用（vanblog 有自定义 `/api/vanblog/schema`） |
| 查看 | GET /{name} | ⚡ 未用 |
| 创建 | POST | ✅ 通过 pb_migrations 迁移 |
| 更新 | PATCH /{name} | ✅ 通过 pb_migrations |
| 删除 | DELETE /{name} | ✅ |
| **清空** | **DELETE /{name}/truncate** | **⚡ 未用** |
| **批量导入** | **POST /api/collections/import** | **⚡ 未用** |

### 1.3 文件 — `/api/files`

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 下载/缩略图 | GET /{col}/{id}/{filename} | ✅ 通过 FileField 自动 |
| **生成文件 token** | **POST /api/files/token** | **⚡ 未用**（当前可能不需要受保护文件） |

### 1.4 认证 — `/api/collections/{name}/auth-*`

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 列出认证方式 | GET /auth-methods | ⚡ 未用 |
| 密码登录 | POST /auth-with-password | ✅ |
| OAuth2 登录 | POST /auth-with-oauth2 | ❌ 未用（vanblog 用户少，不需要） |
| **OTP 登录** | **POST /request-otp / auth-with-otp** | **⚡ 未用** |
| Token 刷新 | POST /auth-refresh | ✅ |
| 邮件验证 | POST /request-verification / confirm-verification | ❌ 未用 |
| 密码重置 | POST /request-password-reset / confirm-password-reset | ❌ 未用 |
| 邮箱更改 | POST /request-email-change / confirm-email-change | ❌ 未用 |
| **模拟用户** | **POST /impersonate/{id}** | **⚡ 未用**（superuser 以其他用户身份操作） |

### 1.5 Backup — `/api/backups`（superuser only）

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 列表 | GET | ⚡ 未用（可直接用） |
| 创建 | POST | ⚡ 未用（可直接用） |
| 上传 | POST /upload | ⚡ 未用 |
| 下载 | GET /{key} | ⚡ 未用 |
| 删除 | DELETE /{key} | ⚡ 未用 |
| 恢复 | POST /{key}/restore | ⚡ 未用 |
| **自动备份调度** | **Settings.Backups.Cron + CronMaxKeep** | **⚡ 未用** |
| **备份存 S3** | **Settings.Backups.S3** | **⚡ 未用** |

### 1.6 设置 — `/api/settings`（superuser only）

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 查看设置 | GET | ❌ 未用（vanblog 通过 site 集合管理配置） |
| 更新设置 | PATCH | ✅ 用于同步 S3 配置（`ApplyS3BackendToSettings`） |
| **测试 S3 连接** | **POST /test/s3** | **⚡ 未用** |
| **发送测试邮件** | **POST /test/email** | **⚡ 未用** |
| **生成 Apple secret** | **POST /apple/generate-client-secret** | ❌ 不适用 |

### 1.7 日志 — `/api/logs`（superuser only）

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 列表 | GET | ⚡ 未用 |
| 查看单条 | GET /{id} | ⚡ 未用 |
| **统计** | **GET /stats** | **⚡ 未用**（按小时聚合） |

### 1.8 Cron — `/api/crons`（superuser only）

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 列出任务 | GET | ⚡ 未用 |
| **手动触发** | **POST /{jobId}** | **⚡ 未用** |

内置 cron 任务：
| ID | 表达式 | 用途 |
|---|---|---|
| `__pbDBOptimize__` | `0 0 * * *` | 每日数据库优化 |
| `__pbMFACleanup__` | `0 * * * *` | 每小时 MFA 清理 |
| `__pbOTPCleanup__` | `0 * * * *` | 每小时 OTP 清理 |
| `__pbLogsCleanup__` | `0 */6 * * *` | 每 6 小时日志清理 |

### 1.9 SQL — `/api/sql`（superuser only）

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| **执行原始 SQL** | **POST /api/sql** | **⚡ 未用**（谨慎使用，用于诊断/分析） |

### 1.10 健康检查 — `/api/health`

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| 健康检查 | GET | ⚡ 未用（启动脚本用 wget 检查） |

### 1.11 实时订阅 — `/api/realtime`（SSE）

| 操作 | 端点 | vanblog 状态 |
|---|---|---|
| SSE 连接 | GET | ❌ 未用 |
| 订阅变更 | POST | ❌ 未用 |

---

## 二、Go Framework 能力

### 2.1 事件/Hook 系统（vanblog 已大量使用 ✅）

| 事件 | vanblog 用途 |
|---|---|
| `OnServe()` | 路由注册、Pack 解包、S3 同步、Caddy 配置推送 |
| `OnRecordAfterCreateSuccess("media")` | MD5 去重 |
| `OnRecordAfterUpdateSuccess("site")` | 重新应用 S3 配置 |
| `OnRecordAfterCreateSuccess("posts")` | 扫描文章图片引用 |
| `OnRecordAfterUpdateSuccess("posts")` | 扫描文章图片引用 |
| `OnBootstrap()` | 未用（vanblog 选择 OnServe 作为初始化时机） |
| `OnTerminate()` | 未用（Caddy 优雅关闭由 entrypoint 管理） |
| `OnRecordBeforeXxx` | 未用 |
| **`OnBackupCreate()`** | **⚡ 未用** — backup 前后可注入自定义逻辑 |
| **`OnBackupRestore()`** | **⚡ 未用** — restore 前后可注入自定义逻辑 |

### 2.2 JSVM 插件系统（pb_hooks）✅

vanblog 通过 Pack 系统生成 `.pbp` hook 文件，已支持。

### 2.3 迁移系统（pb_migrations）✅

vanblog 已使用 Go 迁移文件定义集合 schema。

### 2.4 CLI 命令

| 命令 | vanblog 状态 |
|---|---|
| `serve` | ✅ 使用中 |
| `superuser` | ❌ 未用（vanblog 用自身 users 集合） |
| `migrate` | ✅ 内置使用 |
| `version` | ✅ 可通过 `go build` 注入 |
| **`backup create`** | **⚡ 未用** |
| **`backup restore`** | **⚡ 未用** |
| **`admin`** | ❌ 不使用 pb 的 _superusers |

---

## 三、内置系统功能

| 功能 | vanblog 状态 | 备注 |
|---|---|---|
| **限流** | ⚡ 未用 | Settings.RateLimits 可配置 API 限流规则 |
| **批量 API** | ⚡ 未用 | Settings.Batch 需开启 |
| **日志系统** | ⚡ 未用 | PB 自带请求日志，vanblog 另建了 audits 审计表 |
| **SMTP 邮件** | ❌ 未用 | vanblog 未内置邮件发送功能 |
| **OAuth2** | ❌ 未用 | 用户量小，密码认证足够 |
| **MFA 多因素** | ❌ 未用 | |
| **OTP 一次性密码** | ❌ 未用 | |
| **Trusted Proxy** | ⚡ 未用 | 反代场景应配置 `Settings.TrustedProxy` 获取真实 IP |
| **备份 S3 存储** | ⚡ 未用 | backup 可存到独立 S3 bucket，与媒体文件 S3 分开 |

---

## 四、⚡ 最值得 vanblog 利用的能力（按优先级）

| 优先级 | 能力 | 原因 |
|---|---|---|
| **P0** | **Backup API**（`/api/backups`） | 零代码可用，覆盖 100% 数据；可配置 cron 自动备份 + 存 S3 |
| **P1** | **Backup 事件**（`OnBackupCreate/Restore`） | 在 backup/restore 前后注入自定义逻辑（例如同步 S3 文件清单） |
| **P2** | **Trusted Proxy 配置** | 反代部署时获取真实客户端 IP |
| **P3** | **日志查看 API**（`/api/logs`） | 可在 admin 面板添加日志浏览页面 |
| **P4** | **健康检查**（`/api/health`） | 可替代 entrypoint 中的 wget 轮询 |
| **P5** | **批量 API**（`/api/batch`） | 导入/迁移场景，单事务执行多个操作 |
| **P6** | **模拟用户**（`/api/impersonate`） | 调试时 superuser 可以其他用户身份操作 |

---

## 五、vanblog 已经做得比 PB 官方更好的地方

| 领域 | PB 官方 | vanblog |
|---|---|---|
| **认证模型** | `_superusers` 表 | `users` 集合 + `role=admin/collaborator` + 细粒度 `permissions` |
| **Caddy/TLS** | 无 | 嵌入式 Caddy + 自动 HTTPS + 路由管理 |
| **文章管理** | 基础 CRUD | 软删除、版本历史、密码保护、分类/专栏/标签 |
| **媒体管理** | 基础 FileField | MD5 去重、多存储后端（local/S3/external）、缩略图 |
| **站点配置** | PB settings JSON | site 集合单行表，40+ 字段，Admin UI 可直接编辑 |
| **审计日志** | PB logs（请求级） | audits 集合，业务操作级审计（谁做了什么） |
| **访问统计** | 无 | visits 集合，按天/路径统计 |

---

## 六、总结

PB v0.39.5 提供了大量现成的 API 和能力，vanblog 当前主要利用了：

- **核心层**：记录 CRUD、集合管理、认证、文件上传、迁移、Go hook 事件
- **未利用层**：Backup 全套、Cron 调度、设置 API、日志 API、批量 API、限流、健康检查

最立即可用的 **P0 能力**是 backup。通过 PB 的 `/api/backups` 端点，vanblog 无需写一行后端代码即可获得完整的备份/恢复能力，包括可选的 cron 自动调度和 S3 备份存储。
