---
title: 从原版迁移
---

# 从原版迁移（L2）

面向从原版 Vanblog（mereithhh/van-blog，已停止维护）迁移到本重构版的用户。

迁移原则：**原版数据只读不写、新旧双轨并行、验证通过再切流量**。全程不碰原版的 MongoDB 和文件卷，随时可以回退。

## 迁移步骤

### 步骤 1：从原版导出

登录原版后台，拿两个文件：

1. **数据备份**（必选）：后台「数据备份」→ 导出，得到一个 JSON 文件（内含全部文章、分类、标签、草稿、站点设置）。
2. **图片包**（本地图床必选）：后台「图片管理」→ 导出全部图片，得到一个 ZIP。
   - 用 S3 / PicGo 等外链图床的站点没有这个入口，也不需要——图片链接是外链，迁移后原样可用。

> 原版「数据备份」是只读导出，不影响原站运行。

### 步骤 2：部署新版（双轨并行）

在同一台服务器的不同端口，或另一台机器上跑起新版。原版占着 80/443 时，新版临时用 HTTP_ONLY 模式挂别的端口：

```bash
git clone https://github.com/CornWorld/vanblog.git && cd vanblog
# 编辑 docker-compose.yml：端口改映射到如 8088:80，再加两个环境变量：
#   VANBLOG_HTTP_ONLY=1
#   VANBLOG_EMAIL=you@example.com
docker compose up -d
```

打开 `http://<IP>:8088/admin/`，完成 setup 向导（管理员账号 + 站点名）。

部署细节见[部署参考](../reference/deployment.md)，环境变量见[配置参考](../reference/configuration.md)。

### 步骤 3：转换 + 导入

原版备份 JSON 和新版的导入格式不同，用仓库自带的转换脚本转一下：

```bash
# 在 vanblog 仓库目录下（需要 Node >= 18，无其他依赖）
node scripts/migrate/orig-backup-to-zip.mjs \
  --backup 原版备份.json \
  --img-zip 图片包.zip \
  --out ./out

cd out && zip -r ../vanblog-import.zip . && cd ..
```

脚本行为（都会在输出里汇总）：

- 文章正文、分类、标签、自定义路径、置顶、密码锁、私密标记原样保留。
- **发布日期原样保留**——归档页和时间线不会乱序。
- 正文里的本地图床图片（`/static/img/...`、`/img/...` 这类**相对路径**）自动改写为新版图床地址，图片字节打进导入包；与新版图床里已存在的同字节文件自动复用，不重复占空间。
- 正文里**带域名的绝对图片链接**（`https://pic.example.com/img/x.png`）一律保持原样、不打包字节——它既可能是你自己的图床域名，也可能是 PicGo/S3 外链，光看 URL 分不出来。若那是你的图床域名，迁移后把该域名指到新站即可；转换脚本会在汇总里点名这类链接的数量。
- `hidden` 文章转为新版「hidden」状态；**回收站里的文章不迁移**（需要的话先在原版恢复再重新导出）；**草稿不迁移**（先在原版发布，数量会在输出里点名）。
- 导入接口上限 **100MB**——图片很多的站打包后超限时，先把大图压缩或转移外链图床再重新导出转换。

导入：

1. 打开新版后台 → 「数据迁移」。
2. 上传 `vanblog-import.zip`。
3. 页面返回 `{posts: N, errors: []}` 即成功；`errors` 非空时逐条看原因，其余文章已正常导入。重复导入同一包会因 pathname 唯一索引整批被拒，不会产生重复文章。

命令行方式：

```bash
curl -X POST http://<新版地址>/api/vanblog/migrate/import \
  -H "Authorization: <管理员TOKEN>" \
  -H "Content-Type: application/zip" \
  --data-binary @vanblog-import.zip
```

> 导入按篇事务：单篇失败跳过并计入 `errors`，其余照常导入；文章和图片都是**新建**记录，不覆盖站内已有内容。
> 协议细节见[备份与迁移参考](../reference/backup.md)。

### 步骤 4：核对

切流量前过一遍：

1. **文章数**：新版后台「文章」列表数量 = 转换脚本报告的「文章: N」（回收站/草稿除外）。
2. **正文与图片**：抽查带图文章，确认图片显示正常。
3. **日期**：时间线 / 归档页顺序和原版一致。
4. **老链接**：原版文章链接形如 `/post/<pathname>`，新版 pathname 原样保留，老外链打开即命中。
5. **私密 / 密码锁文章**：前台验证解锁行为。

### 步骤 5：切流量，原版下线

验证无误后：

1. 停原版容器：`docker stop <原版容器>`。**保留数据卷**，别 `docker rm -v`。
2. 新版接管 80/443：改回 `docker-compose.yml` 的端口映射、去掉 `VANBLOG_HTTP_ONLY`、确认 `VANBLOG_EMAIL`，`docker compose up -d`。
3. Caddy 会按域名自动签发 HTTPS 证书，打开生产域名验证。

## 这些不走自动迁移，需要手动重配

原版「数据备份」里还有一类**站点配置**，导入不覆盖它们（避免冲掉新版里已配好的内容），迁移当天照着旧站补一遍即可：

- 站点信息与外观：站点名、描述、头像、导航、页脚
- 友链、社交链接、打赏/赞赏配置、关于页内容
- 路由与域名（`allowedDomains`）、评论开关
- 自定义页面（新版的自定义页面能力尚未完全对齐原版，先用重配顶上）
- 协作账号与读者数据、访问统计（从零开始计）

存量评论走单独通道：见下节。

## 评论迁移（Waline → Artalk）

原版内置 Waline，新版已换为同源 Artalk。存量评论用 Artalk 官方 Artransfer-CLI 转换后导入，步骤见[评论集成：数据迁移](comments-artalk.md#数据迁移waline--artalk)。

## 应急与回滚

新版有任何不对劲：`docker compose down` 停新版，`docker start <原版容器>` 拉回原版——原版数据全程未被改动，秒级回退。

切完流量也别急着删原版卷：先让新版跑 `./vanblog.sh backup`（见[备份与升级](backup-upgrade.md)），确认备份可用后再清理。
