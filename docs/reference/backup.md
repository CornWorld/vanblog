# 备份 / 恢复 / 迁移 — 事实 (SSOT)

> 使用文档引用这里，不要复制。硬事实来源：`vanblog.sh`、`vault/internal/migration/`。

## 数据都在哪

| 卷/路径                   | 内容                                                                           | 备份必需 |
| ------------------------- | ------------------------------------------------------------------------------ | -------- |
| `/pb_data`                | PocketBase SQLite（posts/site/media 元数据等全部集合）+ 上传文件               | **是**   |
| `/data/caddy`             | Caddy TLS 证书 + ACME 状态（不备份 = 重启重新签发，可能撞 Let's Encrypt 配额） | 推荐     |
| `/var/lib/vanblog/packs`  | 用户安装的 Pack                                                                | 推荐     |
| `/var/lib/vanblog/themes` | 用户安装的主题                                                                 | 推荐     |
| `/data/artalk`            | Artalk 评论数据（启用 sidecar 时）                                             | 推荐     |

## 一键备份（推荐）

```bash
./vanblog.sh backup
```

- 生成 `vanblog-backup-<时间戳>.tar.gz` 到 `$VANBLOG_BASE_PATH/`。
- 内容：`data/` 目录整体（含 `pb_data`、`caddy_data`、`packs`）。
- 会**短暂停服务**（`docker compose down` → 压缩 → 重新 up）。

## 一键恢复

```bash
./vanblog.sh restore
# 输入备份文件路径（含文件名）
```

- 会**停止服务**并**覆盖当前数据**，需要二次确认。
- 恢复后手动 `./vanblog.sh start`。

## 升级 / 回滚

- **升级**：`./vanblog.sh update` — 检测新镜像 → 确认后 `docker compose pull && down && up`。
- **回滚**：回滚 = 恢复升级前的备份（见上），或手动把 `docker-compose.yml` 的 image tag 改回旧版本后 `restart`。
- 升级前**务必先 backup**。

## 维护模式（TLS 被锁在门外时）

```bash
./vanblog.sh maintenance
```

- 生成 `docker-compose.maintenance.yml` 覆盖文件并重启，暴露 `:8080` 纯 HTTP 管理端口。
- 通过 `http://<IP>:8080/admin/` 修复配置（如 `allowedDomains`）。
- 修复后 `./vanblog.sh restart`（自动移除覆盖文件）。

## 数据迁移（从原版/其他 fork）

基于 ZIP 的导入/导出，走 HTTP：`POST /api/vanblog/migrate/import`（body=JSON，限 100MB，事务）。

- 导入会读取上游 MongoDB 集合，**归档不兼容数据**（不静默丢弃，落到归档以便后续处理）。
- 旧版 JSON 导入路径已移除。
- 详细协议见后台「数据迁移」页与 `vault/internal/migration/`（内部实现）。

## 注意事项

- **S3 secret 在 `/pb_data` SQLite 明文存储**：备份文件包含明文密钥，妥善保管。
- 备份不含系统级 pb settings（由 `site` 集合覆盖），恢复后 site 更新 hook 会自动重建。
