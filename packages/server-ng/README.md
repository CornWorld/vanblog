# VanBlog Server-NG

## 项目目标

`server-ng` 是 VanBlog 的新一代 API 服务器，旨在对现有的 server 包进行全面重构和升级。本项目基于 NestJS v11 框架，目标是构建一个更加模块化、高性能、易维护的博客后端服务。

### 核心目标

1. **架构升级**: 从现有架构迁移到更加现代化的模块化架构
2. **性能优化**: 提升 API 响应速度和并发处理能力
3. **代码质量**: 采用 TypeScript 严格模式，提高代码可维护性
4. **API 设计**: 设计符合 RESTful 规范的 v2 API
5. **数据库抽象**: 引入 ORM 层，支持多种数据库
6. **测试覆盖**: 完善的单元测试和 E2E 测试

## 项目结构

```
server-ng/
├── src/
│   ├── modules/          # 业务模块
│   │   ├── article/      # 文章管理模块
│   │   ├── auth/         # 认证授权模块
│   │   ├── user/         # 用户管理模块
│   │   ├── category/     # 分类管理模块
│   │   ├── tag/          # 标签管理模块
│   │   ├── media/        # 媒体资源模块
│   │   ├── analytics/    # 数据分析模块
│   │   ├── public/       # 公共接口模块
│   │   ├── demo/         # 演示模式模块

│   ├── core/             # 核心模块
│   │   ├── filters/      # 全局异常过滤器
│   │   ├── guards/       # 全局守卫
│   │   ├── interceptors/ # 全局拦截器
│   │   └── middlewares/  # 全局中间件
│   ├── shared/           # 共享模块
│   │   ├── services/     # 共享服务
│   │   ├── utils/        # 工具函数
│   │   └── types/        # 类型定义
│   ├── config/           # 配置管理
│   ├── database/         # 数据库配置
│   └── main.ts           # 应用入口
├── test/                 # 测试文件
├── docs/                 # API 文档
└── scripts/              # 脚本工具
```

## 技术栈

- **框架**: NestJS v11
- **语言**: TypeScript 5.x
- **数据库**: SQLite (通过 libSQL 支持本地/Turso/Cloudflare D1)
- **ORM**: Drizzle ORM
- **认证**: JWT
- **文档**: OpenAPI/Swagger
- **测试**: Vitest
- **包管理**: pnpm

## 与现有 server 包的关系

本项目是对 `/packages/server` 的重构升级版本，主要改进包括：

1. **模块化架构**: 采用 NestJS 的模块化设计，每个功能域独立成模块
2. **API 版本化**: 采用 v2 API，v1 已移除；访问 `/api/v1/*` 将由中间件拦截并返回 410 Gone
3. **性能提升**: 优化数据库查询，引入缓存机制
4. **扩展性增强**: 更容易添加新功能和集成第三方服务

## 快速开始

### 环境要求

- Node.js >= 22
- pnpm >= 10

### 安装依赖

```bash
pnpm i
```

### 测试

```bash
pnpm run test && pnpm test:e2e && pnpm test:cov
```

## API 文档

启动开发服务器后，访问 `http://localhost:3000/api/docs` 查看 Swagger API 文档。

## 配置

环境变量配置参考 `.env.example` 文件：

```env
# 应用配置
PORT=3000
NODE_ENV=development

# 数据库配置
DATABASE_DRIVER=local # local | turso | d1
DATABASE_URL=file:./data/vanblog.db
# For Turso
# DATABASE_URL=libsql://your-database.turso.io
# DATABASE_AUTH_TOKEN=your-auth-token
# For Cloudflare D1
# CLOUDFLARE_ACCOUNT_ID=your-account-id
# CLOUDFLARE_DATABASE_ID=your-database-id
# CLOUDFLARE_D1_TOKEN=your-d1-token

# JWT 配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# 其他配置...
```

## 贡献指南

在提交代码前，请确保：

1. 遵循 TypeScript 和 NestJS 最佳实践
2. 编写相应的单元测试
3. 更新相关文档
4. 通过所有测试和 lint 检查

## 许可证

本项目遵循 GPL v3 许可证。

## 开发任务清单 (TODO List)

每个任务设计为可在单次对话中完成，避免频繁切换环境或破坏性操作。

### 🚨 紧急任务：ESM 迁移

**当前状态分析**：

- 项目根目录 `package.json` 已设置 `"type": "module"`，但存在大量 CommonJS 遗留代码
- 发现 **3270+ lint 错误**，主要是 `@typescript-eslint/no-require-imports` 问题
- 需要系统性地将所有 CommonJS 代码迁移到 ESM

**主要 CommonJS 使用点**：

- `/scripts/` 目录：`check.js`, `dev.js`, `start.js`, `webhook.js`
- `/packages/cli/resetHttps.js`
- 部分配置文件：`.eslintrc.js`, `postcss.config.js`, `tailwind.config.js`

#### ESM 迁移任务

- [x] **修复根目录脚本文件**：将 `/scripts/` 下所有 `.js` 文件从 CommonJS 转换为 ESM
  - [x] `scripts/check.js` - MongoDB 连接和 YAML 处理
  - [x] `scripts/dev.js` - 开发服务器启动脚本
  - [x] `scripts/start.js` - 生产服务器启动脚本
  - [x] `scripts/webhook.js` - HTTP 服务器脚本

- [x] **修复 CLI 工具**：转换 `/packages/cli/resetHttps.js` 为 ESM

- [x] **配置文件迁移**：
  - [x] 将 `.eslintrc.js` 重命名为 `eslint.config.js` 并转换为 ESM
  - [x] 检查其他配置文件的 ESM 兼容性
  - [x] 迁移 `packages/website` 中的配置文件：`postcss.config.js`, `tailwind.config.js`, `next-i18next.config.js`

- [x] **验证和清理**：
  - [x] 运行 `pnpm lint` 确保所有 lint 错误已修复
  - [x] 测试所有脚本功能正常
  - [x] 确保构建和开发流程正常工作

- [x] **文档更新**：更新相关文档中的脚本使用说明

### 🎯 后续优化任务

- [x] **数据契约优化**：重构 website API 服务中的防御性编程代码
  - 当前使用 `data?.meta || ({} as any)` 等临时修复
  - 需要定义清晰的 TypeScript 接口和默认值策略
  - 消除 `any` 类型的使用

- [ ] **性能监控**：添加 API 响应时间和错误率监控

- [x] **安全加固**：审查和加强 JWT 令牌管理和 CORS 配置

## 注意事项

1. 任务独立完成，优先基础架构
2. 保持代码质量和测试覆盖
3. 遵循 NestJS 最佳实践
4. 确保 API 设计一致性
