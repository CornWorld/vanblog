# VanBlog Server-NG 升级指南

本指南将帮助您从 VanBlog v1 (packages/server) 升级到 VanBlog v2 (packages/server-ng)。

## 概述

VanBlog Server-NG 是 VanBlog 的下一代 API 服务器，采用模块化架构，提供更好的性能、可维护性和扩展性。

### 主要改进

- 模块化架构: 每个功能域独立成模块，便于维护和扩展
- 现代技术栈: 使用 Drizzle ORM + SQLite 替代 Mongoose + MongoDB
- 严格类型检查: 使用 Zod 4 + TypeScript 严格模式
- 插件系统: 支持动态插件加载和 Hook 机制
- 性能优化: 更好的查询优化和缓存策略
- API 一致性: 统一的 RESTful API 设计

## 版本兼容性

### 支持的版本

- 源版本: VanBlog v0.54.x (packages/server)
- 目标版本: VanBlog v2.x (packages/server-ng)

### 兼容性说明

- ❗ v1 API 已移除：所有以 `/api/v1/*` 开头的请求将返回 410 Gone，并附带迁移建议，由全局中间件统一拦截。
- ✅ 数据迁移: 支持从 MongoDB 迁移到 SQLite
- ✅ 配置兼容: 支持现有配置文件格式
- ⚠️ 插件系统: 需要重写现有插件以适配新的插件架构

## 升级前准备

### 1. 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- 足够的磁盘空间用于数据迁移

### 2. 备份数据

```bash
# 备份 MongoDB 数据
mongodump --db vanBlog --out ./backup/mongodb

# 备份配置文件
cp packages/server/config.yaml ./backup/

# 备份静态文件
cp -r /path/to/static/files ./backup/static/
```

### 3. 检查依赖

```bash
# 检查当前版本
cd packages/server
npm list @vanblog/server

# 检查数据库连接
npm run test:db
```

## 升级步骤

### 步骤 1: 安装 Server-NG

```bash
# 进入项目根目录
cd /path/to/vanblog

# 安装依赖
cd packages/server-ng
pnpm install
```

### 步骤 2: 数据迁移

```bash
# 运行数据迁移脚本
pnpm run migrate:from-v1

# 验证迁移结果
pnpm run migrate:verify
```

### 步骤 3: 配置迁移

```bash
# 复制并转换配置文件
cp ../server/config.yaml ./config.yaml

# 运行配置转换脚本
pnpm run config:migrate
```

### 步骤 4: 启动服务

```bash
# 开发模式启动
bash dev-server.sh start

# 检查服务状态
bash dev-server.sh status

# 查看日志
bash dev-server.sh logs
```

### 步骤 5: 验证功能

```bash
# 运行测试套件
pnpm run test
pnpm run test:e2e

# 验证健康检查与 v2 基础接口
curl http://localhost:3000/health
curl http://localhost:3000/api/v2/articles
```

## API 变更说明

### v1 访问控制

- v1 API 已不再提供兼容层。为防止误用，访问 `/api/v1/*` 将返回 410 Gone。
- 中间件会返回结构化的错误体，包含迁移建议。

### v2 API 设计

- 统一响应格式、明确的版本化（URI 形式，即 `/api/v2/*`）
- 参见 Swagger 文档：`/api/docs`

```typescript
// v2 API 统一响应格式（示意）
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

#### 统一响应格式

```typescript
// v2 API 统一响应格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}
```

#### 新增端点

- `GET /api/v2/public/site-info` - 站点信息
- `GET /api/v2/public/navigation` - 导航配置
- `GET /api/v2/articles` - 文章管理 (支持更多查询选项)
- `GET /api/v2/categories` - 分类管理
- `GET /api/v2/tags` - 标签管理
- `GET /api/v2/analytics` - 数据分析

## 数据库变更

### 从 MongoDB 到 SQLite

| MongoDB 集合 | SQLite 表       | 说明     |
| ------------ | --------------- | -------- |
| articles     | articles        | 文章数据 |
| categories   | categories      | 分类数据 |
| tags         | tags            | 标签数据 |
| users        | users           | 用户数据 |
| metas        | site_settings   | 站点设置 |
| settings     | system_settings | 系统设置 |

### 数据类型映射

| MongoDB 类型 | SQLite 类型 | 说明        |
| ------------ | ----------- | ----------- |
| ObjectId     | TEXT        | 使用 UUID   |
| Date         | INTEGER     | Unix 时间戳 |
| Boolean      | INTEGER     | 0/1         |
| Array        | TEXT        | JSON 字符串 |
| Object       | TEXT        | JSON 字符串 |

## 配置变更

### 配置文件格式

```yaml
# v1 配置 (config.yaml)
database:
  url: mongodb://localhost:27017/vanBlog
