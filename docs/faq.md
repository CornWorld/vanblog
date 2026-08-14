# FAQ

> 每条 FAQ = 症状 → 原因 → 解决。结论都 ref 到参考/使用文档，不重复抄写步骤。

## 部署

### 拉不到镜像 / 很慢

- 中国网络访问 `ghcr.io` 慢或失败。一键脚本会自动切国内镜像 `registry.cn-beijing.aliyuncs.com/cornworld/vanblog`；手动部署可用 `VANBLOG_CN_IMAGE` 指定国内源。

### 访问 https://IP 打不开 / 证书错误

- TLS 按**域名**签发，IP 直连不通。用域名解析后访问；本地测试临时改 hosts。
- 若 `allowedDomains` 配错被锁在门外：`./vanblog.sh maintenance` 走 8080 修复。见 [反代与安全](guide/reverse-proxy.md)。

### 外置反代后 canonical URL 是 http://

- 反代没传 `X-Forwarded-Proto: https`。见 [反代与安全](guide/reverse-proxy.md)。

### 管理端口 8080 怎么开 / 关

- 一键脚本：`./vanblog.sh maintenance`（开）→ `./vanblog.sh restart`（关）。见 [备份·升级·回滚](guide/backup-upgrade.md)。

## 升级 / 备份

### 升级后出问题怎么回滚

- `./vanblog.sh restore`（恢复升级前备份）或改 image tag 后 restart。升级前**必备份**。见 [备份·升级·回滚](guide/backup-upgrade.md)。

### 备份会不会影响在线

- `vanblog.sh backup` 会短暂停服（down → tar → up）。要不停服备份需自己 `docker cp` 或卷快照。

## 数据

### S3 secret 是明文存的吗

- 是。`site.s3Config` 存 `/pb_data` SQLite，明文。生产建议加密卷。见 [SECURITY](../SECURITY.md)。

### 从原版 vanblog 迁移数据

- 走后台「数据迁移」页（ZIP 导入，`POST /api/vanblog/migrate/import`）。不兼容数据会被归档而非丢弃。见 [参考: 备份](reference/backup.md)。

## 功能

### 评论不显示

- 默认未启用 Artalk。启用：compose 里设 `VANBLOG_ARTALK_ENABLED=1`（内置 sidecar）或 `VANBLOG_ARTALK_UPSTREAM`（外部实例）。见 [配置参考](reference/configuration.md)。

### 图片上传不支持某些格式缩略图

- BMP/TIFF/AVIF/SVG 不会生成缩略图（pb 原生限制）。`site.mediaConfig` 可让前端把 BMP/TIFF/AVIF 转成 WebP/AVIF；SVG 始终直传。见 [配置参考](reference/configuration.md)。

## 其他

### 在哪里提问 / 反馈

- GitHub [Issues](https://github.com/CornWorld/vanblog/issues)（Bug/功能）。安全漏洞走 [SECURITY](../SECURITY.md) 私有渠道。想先看看效果？[Demo](https://vanblog.corn.im)（后台 demo / demo1234）。
