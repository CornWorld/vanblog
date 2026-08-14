# 反代与安全（L2）

> 适用：已有 Traefik / Nginx Proxy Manager / Cloudflare Tunnel / K8s Ingress，想让外置反代终止 TLS。

## HTTP_ONLY 模式

容器内 Caddy 只监听 `:80`、不请求 Let's Encrypt 证书，由外置反代终止 TLS。启用方式（任一）：

- 一键脚本安装时选「启用 HTTP_ONLY」
- 或 `docker-compose.yml` 环境变量加 `VANBLOG_HTTP_ONLY=1`，且只发布 `:80`

**必须**：反代传递 `X-Forwarded-Proto: https`，否则 Astro 生成的 canonical URL 会是 `http://`（SEO 错误）。

最小 Caddy 反代：

```caddyfile
example.com {
    reverse_proxy vanblog:80
}
```

## 外置反代 + HTTPS 双向示例（Caddy）

```caddyfile
example.com {
    reverse_proxy vanblog:80 {
        header_up X-Forwarded-Proto https
    }
}
```

## 安全清单（自托管必读）

| 项 | 说明 |
|---|---|
| `X-Forwarded-Proto` | 必须透传 `https`（HTTP_ONLY 时） |
| 8080 管理端口 | 明文 HTTP，**仅应急**，用完即关 |
| `site.allowedDomains` | setup 后为白名单；改错会把自己锁在门外 → `./vanblog.sh maintenance` |
| S3 secret | 明文存 SQLite，备份/卷需加密（LUKS/BitLocker） |
| 保持最新版本 | 依赖安全修复只在最新版 |

## 常见错误排查

- **前台 canonical 是 http://** → 反代没传 `X-Forwarded-Proto: https`。
- **TLS 一直 403 / 证书不签发** → `allowedDomains` 没包含该域名，或 setup 后留空。
- **外置反代下证书警告** → 确认没有同时暴露容器的 `:443`。

> 部署事实（端口 / 卷 / HTTP_ONLY 行为）见 [参考: 部署](../reference/deployment.md)。
