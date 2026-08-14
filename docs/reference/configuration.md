# 配置参考（环境变量 + site 字段）

> 本文是**事实（SSOT）**。使用文档引用这里，不要复制内容。
> 硬事实来源：`docker/entrypoint.prod.sh`、`docker/entrypoint.dev.sh`、`docker-compose.yml`。如代码变更，改这里并保持与代码一致。

## 一、容器环境变量（VANBLOG\_\*）

### 常规

| 变量                      | 必填       | 默认值              | 说明                                                                   |
| ------------------------- | ---------- | ------------------- | ---------------------------------------------------------------------- |
| `VANBLOG_EMAIL`           | 是（建议） | `admin@example.com` | Let's Encrypt 证书到期通知邮箱。未设置会在启动时告警，证书签发仍可用。 |
| `VANBLOG_CADDY_LOG_LEVEL` | 否         | `warn`              | Caddy 日志级别：`debug` / `info` / `warn` / `error`。                  |
| `VANBLOG_DATA_DIR`        | 否         | `/pb_data`          | PocketBase 数据目录（SQLite + 上传文件）。                             |
| `VANBLOG_DEFAULT_THEME`   | 否         | `vanblog`           | 首次启动的默认主题（旗舰主题名）。                                     |

### 主题 / Pack

| 变量                         | 必填 | 默认值                    | 说明                                                     |
| ---------------------------- | ---- | ------------------------- | -------------------------------------------------------- |
| `VANBLOG_THEMES_DIR`         | 否   | `/var/lib/vanblog/themes` | 用户主题覆盖层（可写卷，**用户优先**）。                 |
| `VANBLOG_THEMES_BUILTIN_DIR` | 否   | `/build/themes`           | 内置主题只读目录（镜像内）。两者合并，用户覆盖同名优先。 |
| `VANBLOG_ADMIN_DIST_DIR`     | 否   | `/build/app/dist`         | 管理后台 SSR 产物目录（镜像内）。                        |
| `VANBLOG_PACKS_DIR`          | 否   | （未设）                  | 本地 Pack 覆盖目录（传给 pb 的 `--packsDir`）。          |

### 反代 / TLS

| 变量                | 必填 | 默认值 | 说明                                                                                                                                              |
| ------------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VANBLOG_HTTP_ONLY` | 否   | （空） | 设为 `1` 或 `true` 进入 HTTP_ONLY 模式：容器内 Caddy 只监听 `:80`、不配 TLS、不请求证书。外置反代终止 TLS。见 [反代](../guide/reverse-proxy.md)。 |

### 评论（Artalk）

| 变量                      | 必填 | 默认值 | 说明                                                                                  |
| ------------------------- | ---- | ------ | ------------------------------------------------------------------------------------- |
| `VANBLOG_ARTALK_ENABLED`  | 否   | （空） | 设为 `1` 或 `true` 启动内置 Artalk sidecar（同源 `:23366`）。                         |
| `VANBLOG_ARTALK_UPSTREAM` | 否   | （空） | 外部 Artalk 容器地址（如 `artalk:23366`）。设置后走外部实例，数据卷挂 `artalk_data`。 |

### 内部地址（一般不用改）

| 变量           | 说明                                                        |
| -------------- | ----------------------------------------------------------- |
| `PB_URL`       | PocketBase 内部地址（容器内默认 `http://127.0.0.1:8090`）。 |
| `ASTRO_URL`    | Theme Host 内部地址（容器内默认 `http://127.0.0.1:4321`）。 |
| `VANBLOG_MODE` | `dev` 镜像运行时设为 `dev`（dev entrypoint 注入）。         |

## 二、Artalk 环境变量（外部 Artalk 容器用）

外部 Artalk 实例通过 `ATK_*` 环境变量配置（见 [Artalk 官方文档](https://artalk.js.org/)）：

| 变量               | 默认值    | 说明                     |
| ------------------ | --------- | ------------------------ |
| `ATK_HOST`         | `0.0.0.0` | 监听地址                 |
| `ATK_PORT`         | `23366`   | 监听端口                 |
| `ATK_LOCALE`       | `en`      | 界面语言，中文设 `zh-CN` |
| `ATK_SITE_DEFAULT` | —         | 站点名称                 |
| `ATK_SITE_URL`     | —         | 站点 URL                 |

> 内置 sidecar 模式下无需配置，entrypoint 已用 `ATK_HOST=127.0.0.1 ATK_PORT=23366` 启动。

## 三、`vanblog.sh` 脚本变量（宿主侧，非容器）

| 变量                      | 默认值                                                         | 说明                                 |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `VANBLOG_BASE_PATH`       | `/var/vanblog`                                                 | 部署根目录（compose 与数据都在此）。 |
| `VANBLOG_IMAGE`           | `ghcr.io/cornworld/vanblog:prod-edge`                          | 覆盖镜像源。                         |
| `VANBLOG_CN_IMAGE`        | `registry.cn-beijing.aliyuncs.com/cornworld/vanblog:prod-edge` | 中国境内镜像（自动检测 CN 切换）。   |
| `VANBLOG_SKIP_ROOT_CHECK` | （空）                                                         | 设为 `1` 跳过 root 检查（测试用）。  |

## 四、site 集合配置字段（通过 pb Admin UI `/_/` 编辑）

`site` 是单行集合，存站点全局配置。**运行时字段大多在后台「站点配置」页修改**，这里列出关键字段：

| 字段                                    | 类型 | 说明                                                                                                                                                                                   |
| --------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTheme`                           | text | 激活主题名，默认 `vanblog`（旗舰主题）。后台「外观」页切换。                                                                                                                           |
| `s3Config`                              | json | S3/对象存储配置（`{enabled,bucket,region,endpoint,accessKey,secret,forcePathStyle}`）。修改后自动同步到 pb settings，无需重启。**secret 明文存储**，见 [SECURITY](../../SECURITY.md)。 |
| `mediaConfig`                           | json | 图片上传归一化：`{enabled,targetFormat,quality}`。`targetFormat` 为 `preserve`/`webp`(默认)/`avif`。SVG 始终直传。                                                                     |
| `routing`                               | json | 自定义路由规则。修改触发 Caddy 热重载。                                                                                                                                                |
| `allowedDomains`                        | json | 可签发 TLS 证书的域名白名单（**Setup 前允许所有；Setup 后空列表=拒绝**）。                                                                                                             |
| `nav` / `links` / `socials` / `rewards` | json | 导航 / 友链 / 社交 / 打赏 配置。                                                                                                                                                       |

> 完整字段见 pb Admin UI 的 `site` 集合 schema（后台 `/_/` → Collections → site）。本文只维护与运维强相关的字段。

## 五、修改配置后

- 环境变量：修改 `docker-compose.yml` → `./vanblog.sh restart`。
- site 字段（pb Admin UI）：**无需重启**，site 更新 hook 自动同步（S3、Caddy 路由、主题）。
