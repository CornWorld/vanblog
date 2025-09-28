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

### 阶段 1: 基础架构搭建

- [x] 创建基础模块结构 (src/modules, src/core, src/shared)
- [x] 配置 TypeScript 严格模式和 ESLint 规则
- [x] 设置环境变量管理系统 (config module)
- [x] 配置 Swagger/OpenAPI 文档生成
- [x] 设置日志系统 (Winston/Pino)
- [x] 配置 CORS 和安全中间件
- [x] 创建全局异常过滤器
- [x] 设置请求验证管道 (class-validator)
- [x] 配置数据库连接模块 (SQLite/Drizzle ORM)
- [x] 创建健康检查端点 (/health)

### 阶段 2: 核心模块实现

- [x] 实现用户数据模型 (User Schema)
- [x] 创建认证模块 (auth.module.ts)
- [x] 实现 JWT 认证策略
- [x] 创建登录/登出 API 端点
- [x] 实现用户管理基础 CRUD
- [x] 添加密码加密服务 (bcrypt)
- [x] 创建认证守卫 (auth.guard.ts)
- [x] 实现 Token 管理服务
- [x] 添加登录日志记录功能
- [x] 创建用户权限验证装饰器

### 阶段 3: 文章管理模块

- [x] 创建文章数据模型 (Article Schema)
- [x] 实现文章模块基础结构
- [x] 创建文章 CRUD API 端点
- [x] 实现文章搜索功能
- [x] 添加文章分页支持
- [x] 实现文章加密功能
- [x] 创建文章置顶逻辑
- [x] 实现文章隐藏功能
- [x] 添加文章浏览计数
- [x] 创建文章导入/导出功能

### 阶段 4: 分类和标签模块

- [x] 创建分类数据模型 (Category Schema)
- [x] 创建标签数据模型 (Tag Schema)
- [x] 实现分类管理 API
- [x] 实现标签管理 API
- [x] 创建分类/标签统计接口
- [x] 实现分类加密功能
- [x] 添加标签自动创建逻辑
- [x] 创建分类/标签关联查询

### 阶段 5: 草稿管理模块

- [x] 创建草稿数据模型 (Draft Schema)
- [x] 实现草稿 CRUD API
- [x] 创建草稿发布功能
- [x] 实现草稿自动保存
- [x] 添加草稿版本管理
- [x] 创建草稿导入功能

### 阶段 6: 媒体资源模块

- [x] 创建图片数据模型 (Static Schema)
- [x] 实现本地文件上传服务
- [x] 创建图片管理 API
- [x] 实现图片压缩功能
- [x] 添加图片水印功能
- [x] 创建图床配置管理
- [x] 实现 OSS 存储支持（通过 PicGo）
- [x] 添加图片批量操作
- [x] 实现剪贴板上传支持

### 系统配置模块

- [x] 创建站点元数据模型 (Meta Schema)
- [x] 创建系统设置模型 (Setting Schema)
- [x] 实现站点配置 API
- [x] 创建布局设置管理
- [x] 实现主题配置功能
- [x] 添加自定义代码注入
- [x] 创建导航栏配置管理
- [x] 实现友链管理功能

### 配置读写统一策略

- 统一写入：所有配置通过 SettingRegistryService 写入，确保并发安全
- 默认值管理：支持注册时和运行时默认值设置
- 数据校验：支持 Zod schema 和自定义验证器
- 安全保护：限制 payload 大小，记录异常操作

### 阶段 8: 数据分析模块

- [x] 创建访问统计模型
- [x] 实现访客分析 API
- [x] 创建文章阅读统计（可能需要取消文章模块的统计 API）
- [x] 实现数据看板接口（兼容 echarts）
- [x] 添加第三方统计集成
- [x] 创建数据导出功能

### 额外阶段

> 本阶段不允许一次 commit 解决多个需求

