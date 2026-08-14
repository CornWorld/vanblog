<p align="center">
  <strong>Vanblog</strong>
</p>

<p align="center">
  基于 <b>PocketBase + Astro</b> 重构的个人博客系统 —— 开箱即用、高性能、数据自我控制。
</p>

<p align="center">
  <img alt="GitHub release" src="https://img.shields.io/github/v/release/cornworld/vanblog?display_name=tag" />
  <img alt="Docker" src="https://img.shields.io/docker/pulls/cornworld/vanblog" />
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/cornworld/vanblog" />
  <img alt="CI" src="https://github.com/cornworld/vanblog/workflows/test-build/badge.svg" />
  <img alt="License" src="https://img.shields.io/badge/license-GPL%20v3-yellow.svg" />
</p>

<p align="center">
  <a href="https://github.com/CornWorld/vanblog/blob/main/docs/README.md">📖 文档</a>
  ·
  <a href="https://vanblog.corn.im">🚀 Demo</a>
  ·
  <a href="https://github.com/CornWorld/vanblog/issues">🐛 反馈</a>
</p>

---

Vanblog 原版由 [Mereithhh](https://github.com/Mereithhh) 开发，因个人原因停止维护，但用户与社区仍在。本项目用三方积极维护的框架（PocketBase + Astro + Caddy）重写原版：保留一体化的使用体验，替换掉无人维护的基础组件。

- **All in One**：一个容器搞定 数据库 + API + 前台 + 后台 + HTTPS + 评论，数据全在自己手里（SQLite）。
- **高性能**：Astro SSR + 增量缓存，个人博客体量下秒开。
- **自动 HTTPS**：Caddy 按需签发 Let's Encrypt 证书，几乎零配置。
- **主题 / Pack 扩展**：可切换主题（旗舰 `vanblog` + 兜底 `base`），可插拔 Pack 扩展。

## 特性

- 写作：Markdown、代码块、图片上传（自动压缩 / 转 WebP-AVIF）、`more` 截断、公式、Mermaid
- 内容：草稿、分类、标签、搜索、归档、时间线、自定义文章路径、回收站
- 图床：本地或 S3 兼容对象存储（AWS S3 / Cloudflare R2 / 阿里云 OSS / MinIO…）
- 评论：内置 Artalk（同源，可选外部容器）
- 主题：后台切换 + 实时预览；运行时新增主题自动识别
- Pack 扩展：收藏、说说/动态、访客统计、Live2D 看板娘…
- 安全：pb 只绑内网、Caddy 统一路由、TLS 按域名白名单签发、HTTP_ONLY 外置反代模式
- 部署：一键脚本 / docker compose / 多架构镜像（amd64 + arm64）

## 快速开始

```bash
curl -sL https://raw.githubusercontent.com/cornworld/vanblog/main/vanblog.sh | bash
```

或：

```bash
git clone https://github.com/CornWorld/vanblog.git && cd vanblog
# 编辑 docker-compose.yml，把 VANBLOG_EMAIL 改成你的邮箱
docker compose up -d
```

启动后打开 `https://你的域名/admin/` 完成首次 setup。

> 完整上手见 [快速开始](docs/guide/quickstart.md) 与 [部署参考](docs/reference/deployment.md)。

## Demo

体验线上实例：**[https://vanblog.corn.im](https://vanblog.corn.im)**

- 前台：直接浏览示例站点
- 后台：<https://vanblog.corn.im/admin/>，账号 `demo` / `demo1234`（公开演示账号，随时可改数据，定期重置）
- Demo 部署与重置方法见 [docs/guide/demo.md](docs/guide/demo.md)

## 文档

| 目的                   | 文档                                        |
| ---------------------- | ------------------------------------------- |
| 5 分钟跑起来           | [快速开始](docs/guide/quickstart.md)        |
| 写文章 / 换主题 / 评论 | [功能使用](docs/guide/features.md)          |
| 环境变量 / site 配置   | [配置参考](docs/reference/configuration.md) |
| 备份 · 升级 · 回滚     | [备份与升级](docs/guide/backup-upgrade.md)  |
| 外置反代 / HTTP_ONLY   | [反代与安全](docs/guide/reverse-proxy.md)   |
| 遇到问题               | [FAQ](docs/faq.md)                          |
| 主题 / Pack 开发       | [开发者文档](docs/developer/README.md)      |

## 镜像与版本

- 发布：`ghcr.io/cornworld/vanblog:{prod,dev}-latest`（中国镜像：`registry.cn-beijing.aliyuncs.com/cornworld/vanblog`）
- `prod`：开箱即用（编译后二进制 + SSR 静态资源）；`dev`：含 Go/Node 运行时 + 源码 + MCP/Skill，适合二次开发
- 变更记录见 [CHANGELOG](CHANGELOG.md) 与 [GitHub Releases](https://github.com/CornWorld/vanblog/releases)

## 从原版 / 其他 fork 迁移

后台「数据迁移」页支持 ZIP 导入（原版 MongoDB 集合 → 归档不兼容数据）。见 [FAQ](docs/faq.md) 与 [参考: 备份](docs/reference/backup.md)。

## 安全

安全漏洞请走**私有渠道**（GitHub Security Advisory），勿开公开 Issue。见 [SECURITY](SECURITY.md)。

## 贡献

欢迎 PR 与 Issue。本地开发、提交规范、文档纪律见 [CONTRIBUTING](CONTRIBUTING.md)。

## License

[GPL-3.0](LICENSE) © CornWorld. 部分前端组件承袭自 mereithhh/vanblog（GPL-3.0）。
