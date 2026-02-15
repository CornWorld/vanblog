# E2E API Walk - Walk all server-ng APIs via admin DOM operations

## Requirements

- 通过admin前端DOM操作，walk所有server-ng的API端点
- 验证每个API的可访问性和响应正确性
- 使用Chrome DevTools MCP进行自动化测试

## Acceptance Criteria

- [ ] 所有API端点被walked（通过admin UI触发）
- [ ] 记录每个API的响应状态（200/404/500等）
- [ ] 识别并记录任何失败的API
- [ ] 生成测试报告

## API Coverage List

### Auth Module

- POST /api/v2/auth/login - 用户登录
- POST /api/v2/auth/logout - 用户登出
- POST /api/v2/auth/refresh - 刷新Token

### Article Module

- GET /api/v2/articles - 获取文章列表
- GET /api/v2/articles/:id - 获取单个文章
- POST /api/v2/articles - 创建文章
- PUT /api/v2/articles/:id - 更新文章
- DELETE /api/v2/articles/:id - 删除文章
- GET /api/v2/articles/search - 搜索文章
- POST /api/v2/articles/:id/verifyPassword - 验证文章密码
- GET /api/v2/articles/export - 导出文章

### Draft Module

- GET /api/v2/drafts - 获取草稿列表
- GET /api/v2/drafts/:id - 获取单个草稿
- POST /api/v2/drafts - 创建草稿
- PUT /api/v2/drafts/:id - 更新草稿
- DELETE /api/vrafts/:id - 删除草稿
- POST /api/v2/drafts/:id/publish - 发布草稿

### Category Module

- GET /api/v2/categories - 获取分类列表
- GET /api/v2/categories/:id - 获取单个分类
- POST /api/v2/categories - 创建分类
- PUT /api/v2/categories/:id - 更新分类
- DELETE /api/v2/categories/:id - 删除分类
- GET /api/v2/categories/name/:name/articles - 按名称获取文章

### Tag Module

- GET /api/v2/tags - 获取标签列表
- GET /api/v2/tags/:id - 获取单个标签
- POST /api/v2/tags - 创建标签
- PUT /api/v2/tags/:id - 更新标签
- DELETE /api/v2/tags/:id - 删除标签
- GET /api/v2/tags/:id/articles - 获取标签下的文章

### Media Module

- GET /api/v2/media - 获取媒体列表
- POST /api/v2/media/upload - 上传媒体
- DELETE /api/v2/media/:id - 删除媒体
- GET /api/v2/media/statistics - 获取媒体统计

### User Module

- GET /api/v2/admin/users - 获取用户列表
- GET /api/v2/admin/users/:id - 获取单个用户
- POST /api/v2/admin/users - 创建用户
- PUT /api/v2/admin/users/:id - 更新用户
- DELETE /api/v2/admin/users/:id - 删除用户
- GET /api/v2/admin/users/collaborators - 获取协作者列表

### Settings Module

- GET /api/v2/admin/settings/site - 获取站点设置
- PUT /api/v2/admin/settings/site - 更新站点设置
- GET /api/v2/admin/seo - 获取SEO设置
- PUT /api/v2/admin/seo - 更新SEO设置
- GET /api/v2/admin/comment - 获取评论设置
- PUT /api/v2/admin/comment - 更新评论设置

### Backup Module

- GET /api/v2/admin/backup/list - 获取备份列表
- POST /api/v2/admin/backup/create - 创建备份
- POST /api/v2/admin/backup/restore - 恢复备份

### Pipeline Module

- GET /api/v2/pipelines - 获取管道列表
- GET /api/v2/pipelines/:id - 获取单个管道
- POST /api/v2/pipelines - 创建管道
- PUT /api/v2/pipelines/:id - 更新管道
- DELETE /api/v2/pipelines/:id - 删除管道
- POST /api/v2/pipelines/:id/trigger - 触发管道

### Plugin Module

- GET /api/v2/admin/plugins - 获取插件列表
- POST /api/v2/admin/plugins/reload - 重载插件
- GET /api/v2/admin/plugins/:name/config - 获取插件配置
- PUT /api/v2/admin/plugins/:name/config - 更新插件配置

## Testing Approach

1. 启动admin前端 (http://localhost:3002)
2. 启动server-ng后端 (http://localhost:3050)
3. 使用Chrome DevTools MCP导航到admin页面
4. 通过DOM操作登录
5. 系统性地导航到每个功能页面
6. 观察Network面板的API调用
7. 记录结果

## Deliverables

- 测试报告（包含每个API的状态）
- 失败API列表（如有）
