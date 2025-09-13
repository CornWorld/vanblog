# RSS Plugin for VanBlog

RSS 订阅插件为 VanBlog 提供完整的 RSS/Atom/JSON Feed 支持。

## 功能特性

- ✅ 支持 RSS 2.0、Atom 1.0、JSON Feed 1.0 三种格式
- ✅ 自动监听文章变化，智能重建订阅源
- ✅ 防抖机制避免频繁重建
- ✅ 支持自定义配置（文章数量、样式等）
- ✅ 支持加密文章的安全处理
- ✅ 完整的 Markdown 渲染支持

## 安装与启用

此插件已内置于 VanBlog Server-NG 中，默认自动加载。

## 配置选项

```typescript
interface RssPluginConfig {
  debounceTime: number; // 防抖时间（毫秒），默认 180000 (3分钟)
  includeFullContent: boolean; // 是否包含完整内容，默认 true
  maxItems: number; // 最大文章数量，默认 50
  customStyles: boolean; // 是否包含自定义样式，默认 true
}
```

## API 端点

### 公开端点（无需认证）

- `GET /rss/feed.xml` - RSS 2.0 格式订阅源
- `GET /rss/feed.json` - JSON Feed 格式订阅源
- `GET /rss/atom.xml` - Atom 1.0 格式订阅源

### 管理端点（需要管理员权限）

- `POST /api/v2/admin/rss/regenerate` - 手动触发 RSS 重新生成

## 自动触发机制

插件会在以下情况自动重新生成 RSS：

1. 文章创建/更新/删除
2. 站点信息更新（站点名称、描述、作者等）
3. 插件启动时

所有自动触发都有防抖保护，避免短时间内多次重建。

## 扩展性

### 使用 Hook 自定义 RSS 内容

```typescript
// 在其他插件中监听 RSS 生成前的钩子
hookService.addAction('rss|beforeGenerate', ({ feed, articles, siteInfo }) => {
  // 修改 feed 对象，添加自定义内容
  feed.addCategory('Technology');
});

// 监听 RSS 生成完成
hookService.addAction('rss|afterGenerate', ({ rssPath, files }) => {
  console.log('RSS files generated:', files);
});
```

### 在 Bootstrap 响应中获取 RSS 信息

RSS 插件会自动在 bootstrap 响应的 `extensions` 字段中添加信息：

```json
{
  "extensions": {
    "rss": {
      "enabled": true,
      "feeds": {
        "rss2": "/rss/feed.xml",
        "atom": "/rss/atom.xml",
        "json": "/rss/feed.json"
      }
    }
  }
}
```

## 开发指南

### 项目结构

```
rss-plugin/
├── index.ts           # 插件主入口
├── rss.service.ts     # RSS 生成服务
├── rss.controller.ts  # HTTP 控制器
├── index.spec.ts      # 单元测试
├── package.json       # 依赖配置
└── README.md          # 本文档
```

### 测试

```bash
# 运行插件测试
pnpm test plugins/rss-plugin/index.spec.ts
```

## 从核心模块迁移

如果您之前使用的是核心模块中的 RSS 功能，迁移到插件版本是透明的：

1. 所有 URL 保持不变
2. 功能完全兼容
3. 配置通过插件 API 管理

## 故障排除

### RSS 文件未生成

1. 检查日志中是否有错误信息
2. 确认 `STATIC_PATH` 环境变量设置正确
3. 检查文件系统权限

### 订阅源返回 503 错误

这表示 RSS 正在生成中，稍后重试即可。

## License

MIT
