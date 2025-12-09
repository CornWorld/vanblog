# waline 模块文档

[根目录](../../CLAUDE.md) > [packages](../) > **waline**

---

## 变更记录 (Changelog)

### 2025-12-09 - 深度补充扫描
- 补充详细配置选项与环境变量
- 添加前端集成示例
- 记录 Vercel 部署配置
- 添加故障排除指南

### 2025-12-09 - 初始化
- 初始化模块文档
- 记录基础配置

---

## 模块职责

waline 是 VanBlog 的评论系统模块，基于 [@waline/vercel](https://waline.js.org/) 构建，提供完整的评论管理功能。

**核心职责**：
- 提供评论服务 API
- 支持多种后端存储（Vercel KV、MongoDB、SQLite、MySQL、PostgreSQL）
- 支持邮件通知
- 支持多语言（中文、英文等）
- 支持 Markdown 评论
- 支持表情包与图片上传
- 支持访客统计与数据分析

---

## 入口与启动

### 主入口

- **文件**: `index.js`（实际调用 `@waline/vercel/vanilla.js`）
- **启动命令**: `pnpm start`
- **默认端口**: 8360（可通过环境变量配置）

### 启动流程

1. 加载 `@waline/vercel/vanilla.js`
2. 读取环境变量配置
3. 初始化数据库连接
4. 启动 HTTP 服务器
5. 注册路由与中间件

---

## 关键依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `@waline/vercel` | 1.32.3 | Waline 核心库（Serverless 适配） |

---

## 配置

### 环境变量配置

Waline 通过环境变量进行配置，以下是常用配置项：

#### 数据库配置

```bash
# 数据库类型（必选）
WALINE_DB=sqlite                # 可选：sqlite, mysql, pgsql, mongodb, vercel, leancloud

# SQLite 配置（默认）
SQLITE_PATH=/data/waline.db     # SQLite 数据库文件路径

# MySQL 配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=waline
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_PREFIX=wl_                # 表前缀

# PostgreSQL 配置
PG_HOST=localhost
PG_PORT=5432
PG_DB=waline
PG_USER=postgres
PG_PASSWORD=password
PG_PREFIX=wl_

# MongoDB 配置
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=waline
MONGO_USER=admin
MONGO_PASSWORD=password
MONGO_AUTHSOURCE=admin
```

#### 邮件通知配置

```bash
# SMTP 配置
SMTP_SERVICE=Gmail              # 预设服务：Gmail, QQ, 163, etc.
SMTP_HOST=smtp.gmail.com        # 或自定义 SMTP 主机
SMTP_PORT=465
SMTP_USER=your@email.com
SMTP_PASS=your-password

# 邮件发送者信息
SITE_NAME=VanBlog               # 站点名称
SITE_URL=https://yourblog.com   # 站点 URL
AUTHOR_EMAIL=admin@yourblog.com # 博主邮箱（接收通知）

# 通知类型
MAIL_SUBJECT=新评论通知          # 邮件主题
MAIL_TEMPLATE=default           # 邮件模板
```

#### 安全配置

```bash
# JWT 密钥（必须设置）
JWT_TOKEN=your-secret-key-here

# 管理员密码（首次登录后可修改）
ADMIN_EMAIL=admin@yourblog.com
ADMIN_PASS=your-admin-password

# AKISMET 反垃圾（可选）
AKISMET_KEY=your-akismet-key

# reCAPTCHA（可选）
RECAPTCHA_V3_SECRET=your-recaptcha-secret
```

#### 存储与上传配置

```bash
# 图片上传（可选）
ATTACHMENT=true                 # 是否允许上传附件
UPLOAD_FILE_SIZE=1024          # 文件大小限制（KB）

# 七牛云存储（可选）
QINIU_ACCESS_KEY=your-access-key
QINIU_SECRET_KEY=your-secret-key
QINIU_BUCKET=your-bucket
QINIU_DOMAIN=https://cdn.yourblog.com

# 腾讯云 COS（可选）
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=your-bucket
COS_REGION=ap-guangzhou
```

#### 其他配置

```bash
# 服务器配置
PORT=8360                       # 服务端口
TZ=Asia/Shanghai                # 时区

# 评论审核
COMMENT_AUDIT=false             # 评论是否需要审核

# IP 地域查询（可选）
IP2REGION_DB=/data/ip2region.xdb

# 日志级别
LOG_LEVEL=info                  # debug, info, warn, error
```

### 完整配置示例

```bash
# .env.waline
WALINE_DB=sqlite
SQLITE_PATH=/data/waline.db

JWT_TOKEN=my-secret-jwt-token-2024

SMTP_SERVICE=Gmail
SMTP_USER=yourblog@gmail.com
SMTP_PASS=your-app-password

SITE_NAME=VanBlog
SITE_URL=https://yourblog.com
AUTHOR_EMAIL=admin@yourblog.com

ADMIN_EMAIL=admin@yourblog.com
ADMIN_PASS=initial-admin-password

COMMENT_AUDIT=false
ATTACHMENT=true
UPLOAD_FILE_SIZE=2048

TZ=Asia/Shanghai
PORT=8360
```

---

## 前端集成

### 在 website 模块中集成

#### 1. 安装依赖

```bash
cd packages/website
pnpm add @waline/client
```

#### 2. 创建评论组件

```typescript
// components/Comment.tsx
import { useEffect, useRef } from 'react';
import { init } from '@waline/client';
import '@waline/client/style';

interface CommentProps {
  path: string;           // 当前文章路径
  serverURL: string;      // Waline 服务器地址
}

export function Comment({ path, serverURL }: CommentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const waline = init({
      el: containerRef.current,
      serverURL,
      path,
      lang: 'zh-CN',
      dark: 'auto',
      meta: ['nick', 'mail', 'link'],
      requiredMeta: ['nick'],
      login: 'enable',
      wordLimit: [0, 1000],
      pageSize: 10,
      imageUploader: false,
      highlighter: true,
      texRenderer: false,
      emoji: [
        '//unpkg.com/@waline/emojis@1.2.0/weibo',
        '//unpkg.com/@waline/emojis@1.2.0/bilibili',
      ],
    });

    return () => waline?.destroy();
  }, [path, serverURL]);

  return <div ref={containerRef} className="waline-container" />;
}
```

#### 3. 在文章页面使用

```typescript
// pages/post/[id].tsx
import { Comment } from '@/components/Comment';

export default function PostPage({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <Comment
        path={`/post/${post.id}`}
        serverURL={process.env.NEXT_PUBLIC_WALINE_URL || 'http://localhost:8360'}
      />
    </article>
  );
}
```

---

## server-ng 集成

### CommentModule 代理

server-ng 通过 `CommentModule` 提供 Waline API 代理：

```typescript
// src/modules/comment/comment.controller.ts
@Controller('api/v2/comment')
export class CommentController {
  constructor(private readonly httpService: HttpService) {}

  @Get('*')
  async proxyGet(@Req() req, @Res() res) {
    const walineURL = process.env.WALINE_URL || 'http://localhost:8360';
    const targetURL = `${walineURL}${req.url.replace('/api/v2/comment', '')}`;

    const response = await this.httpService.get(targetURL).toPromise();
    return res.status(response.status).json(response.data);
  }

  @Post('*')
  async proxyPost(@Req() req, @Res() res) {
    const walineURL = process.env.WALINE_URL || 'http://localhost:8360';
    const targetURL = `${walineURL}${req.url.replace('/api/v2/comment', '')}`;

    const response = await this.httpService.post(targetURL, req.body).toPromise();
    return res.status(response.status).json(response.data);
  }
}
```

---

## 部署

### Docker Compose 部署

```yaml
# docker-compose.yml
services:
  waline:
    image: lizheming/waline:latest
    container_name: vanblog-waline
    restart: unless-stopped
    ports:
      - "8360:8360"
    environment:
      - TZ=Asia/Shanghai
      - WALINE_DB=sqlite
      - SQLITE_PATH=/data/waline.db
      - JWT_TOKEN=${JWT_TOKEN}
      - SITE_NAME=VanBlog
      - SITE_URL=${SITE_URL}
      - SMTP_SERVICE=Gmail
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - AUTHOR_EMAIL=${ADMIN_EMAIL}
    volumes:
      - ./data/waline:/data
    networks:
      - vanblog-network

networks:
  vanblog-network:
    external: true
```

### Vercel 部署

1. Fork [Waline](https://github.com/walinejs/waline) 仓库
2. 在 Vercel 导入项目
3. 配置环境变量（同上述环境变量）
4. 部署完成后获取 Serverless 地址

### 独立服务器部署

```bash
# 安装 Node.js 22+
nvm install 22
nvm use 22

# 克隆项目
git clone https://github.com/yourusername/vanblog.git
cd vanblog/packages/waline

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
vim .env

# 启动服务
pnpm start

# 使用 PM2 守护进程
pnpm global add pm2
pm2 start index.js --name waline
pm2 save
pm2 startup
```

---

## 管理后台

### 访问管理面板

- **URL**: `http://localhost:8360/ui`
- **首次登录**: 使用 `ADMIN_EMAIL` 和 `ADMIN_PASS` 登录
- **功能**:
  - 评论管理（审核、删除、回复）
  - 用户管理
  - 数据统计
  - 设置修改

### 管理员权限

- 审核评论
- 删除评论
- 标记为垃圾评论
- 管理用户（拉黑、设置管理员）
- 查看访问统计

---

## 常见问题 (FAQ)

### Q1: 如何修改管理员密码？

1. 访问 `http://localhost:8360/ui`
2. 使用初始密码登录
3. 进入"设置" -> "个人设置"
4. 修改密码并保存

### Q2: 评论需要审核吗？

默认不需要审核（`COMMENT_AUDIT=false`）。如需开启审核：

```bash
COMMENT_AUDIT=true
```

### Q3: 如何防止垃圾评论？

推荐配置：

1. 启用 Akismet（需申请 API Key）
2. 启用 reCAPTCHA v3
3. 开启评论审核
4. 配置敏感词过滤

```bash
AKISMET_KEY=your-key
RECAPTCHA_V3_SECRET=your-secret
COMMENT_AUDIT=true
FORBIDDEN_WORDS=敏感词1,敏感词2
```

### Q4: 邮件通知不生效？

检查清单：

1. SMTP 配置是否正确
2. Gmail 是否开启"允许不够安全的应用"或使用应用专用密码
3. 查看 Waline 日志：`docker logs vanblog-waline`
4. 测试 SMTP 连接：使用 telnet 测试端口连通性

### Q5: 数据库迁移

从 SQLite 迁移到 MySQL：

```bash
# 1. 导出 SQLite 数据
sqlite3 waline.db .dump > backup.sql

# 2. 修改 SQL 语法（SQLite -> MySQL）
# 3. 导入 MySQL
mysql -u root -p waline < backup.sql

# 4. 修改环境变量
WALINE_DB=mysql
MYSQL_HOST=localhost
MYSQL_DB=waline
MYSQL_USER=root
MYSQL_PASSWORD=password
```

### Q6: 如何备份评论数据？

**SQLite 备份**：
```bash
# 复制数据库文件
cp /data/waline.db /backup/waline-$(date +%Y%m%d).db
```

**MySQL 备份**：
```bash
mysqldump -u root -p waline > waline-backup-$(date +%Y%m%d).sql
```

---

## 性能优化

### 数据库优化

- 使用 MySQL/PostgreSQL 替代 SQLite（高并发场景）
- 定期清理垃圾评论与过期会话
- 添加数据库索引

### 缓存配置

- 启用 Redis 缓存（需额外配置）
- 配置 CDN 加速静态资源

### 负载均衡

- 使用 Nginx 反向代理
- 部署多个 Waline 实例
- 配置数据库主从复制

---

## 相关文件

```
packages/waline/
├── package.json           # 依赖配置
├── package-lock.json      # 锁定文件
├── index.js               # 入口文件（调用 @waline/vercel）
├── CLAUDE.md              # 本文档
└── .env.example           # 环境变量示例（建议创建）
```

---

## 扩展阅读

- [Waline 官方文档](https://waline.js.org/)
- [Waline GitHub](https://github.com/walinejs/waline)
- [@waline/client API](https://waline.js.org/reference/client.html)
- [Waline 服务端配置](https://waline.js.org/reference/server.html)
- [Waline 数据库配置](https://waline.js.org/guide/database.html)
