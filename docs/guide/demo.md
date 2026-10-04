# Demo 站部署与维护

> 线上 demo：**[https://vanblog.corn.im](https://vanblog.corn.im)** · 后台 <https://vanblog.corn.im/admin/> 账号 `demo` / `demo1234`
> 本文面向 demo 站**维护者**（部署 / 重置），不是普通读者。

## Demo 是什么

一个跑 `prod` 镜像、带示例数据、开放 `demo` 管理员账号的**公开演示实例**。任何人可登录后台随意改数据，因此**定期重置**。

## 首次部署（vanblog.corn.im）

1. **DNS**：把 `vanblog.corn.im` 解析到服务器公网 IP（A 记录）。
2. **一键部署**（任选）：
   - `curl -sL https://raw.githubusercontent.com/cornworld/vanblog/main/vanblog.sh | bash`（推荐，脚本引导邮箱/端口）
   - 或手动 `git clone … && docker compose up -d`
3. **初始化 demo**：跑仓库里的 [demo-setup.sh](../../scripts/ops/demo-setup.sh)：

   ```bash
   bash scripts/ops/demo-setup.sh
   ```

   脚本会：

   - 等待容器就绪
   - 创建 demo 管理员（`demo` / `demo1234`，密码 ≥8 位）
   - 把 `site.allowedDomains` 设为 `["vanblog.corn.im"]`（**关键**：setup 后空白名单 = TLS 拒绝签发，HTTPS 会 403）
   - `vanblog seed --count 0` 建站点配置(gravatar 作者头像、作者名)+ 1 篇 showcase 功能文,不灌随机文章
   - 复用 `bench/` 工具链灌 20 篇**真实文章**(Hacker News / arXiv 语料,按仓库 `bench/corpus.ids.json` 钉定 ID 确定性抓取,正文尾部附原文链接;宿主无需 node——脚本经 `docker cp` 进容器用镜像自带 node 跑)

4. 验证：前台 `https://vanblog.corn.im/`、后台 `https://vanblog.corn.im/admin/`。

> 允许的域名白名单机制见 [参考: 配置](../reference/configuration.md) 与 [反代与安全](reverse-proxy.md)。`seed` 命令来源见 `vault/internal/devseed/`。

## 重置（数据被玩坏后）

```bash
# 停服并删除数据卷（pb_data 等）
./vanblog.sh stop
cd $VANBLOG_BASE_PATH && docker compose down -v
# 重新走首次部署第 2、3 步
```

> ⚠️ `down -v` 会删全部数据（含评论、上传、证书缓存）。Demo 站允许，**生产环境切勿如此操作**。

## 自动重置（防 demo 账号被滥用）

线上 demo（裸 `docker run` + watchtower 自动更镜像）装有 **systemd timer 每小时自动重置**：

- 单元：`/etc/systemd/system/vanblog-demo-reset.{service,timer}`，`User=corn`，`OnCalendar=hourly`
- 脚本：`/opt/vanblog/scripts/ops/demo-reset.sh`
- **自更新**（2026-10-05 起）：每次重置前先拉取仓库 `main-go` 分支 tarball，
  用最新 `scripts/` + `bench/` 覆盖宿主副本再继续执行——重置逻辑与种子数据
  （HN 评论、全量 tag）永远跟仓库走，宿主副本不会老化。分支可用
  `VANBLOG_DEMO_REPO_BRANCH` 覆盖，整包地址用 `VANBLOG_DEMO_REPO_TARBALL`。
- 镜像更新由 watchtower 轮询 ghcr 完成（demo 容器跟踪 **`prod-latest`**，
  release 工作流的滚动 tag）。
  ⚠️ watchtower 以 `--label-enable vanblog` 只盯带
  `com.centurylinklabs.watchtower.enable=true` label 的容器——**手动重建
  容器必须原样带上该 label**（2026-10-04 v0.9.3 手动重建时漏掉，watchtower
  从此 Scanned=0、自动更新静默断链，v0.9.4 起修复并实测 Scanned=1）。
- ⚠️ 逻辑：定位容器（compose/裸 run 均可）→ `docker stop` → 清空宿主
  `/pb_data` 绑定目录 → `docker start` → 跑 `demo-setup.sh`（重建 demo
  管理员 + 白名单 + site/showcase + HN 语料文章 + 置顶欢迎文）
- 手动触发：`sudo systemctl start vanblog-demo-reset.service`

## 演示模式加固（VANBLOG_DEMO=1）

demo 容器带 `VANBLOG_DEMO=1` 环境变量，Go 层注册守卫（`vault/internal/demo`），
公开 demo 账号（role=admin）以下能力一律 **403**：

| 封禁面 | 原因 |
| --- | --- |
| `/api/vanblog/agent/*` | agent 终端 = 容器内 shell 执行面 |
| `/api/vanblog/mcp/*` | 宿主文件系统读写 |
| `/api/vanblog/backups*` | 全量下载 / 恢复覆盖 |
| `/api/vanblog/migrate/*` | 数据全量替换 |
| `/api/vanblog/routing/apply`、`/routing/rules` | caddy 路由接管 |
| `/api/vanblog/system/restart`、`/themes/reload` | 服务生命周期 |

内容面（文章/页面/主题设置/调色盘/锁文/置顶）保持开放——随便折腾是 demo 的意义。

**superuser 隔离**：bootstrap 使 superuser 与 admin 同凭据，等于把 pb superuser
UI（`/_/`）交给全世界。demo-setup 每次重置用随机密码轮换 superuser，新密码落
宿主 `/opt/vanblog/SUPER_PASSWORD`（600，`VANBLOG_DEMO_SUPER_PASSWORD` 可覆盖）。
公开凭据只对应 users 集合的 admin。

**试玩说明**：置顶文章《👋 公开演示站 · 随便玩》(pathname `welcome-demo`)
写明后台地址与凭据，随每次重置自动重建。

`demo-setup.sh` 本身也兼容两种部署形态：优先从 compose（服务名 `vanblog`）解析容器，无 compose 项目时用裸容器名（`VANBLOG_DEMO_CONTAINER`，默认 `vanblog`）；依赖仅 `curl`/`python3`/`docker`（语料抓取在容器内进行，宿主无需 node、不依赖 jq）。

## 维护约定

- **账号**：公开 `demo`/`demo1234`。被改也不要紧——每日定时重置会恢复；等不及就手动触发上面的 service。
- **主题/内容**：可自由折腾，反正会重置。别在 demo 上配真实 S3/邮箱。
- **证书**：Let's Encrypt 按域名签发，`allowedDomains` 改了要同步 `vanblog.corn.im`。
- **评论**：如需展示评论，使用 `prod-artalk` 镜像并在 `/setup` 向导中启用 Artalk 后重启（见 [配置参考](../reference/configuration.md)）。
