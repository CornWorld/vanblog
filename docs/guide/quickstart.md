# 快速开始（L0 · 新手）

5 分钟把 Vanblog 跑起来。假设你有：一台能跑 Docker 的服务器（amd64 / arm64），一个域名（可选，但推荐）。

## 方案 A：一键脚本（推荐）

```bash
curl -sL https://raw.githubusercontent.com/cornworld/vanblog/main/vanblog.sh | bash
```

脚本会引导你配置：邮箱（Let's Encrypt 通知）、HTTP/HTTPS 端口、是否 HTTP_ONLY（外置反代选是）、是否暴露 8080 管理端口。

> 依赖 [gum](https://github.com/charmbracelet/gum)（TUI），脚本会自动安装；以 root 运行。中国网络自动切国内镜像源。

## 方案 B：docker-compose

```bash
git clone https://github.com/CornWorld/vanblog.git && cd vanblog
# 编辑 docker-compose.yml 把 VANBLOG_EMAIL 改成你的邮箱
docker compose up -d
```

## 首次初始化

1. 浏览器打开 `https://你的域名/admin/`（首次访问进入 setup 引导页）。
2. 创建管理员账号（邮箱 + 密码）。
3. 完成 —— 前台 `https://你的域名/` 即用默认「vanblog」主题展示。

> 域名未解析到服务器？先用 IP 访问会失败（TLS 按域名签发）。本地测试可临时改 hosts 或用 `:8080` 管理端口看后台。

## 下一步

| 目标 | 文档 |
|---|---|
| 写第一篇文章 | [功能使用](features.md) |
| 配置 S3 图床 / 评论 | [配置参考](../reference/configuration.md) |
| 换主题 | [主题](../reference/themes.md) |
| 挂到已有反代后面 | [反代与安全](reverse-proxy.md) |

> 部署细节（端口 / 卷 / 镜像 / 管理端口）见 [部署参考](../reference/deployment.md)。