static:
  path: /path/to/static

# v2 配置 (config.yaml)
database:
  type: sqlite
  path: ./data/vanblog.db
storage:
  type: local
  path: ./data/uploads
server:
  port: 3000
  cors:
    enabled: true
    origins: ['http://localhost:3001']
```

### 环境变量

```bash
# v1 环境变量
MONGO_URL=mongodb://localhost:27017/vanBlog
STATIC_PATH=/path/to/static

# v2 环境变量
DATABASE_URL=file:./data/vanblog.db
UPLOAD_PATH=./data/uploads
PORT=3000
NODE_ENV=production
```

## 插件系统升级

### v1 插件结构

```javascript
// v1 插件
module.exports = {
  name: 'my-plugin',
  init: (app) => {
    // 插件初始化
  },
};
```

### v2 插件结构

```typescript
// v2 插件 (plugins/my-plugin/index.ts)
import { Injectable } from '@nestjs/common';
import { HookService, PluginContext } from '@vanblog/server-ng';

@Injectable()
export class MyPlugin {
  constructor(
    private readonly hookService: HookService,
    private readonly context: PluginContext,
  ) {
    this.init();
  }

  private init() {
    // 注册 Hook
    this.hookService.addAction('article:beforeSave', this.beforeSave.bind(this));
    this.hookService.addFilter('article:content', this.filterContent.bind(this));
  }

  private async beforeSave(article: any) {
    this.context.logger.log('Article before save:', article.title);
  }

  private async filterContent(content: string): Promise<string> {
    return content + ' [Modified by plugin]';
  }
}
```

## 性能优化

### 查询优化

- 使用 Drizzle ORM 的查询构建器
- 自动索引优化
- 连接池管理
- 查询缓存

### 响应优化

- Gzip 压缩
- 静态资源缓存
- API 响应缓存
- 图片优化 (WebP/AVIF)

## 故障排除

### 常见问题

#### 1. 数据迁移失败

```bash
# 检查 MongoDB 连接
mongo --eval "db.adminCommand('ismaster')"

# 重新运行迁移
pnpm run migrate:from-v1 --force

# 查看迁移日志
tail -f logs/migration.log
```

#### 2. API 兼容性问题

```bash
# 检查 v1 API 状态
curl -I http://localhost:3000/api/public/meta

# 启用详细日志
DEBUG=vanblog:* pnpm run start:dev
```

#### 3. 插件加载失败

```bash
# 检查插件目录
ls -la plugins/

# 查看插件日志
tail -f logs/plugins.log

# 重新安装插件依赖
cd plugins/my-plugin && pnpm install
```

### 日志分析

```bash
# 查看应用日志
tail -f logs/application.log

# 查看错误日志
tail -f logs/error.log

# 查看性能日志
tail -f logs/performance.log
```

## 回滚方案

如果升级过程中遇到问题，可以按以下步骤回滚：

### 1. 停止 Server-NG

```bash
cd packages/server-ng
bash dev-server.sh stop
```

### 2. 恢复 v1 服务

```bash
cd packages/server
npm run start:prod
```

### 3. 恢复数据

```bash
# 恢复 MongoDB 数据
mongorestore --db vanBlog ./backup/mongodb/vanBlog

# 恢复配置文件
cp ./backup/config.yaml packages/server/
```

## 技术支持

### 获取帮助

- 📖 [文档](https://vanblog.mereith.com/docs)
- 🐛 [问题反馈](https://github.com/Mereithhh/van-blog/issues)
- 💬 [讨论区](https://github.com/Mereithhh/van-blog/discussions)
- 📧 [邮件支持](mailto:support@vanblog.com)

### 社区资源

- [升级经验分享](https://github.com/Mereithhh/van-blog/discussions/categories/upgrades)
- [插件开发指南](https://vanblog.mereith.com/docs/plugin-development)
- [API 参考文档](https://vanblog.mereith.com/docs/api-reference)

---

**注意**: 升级前请务必备份数据，并在测试环境中验证升级流程。如有疑问，请及时联系技术支持。
