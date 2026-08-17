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
3. **初始化 demo**：跑仓库里的 [demo-setup.sh](../../scripts/demo-setup.sh)：

   ```bash
   bash scripts/demo-setup.sh
   ```

   脚本会：

   - 等待容器就绪
   - 创建 demo 管理员（`demo` / `demo1234`，密码 ≥8 位）
   - 把 `site.allowedDomains` 设为 `["vanblog.corn.im"]`（**关键**：setup 后空白名单 = TLS 拒绝签发，HTTPS 会 403）
   - 用 `vanblog seed --count 20` 灌入 20 篇示例文章

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

## 维护约定

- **账号**：公开 `demo`/`demo1234`。若被改，重置时一并恢复（demo-setup.sh 只在无管理员时创建，重置后即重建）。
- **主题/内容**：可自由折腾，反正会重置。别在 demo 上配真实 S3/邮箱。
- **证书**：Let's Encrypt 按域名签发，`allowedDomains` 改了要同步 `vanblog.corn.im`。
- **评论**：如需展示评论，使用 `prod-artalk` 镜像并在 `/setup` 向导中启用 Artalk 后重启（见 [配置参考](../reference/configuration.md)）。