- [x] 检查文章模块与原版（server 包）的特性差异，看看是否为其超集
- [x] 检查草稿模块与原版的差异，看看是否为其超集 (缺失 demo 功能)
- [x] 检查分类模块与原版的差异，看看是否为其超集
- [x] 检查标签模块与原版的差异，看看是否为其超集（已添加缺失的外建约束）
- [x] 检查系统配置模块与原版的差异，看看是否为其超集（添加了可配置系统，各个功能已配置到独立模块并注册）
- [x] 检查数据分析模块与原版的差异，看看是否为其超集
- [x] 检查所有 dto， 检查测试，看是否满足需求，覆盖率较高（当前有19个测试文件，覆盖率39.79%，DTO结构完整，涵盖所有核心功能模块）
- [x] 使用 zod + [nestjs-zod](https://github.com/BenLorantfy/nestjs-zod) 替换 class-transformer 和 class-validator （注意 db 中的数据结构可能需要使用 z.infer<> 获取类型，不手动 JSON.parse 而是让 orm 解决；如果一定要手动操作，则使用 zod 的 safeParse 函数）
- [x] 检查目录结构，看其是否与最初计划的一致，看看是否存在令人困惑的部分（仅考虑被 git 追踪的目录，可以暂时删除所有未被追踪的目录）

### 额外节点：迁移到 drizzle-zod

- [x] 迁移到 drizzle-zod
- [x] 检查是否存在多余代码，清理

### 额外阶段：完善权限系统

#### 权限系统架构

- **模块化权限**: 每个模块独立管理权限节点（如 `article:read`）
- **角色继承**: 支持角色嵌套和权限叠加/撤销
- **装饰器支持**: 控制器中使用语义化权限名称
- **类型安全**: TypeScript 确保权限名称类型安全

- [x] 完成

### Plugin 系统

- [x] HookService 开发：实现 WordPress 风格的 action/filter 机制
- [x] PluginContext 基建：提供 logger、config、data 存储能力
- [x] 动态插件加载：自动扫描 plugins/ 目录，支持依赖管理
- [x] 安全隔离：运行时错误隔离，超时保护
- [x] 核心模块埋点：在关键业务流程中注入钩子
- [x] 测试插件：🐱插件示例
- [x] 插件系统文档：完整的插件开发指南 (docs/PLUGIN_DEVELOPMENT_GUIDE.md)
- [x] 迁移核心功能到插件：RSS 功能成功插件化（rss-plugin）

### 插件系统优化

- [x] 并行加载优化：所有插件通过 Promise.allSettled 并行加载，提升启动性能
- [x] 版本兼容性检查：支持 engines.vanblog 字段的 semver 版本约束验证
- [x] 错误隔离：单个插件加载失败不影响其他插件，记录失败插件列表

### 阶段 9: 高级功能

- [x] 实现增量静态再生 (ISR) 相关 WebHook（前端注册，后端事件触发，与 Plugin 系统集成）
- [x] 添加 RSS 生成功能
- [x] 创建站点地图生成
- [x] 实现评论系统集成（Waline 最新版）
- [x] 添加邮件通知服务（Plugin）
- [x] 创建备份/恢复功能

### 阶段 10: 性能优化

- [x] 优化数据库查询（不需要任何缓存。提供索引优化）
- [x] 添加响应压缩（gzip）
- [x] 创建 CDN 集成
- [x] 图像服务上传时优化图片处理性能（webp avif）

### 阶段 11: 迁移和兼容

- [x] 创建数据迁移脚本
- [x] 编写升级指南
- [x] 创建回滚方案
- [x] 测试兼容性

### 阶段 12：文档整理

- [x] 清理无效文档，保持项目整洁

### 阶段 14：文档差异补齐（Feature Gaps）

- [x] 媒体全局处理配置：新增站点级图片处理策略（自动压缩/格式转换/水印）的集中配置与开关，默认关闭，保证向后兼容；上传接口读取该配置并可由入参覆盖
- [x] PicGo 插件管理 API：提供插件安装/卸载/查询接口与执行日志，复用现有 picgo-storage.service 能力
- [x] 社交媒体链接：打通 public/options 输出链路（移除强制空数组）
- [x] 社交媒体链接 CRUD：后端提供完整的增删改查与类型唯一性校验
- [x] 关于页内容管理：提供 AboutInfo 的 CRUD 与 public 渲染输出（保持 showAbout 默认行为不变）

### 阶段 13：公共模块（Public）

- [x] 自定义页面列表 API：GET /api/v2/public/customPage/all
- [x] 自定义页面详情 API：GET /api/v2/public/customPage?path=...

### 阶段 14：集成测试（Integration）

- [x] Website-Server-NG 集成：配置 server-ng 监听 0.0.0.0:3050，修复 website API 代理
- [x] API 代理验证：确保 website 能正确代理请求到 server-ng 的 v2 API
- [x] 端到端测试：验证 website 前端与 server-ng 后端的完整数据流
- [x] 错误处理优化：改进 API 客户端的错误处理和类型安全
- [x] 开发环境配置：优化 dev-server 脚本，提升开发体验

### 注意事项

1. 任务独立完成，优先基础架构
2. 保持代码质量和测试覆盖
3. 遵循 NestJS 最佳实践
4. 确保 API 设计一致性
