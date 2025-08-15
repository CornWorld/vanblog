# V2 缺失特性分析报告

## 概述

分析比较了 v1 API 与 v2 API 的功能差异，以确定在移除 v1 兼容模块后可能需要在 v2 中实现的特性。

## v1 API 功能清单

### Public V1 Controller (`/api/v1/public/`)

1. **getAllCustomPages** - 获取所有自定义页面 ❌ TODO
2. **getCustomPageByPath/:path** - 根据路径获取自定义页面 ❌ TODO
3. **getArticleByIdOrPathname/:idOrPathname** - 通过 ID 或路径名获取文章
4. **getArticleWithPassword/:idOrPathname** - 带密码验证的文章获取 ❌ TODO
5. **searchArticle** - 搜索文章（支持分页）
6. **addViewer** - 添加访客统计
7. **getViewer** - 获取访客统计
8. **getViewerByArticleIdOrPathname/:idOrPathname** - 获取特定文章访客统计
9. **getArticlesByTagName/:tagName** - 根据标签名获取文章
10. **getByOption** - 统一选项接口（articles/categories/tags/siteMeta/layout/theme/nav）
11. **getTimeLineInfo** - 获取时间线信息 ❌ TODO
12. **getArticlesByCategory/:category** - 根据分类获取文章
13. **getArticlesByTag/:tag** - 根据标签获取文章（支持 ID 和名称）
14. **getMeta** - 获取站点元数据
15. **getBuildMeta** - 获取构建元数据

### Auth V1 Controller (`/api/v1/auth/`)

1. **login** - 用户登录（v1 兼容格式）
2. **profile** - 获取用户配置
3. **logout** - 用户登出
4. **logs** - 获取登录日志

## v2 API 对应功能

### 已实现的对等功能

#### Articles Module (`/api/v2/articles/`)

- ✅ `GET /articles` - 获取所有文章
- ✅ `GET /articles/search` - 搜索文章
- ✅ `GET /articles/:id` - 根据 ID 获取文章
- ✅ `POST /articles/:id/increment-view` - 增加文章浏览量（按 ID）
- ✅ `POST /articles/increment-view/:pathname` - 增加文章浏览量（按 pathname）

#### Categories Module (`/api/v2/categories/`)

- ✅ `GET /categories` - 获取所有分类
- ✅ `GET /categories/:id/articles` - 根据分类获取文章

#### Tags Module (`/api/v2/tags/`)

- ✅ `GET /tags` - 获取所有标签

#### Analytics Module (`/api/v2/`)

- ✅ `POST /analytics/record` - 记录分析数据
- ✅ `POST /article/:id/view` - 记录文章浏览

#### Auth Module (`/api/v2/auth/`)

- ✅ `POST /auth/login` - 用户登录
- ✅ `GET /auth/profile` - 获取用户配置
- ✅ `POST /auth/logout` - 用户登出

## v2 缺失的特性

### 高优先级（核心功能）

1. **自定义页面系统** ⚠️
   - 数据库表已存在：`customPages`
   - v1 接口：`getAllCustomPages`, `getCustomPageByPath`
   - v2 状态：无对应控制器
   - **影响**：如果前端依赖自定义页面功能，会导致功能缺失

2. **文章密码验证** ⚠️
   - v1 接口：`getArticleWithPassword`
   - v2 状态：无对应实现
   - **影响**：私密文章无法通过密码访问

3. **时间线功能** ⚠️
   - v1 接口：`getTimeLineInfo`
   - v2 状态：无对应实现
   - **影响**：时间线页面无法正常显示

4. **通过 pathname 获取文章** ⚠️
   - v1 接口：`getArticleByIdOrPathname` 支持 pathname
   - v2 状态：只支持通过 ID 获取
   - **影响**：SEO 友好的 URL 无法正常工作

### 中优先级（数据聚合）

5. **统一选项接口** ⚠️
   - v1 接口：`getByOption` 支持多种数据类型聚合
   - v2 状态：需要多次 API 调用
   - **影响**：前端需要重构数据获取逻辑

6. **按标签名获取文章** ⚠️
   - v1 接口：`getArticlesByTagName/:tagName`
   - v2 状态：需要先通过标签名查询标签 ID，再查询文章
   - **影响**：增加 API 调用复杂度

7. **访客统计查询** ⚠️
   - v1 接口：`getViewer`, `getViewerByArticleIdOrPathname`
   - v2 状态：分析模块主要面向管理员
   - **影响**：公开访客统计功能缺失

### 低优先级（元数据）

8. **构建元数据** ℹ️
   - v1 接口：`getBuildMeta`
   - v2 状态：无对应实现
   - **影响**：版本信息、构建时间等元数据缺失

## 兼容性考虑

### 数据格式差异

- v1 返回格式：`{ statusCode: 200, data: ... }`
- v2 返回格式：直接返回数据
- **影响**：前端需要适配不同的响应格式

### 分页参数差异

- v1：`page`、`pageSize`
- v2：可能使用不同的分页参数命名
- **影响**：分页逻辑需要重新适配

### 错误处理差异

- v1：可能吞没错误或返回特定格式
- v2：使用标准 HTTP 状态码和 NestJS 异常
- **影响**：错误处理逻辑需要更新

## 建议

### 立即需要实现的功能

1. **自定义页面控制器** - 如果前端使用此功能
2. **文章 pathname 支持** - 对 SEO 和用户体验至关重要
3. **时间线功能** - 如果是核心特性

### 可选实现的功能

1. **文章密码验证** - 根据是否有私密文章需求决定
2. **访客统计公开接口** - 可复用现有分析模块
3. **统一选项接口** - 可在前端聚合多个 v2 接口调用

### 不建议实现的功能

1. **构建元数据** - 可通过其他方式获取版本信息
2. **v1 格式兼容** - 应该让前端适配 v2 格式

## 迁移策略

1. **阶段1**：移除 v1 API，添加废弃警告
2. **阶段2**：评估实际使用情况，决定是否实现缺失功能
3. **阶段3**：提供前端迁移指南和工具

---

**最后更新**: 2024-01-20  
**分析版本**: v2.0.0
