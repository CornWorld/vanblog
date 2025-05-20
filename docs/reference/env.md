---
title: 环境变量
icon: leaf
order: 2
---

VanBlog 启动时，会读取一些环境变量以配置自身。

| 名称                             | 必填 | 说明                                                                        | 默认值                                           |
| -------------------------------- | ---- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| `VAN_BLOG_DATABASE_URL`          | 否   | mongoDB URL                                                                 | `mongodb://mongo:27017/vanBlog?authSource=admin` |
| `VAN_BLOG_SERVER_URL`            | 否   | 后端服务器地址，用于服务端渲染时连接后端                                    | `http://127.0.0.1:3000`                          |
| `NEXT_PUBLIC_VANBLOG_SERVER_URL` | 否   | 前端/浏览器访问后端的地址，如果不设置则使用 `VAN_BLOG_SERVER_URL`           | 与 `VAN_BLOG_SERVER_URL` 相同                    |
| `VAN_BLOG_CDN_URL`               | 否   | CDN 部署的地址，在开启之前请不要设置此项。此项会导致公共资源从此 URL 获取。 | `""`                                             |
| `VAN_BLOG_WALINE_DB`             | 否   | 内嵌评论系统的数据库名，默认为 waline                                       | `""`                                             |
| `EMAIL`                          | 否   | 用于自动申请 https 证书的邮箱                                               | `""`                                             |
| `VAN_BLOG_DEBUG_MODE`            | 否   | 是否启用调试模式                                                            | `false`                                          |
| `VAN_BLOG_ADMIN_PROXY`           | 否   | 调试模式下，admin 包的代理地址                                              | `127.0.0.1:3002`                                 |
| `VAN_BLOG_SERVER_PROXY`          | 否   | 调试模式下，server 的代理地址                                               | `127.0.0.1:3000`                                 |
| `VAN_BLOG_WEBSITE_PROXY`         | 否   | 调试模式下，website 的代理地址                                              | `127.0.0.1:3001`                                 |
| `VAN_BLOG_WALINE_PROXY`          | 否   | 调试模式下，waline 的代理地址                                               | `127.0.0.1:8360`                                 |

## 注意事项

::: tip

每次修改后，需要重启 VanBlog 服务 或重启 VanBlog Docker 容器方能生效。

:::

::: warning 警示

为避免特殊字符对 bash 的干扰，请务必将环境变量的值用双引号围起来!

如 `"https://example.com"`

:::

### 使用 VAN_BLOG_SERVER_URL 和 NEXT_PUBLIC_VANBLOG_SERVER_URL

当部署在不同环境中时，可能需要设置这两个变量为不同的值，例如:

- 服务端可能使用内部网络地址访问后端: `VAN_BLOG_SERVER_URL="http://internal-api:3000"`
- 浏览器需要使用可公开访问的地址: `NEXT_PUBLIC_VANBLOG_SERVER_URL="https://api.example.com"`

这在以下场景特别有用:

1. 当在 Kubernetes 或复杂网络环境中部署时
2. 当使用内部网络 IP 进行服务间通信但需要公共域名供浏览器访问时
3. 当后端服务器通过不同的端口或路径对内外暴露时

### 开发模式下的代理配置

在开发模式下（`VAN_BLOG_DEBUG_MODE="true"`），你可以通过以下环境变量来配置各个服务的代理地址：

1. `VAN_BLOG_ADMIN_PROXY`: admin 包的代理地址
2. `VAN_BLOG_SERVER_PROXY`: server 的代理地址
3. `VAN_BLOG_WEBSITE_PROXY`: website 的代理地址
4. `VAN_BLOG_WALINE_PROXY`: waline 的代理地址

这在以下场景特别有用：

1. 本地开发时只启动部分服务
2. 将某些服务部署在其他机器上进行开发
3. 在微服务架构中分别部署各个服务
4. 进行 A/B 测试或灰度发布

### Next.js 环境变量命名规则

在 Next.js 应用中，只有以 `NEXT_PUBLIC_` 开头的环境变量可以在浏览器中访问。其他的环境变量只能在服务器端代码中使用。这是 Next.js 框架的设计决定，目的是为了防止敏感信息泄露到客户端。

因此，对于需要在浏览器中使用的变量（如 API 地址），必须使用 `NEXT_PUBLIC_` 前缀。
