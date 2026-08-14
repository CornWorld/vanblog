# 备份 · 升级 · 回滚（L2）

> 事实（备份范围、命令、数据位置）见 [参考: 备份](../reference/backup.md)，本文只讲「怎么操作」并按该文档引用事实。

## 升级前：先备份（铁律）

```bash
./vanblog.sh backup
```

备份会短暂停服并生成 tar.gz（含 `pb_data`、`caddy_data`、`packs`）。见 [参考: 备份](../reference/backup.md)。

## 升级

```bash
./vanblog.sh update
```

脚本检测远端新镜像 → 确认后 `pull && down && up`。若无新版本会提示「已是最新」。

> 若用 compose 而非脚本：`docker compose pull && docker compose up -d`。

## 回滚

两个途径，任选：

1. **恢复备份**：`./vanblog.sh restore` → 输入备份文件路径（会停服 + 覆盖，二次确认）。
2. **固定镜像 tag**：编辑 `docker-compose.yml` 把 `image:` 改回上一版本 tag（如 `prod-edge` → 你已知可用的 tag），然后 `./vanblog.sh restart`。

回滚后如需保留回滚期间产生的数据，先手动备份。

## TLS 被锁在 HTTPS 门外（改错 allowedDomains）

```bash
./vanblog.sh maintenance     # 暴露 8080 管理端口（纯 HTTP）
# 打开 http://<IP>:8080/admin/ 修复配置
./vanblog.sh restart          # 移除维护覆盖并正常重启
```

## 迁移到新机器

1. 旧机器 `./vanblog.sh backup`，把 tar.gz 拷到新机器。
2. 新机器 `./vanblog.sh install` 先跑起来。
3. 新机器 `./vanblog.sh restore` 选备份文件。
4. 检查 `site.allowedDomains` 是否包含新域名（迁移换域名时必须改）。
