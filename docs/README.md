# Vanblog 文档

> 面向用户的文档索引。开发者/贡献者文档见 [docs/developer/](developer/README.md)。
> 文档质量契约见 [docs/quality/doc-standard.md](quality/doc-standard.md)。

**Vanblog** 是一款基于 **PocketBase + Astro** 重构的个人博客系统（原版由 mereithhh 开发，已停止维护）。目标：开箱即用、高性能、数据自我控制、有限的扩展性。

## 快速上手（按读者 level）

| 你想做什么                 | 去这里                                     |
| -------------------------- | ------------------------------------------ |
| 5 分钟把 Vanblog 跑起来    | [快速开始 (L0)](guide/quickstart.md)       |
| 升级 / 备份 / 回滚         | [备份与升级 (L2)](guide/backup-upgrade.md) |
| 外置反代 + TLS / HTTP_ONLY | [反代与安全 (L2)](guide/reverse-proxy.md)  |
| 安装和启用 Pack            | [Pack 使用 (L2)](guide/packs.md)           |
| 写文章 / 换主题 / 后台功能 | [功能使用 (L1)](guide/features.md)         |
| 遇到问题先查这里           | [FAQ](faq.md)                              |
| 体验 / 部署 Demo 站        | [Demo 站](guide/demo.md)                   |

## 参考文档（事实，按系统细分）

| 文档                               | 内容                                  | 谁看        |
| ---------------------------------- | ------------------------------------- | ----------- |
| [部署](reference/deployment.md)    | 镜像 / 端口 / 卷 / compose / 管理端口 | 部署者      |
| [配置](reference/configuration.md) | 环境变量表 + site 配置字段            | 高级用户    |
| [备份与迁移](reference/backup.md)  | 备份范围 / 迁移协议 / 恢复            | 运维者      |
| [Pack](reference/packs.md)         | Pack 格式 / 生命周期 / 现有 Pack      | 折腾型用户  |
| [主题](reference/themes.md)        | 主题概念 / 内置主题 / 切换            | 用户 + 作者 |
| [架构](reference/architecture.md)  | 请求路由 / 三服务 / 缓存              | 好奇者      |
| [API](reference/api.md)            | API 端点 / SDK 入口                   | 开发者      |

## 部署方式（一句话）

- **推荐**：`curl -sL https://raw.githubusercontent.com/cornworld/vanblog/main/vanblog.sh | bash`
- 或 `docker compose up -d`（见 [部署](reference/deployment.md)）
- 镜像：`ghcr.io/cornworld/vanblog:{prod,dev}-latest`

## 目录说明

- `docs/guide/` — 面向不同 level 用户的使用文档（任务导向）
- `docs/reference/` — 按系统细分的事实文档（SSOT，使用文档引用这里）
- `docs/developer/` — 开发者 / 贡献者文档（主题、SDK、贡献）
- `docs/quality/` — 文档质量标准与检测
- `docs/faq.md` — 症状 → 原因 → 解决

## 维护约定

- 新文档先归位到上述四类之一，不要新增平铺文件。
- 事实写进 `reference/`，使用文档 `ref` 而不是复制。见 [doc-standard](quality/doc-standard.md)。
- 每次文档变更后运行 `node scripts/doc-dup-check.mjs`，要求 S0 = 0。
