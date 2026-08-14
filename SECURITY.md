# 安全策略 (Security Policy)

Vanblog 是自托管博客系统，直接暴露于公网。本项目对安全问题非常重视，感谢你帮忙让 Vanblog 更安全。

## 支持的版本

只对**最新发布版本**（`ghcr.io/cornworld/vanblog` 的 `prod-*` 最新 tag）提供安全修复。请始终保持最新版本。

> 升级方式见 [部署指南](docs/reference/deployment.md) 与一键脚本 `./vanblog.sh update`。

## 报告漏洞（请勿开公开 Issue）

**不要**为安全漏洞创建公开的 GitHub Issue。请通过以下**私有**渠道报告：

1. **首选**：GitHub 私有安全通告 — 在仓库页面 `Security → Report a vulnerability`（该渠道对维护者可见，且只在修复后公开）。
2. **备选**：给维护者发邮件（在 GitHub 个人页查看）。

请包含以下信息（越全越好）：

- 影响的版本 / 镜像 tag
- 部署方式（一键脚本 / docker-compose / 反代模式）
- 漏洞类型（XSS / 越权 / 注入 / 信息泄露 / 其他）
- 复现步骤（或最小 POC）
- 影响评估（是否可被未授权访问者触发、是否造成数据泄露）

## 响应承诺

| 严重度 | 首次响应 | 修复目标 |
|--------|----------|----------|
| 严重（RCE / 未授权数据访问 / 数据丢失） | 24 小时内 | 7 天内发布修复 |
| 高（越权 / 注入 / 大范围信息泄露） | 3 天内 | 尽快（随下一个 patch） |
| 中 / 低 | 一周内 | 随下一个常规发布 |

严重度评估遵循 [CVSS v3](https://www.first.org/cvss/calculator/3.1)。修复后我们会通过 GitHub Security Advisory（或 release notes）公开致谢报告者。

## 自托管安全注意事项

自托管系统把安全责任的一部分交给了运维者。请务必阅读：

- **S3 secret 明文存储**：`site.s3Config.secret` 在 `pb_data` 的 SQLite 中明文存储。生产环境建议对 `/pb_data` 卷启用 LUKS / BitLocker，或使用 KMS 加密。见 [配置参考](docs/reference/configuration.md)。
- **HTTPS**：默认容器内 Caddy 自动申请 Let's Encrypt 证书。若用 `VANBLOG_HTTP_ONLY` 外置反代，反代必须终止 TLS 并传递 `X-Forwarded-Proto: https`。见 [反代](docs/guide/reverse-proxy.md)。
- **管理端口**：`8080` 管理端口绕过 TLS，仅应急使用，默认不暴露。用完务必关闭。见 [部署指南](docs/reference/deployment.md)。
- **依赖**：保持最新版本以获得依赖安全修复。
