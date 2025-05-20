---
title: 环境变量
icon: leaf
order: 2
---

VanBlog 启动时，会读取一些环境变量以配置自身。

| 名称                             | 必填 | 说明                                                                        | 默认值                                           |
| -------------------------------- | ---- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| `VAN_BLOG_DATABASE_URL`          | 否   | mongoDB URL                                                                 | `mongodb://mongo:27017/vanBlog?authSource=admin` |
| `VAN_BLOG_ADMIN_URL`             | 否   | Admin 服务地址                                                              | `http://127.0.0.1:3002`                          |
| `VAN_BLOG_SERVER_URL`            | 否   | Server 服务地址                                                             | `http://127.0.0.1:3000`                          |
| `VAN_BLOG_WEBSITE_URL`           | 否   | Website 服务地址                                                            | `http://127.0.0.1:3001`                          |
| `VAN_BLOG_WALINE_URL`            | 否   | Waline 服务地址                                                             | `http://127.0.0.1:8360`                          |
| `NEXT_PUBLIC_VANBLOG_SERVER_URL` | 否   | 浏览器访问后端的地址                                                        | `window.location.origin`                         |
| `VAN_BLOG_CDN_URL`               | 否   | CDN 部署的地址，在开启之前请不要设置此项。此项会导致公共资源从此 URL 获取。 | `""`                                             |
| `VAN_BLOG_WALINE_DB`             | 否   | 内嵌评论系统的数据库名，默认为 waline                                       | `""`                                             |
| `EMAIL`                          | 否   | 用于自动申请 https 证书的邮箱                                               | `""`                                             |
| `VAN_BLOG_DEBUG_MODE`            | 否   | 是否启用调试模式                                                            | `false`                                          |

## 注意事项

::: tip

每次修改后，需要重启 VanBlog 服务 或重启 VanBlog Docker 容器方能生效。

:::

::: warning 警示

1. 为避免特殊字符对 bash 的干扰，请务必将环境变量的值用双引号围起来!
   如 `"https://example.com"`

2. 所有服务地址必须包含协议前缀（http:// 或 https://）
   正确示例：`"http://localhost:3000"`
   错误示例：`"localhost:3000"`

:::

### 服务发现与 URL 配置

VanBlog 采用基于环境变量的简单服务发现机制。每个服务都有自己的 URL 配置：

1. 内部服务 URL：

   - `VAN_BLOG_ADMIN_URL`: Admin 服务地址
   - `VAN_BLOG_SERVER_URL`: Server 服务地址
   - `VAN_BLOG_WEBSITE_URL`: Website 服务地址
   - `VAN_BLOG_WALINE_URL`: Waline 服务地址

2. 外部访问 URL：
   - `NEXT_PUBLIC_VANBLOG_SERVER_URL`: 浏览器访问后端的地址

典型配置场景：

1. 单机部署（默认配置）：

```bash
# 内部服务使用 localhost
VAN_BLOG_ADMIN_URL="http://127.0.0.1:3002"
VAN_BLOG_SERVER_URL="http://127.0.0.1:3000"
VAN_BLOG_WEBSITE_URL="http://127.0.0.1:3001"
VAN_BLOG_WALINE_URL="http://127.0.0.1:8360"
# 浏览器使用当前域名
NEXT_PUBLIC_VANBLOG_SERVER_URL="window.location.origin"
```

2. 微服务部署：

```bash
# 内部服务使用服务名
VAN_BLOG_ADMIN_URL="http://admin-service:3002"
VAN_BLOG_SERVER_URL="http://api-service:3000"
VAN_BLOG_WEBSITE_URL="http://website-service:3001"
VAN_BLOG_WALINE_URL="http://waline-service:8360"
# 浏览器使用外部域名
NEXT_PUBLIC_VANBLOG_SERVER_URL="https://api.example.com"
```

3. 开发环境：

```bash
# 所有服务使用 localhost
VAN_BLOG_ADMIN_URL="http://localhost:3002"
VAN_BLOG_SERVER_URL="http://localhost:3000"
VAN_BLOG_WEBSITE_URL="http://localhost:3001"
VAN_BLOG_WALINE_URL="http://localhost:8360"
NEXT_PUBLIC_VANBLOG_SERVER_URL="http://localhost:3000"
```

4. 混合部署（部分服务在本地，部分在远程）：

```bash
# 本地服务
VAN_BLOG_ADMIN_URL="http://localhost:3002"
VAN_BLOG_WEBSITE_URL="http://localhost:3001"
# 远程服务
VAN_BLOG_SERVER_URL="http://dev-api.example.com"
VAN_BLOG_WALINE_URL="http://dev-waline.example.com"
# 浏览器访问地址
NEXT_PUBLIC_VANBLOG_SERVER_URL="http://dev-api.example.com"
```

### Next.js 环境变量命名规则

在 Next.js 应用中，只有以 `NEXT_PUBLIC_` 开头的环境变量可以在浏览器中访问。其他的环境变量只能在服务器端代码中使用。这是 Next.js 框架的设计决定，目的是为了防止敏感信息泄露到客户端。

因此，对于需要在浏览器中使用的变量（如 API 地址），必须使用 `NEXT_PUBLIC_` 前缀。这就是为什么我们有 `VAN_BLOG_SERVER_URL`（服务器端使用）和 `NEXT_PUBLIC_VANBLOG_SERVER_URL`（浏览器端使用）两个变量的原因。
