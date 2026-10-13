---
title: 备份 / 恢复 / 迁移
---

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

基于 ZIP 的导入/导出，走 HTTP：

- **导出**：`GET /api/vanblog/export/all`（全部文章 + 正文引用图片）或 `GET /api/vanblog/export/post/{id}`（单篇），admin-only。
- **导入**：`POST /api/vanblog/migrate/import`，admin-only，body 是上面导出格式的 ZIP（`posts.json` + `images/`），限 100MB，事务执行；单篇失败跳过并计入 `errors`，其余照常导入。
- 导入为**新建**记录（导出 ZIP 里的 ID 不复用），按名字 resolve-or-create 分类/标签，正文图片字节上传为新 media 记录并改写 `/api/files/...` 链接，`created`/`updated` 原样保留（pb AutodateField 须 `SetRaw`，`Set` 是 no-op）。
- 原版 mereithhh/van-blog 备份 JSON 需先经 `scripts/migrate/orig-backup-to-zip.mjs` 转成导入 ZIP，步骤见[从原版迁移](../guide/migration.md)。
- 导入结果 `{"posts": N, "errors": [...]}`：单篇失败计入 `errors` 并继续，其余照常导入。
- 详细协议见后台「数据迁移」页与 `vault/internal/migration/`（内部实现）。

## 注意事项

- **S3 secret 在 `/pb_data` SQLite 明文存储**：备份文件包含明文密钥，妥善保管。
- 备份不含系统级 pb settings（由 `site` 集合覆盖），恢复后 site 更新 hook 会自动重建。
