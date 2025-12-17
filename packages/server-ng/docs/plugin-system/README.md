# VanBlog Plugin System - 开发指南

**最后更新**: 2025-12-14
**版本**: Plugin API v2.0
**状态**: Production Ready

---

## 📚 文档索引

### 核心文档

- **[API 完整参考](./api-reference.md)** - Plugin API v2.0 完整接口说明
- **[快速开始](./quick-start.md)** - 5 分钟创建第一个插件
- **[最佳实践](./best-practices.md)** - 插件开发最佳实践
- **[迁移指南](./migration-v1-to-v2.md)** - 从 v1.0 迁移到 v2.0

### 进阶主题

- **[数据库访问](./database-access.md)** - Drizzle ORM + 动态表创建
- **[HTTP 路由](./http-routing.md)** - 原始路由 + ts-rest 契约
- **[依赖注入](./dependency-injection.md)** - NestJS DI + 跨插件服务
- **[元数据系统](./metadata-system.md)** - WordPress 风格的实体元数据
- **[声明式资源](./declarative-resources.md)** - 自动 CRUD API 生成

### 示例与教程

- **[完整示例：图书管理](../../../plugins/book-manager-plugin/README.md)** - 500+ 行完整插件
- **[示例集合](./examples/)** - 各种功能的代码片段
- **[常见问题](./faq.md)** - FAQ 与故障排除

---

## 🚀 快速开始

### 安装

插件系统已内置在 VanBlog server-ng 中，无需额外安装。

### 创建第一个插件

```typescript
import type { PluginAPI } from '@vanblog/shared/plugin';

export default (api: PluginAPI) => {
  // 日志
  api.log.info(`Hello from ${api.name}!`);

  // Hook - 修改文章
  api.filter('article.beforeCreate', (article) => {
    return { ...article, views: 0 };
  });

  // Shortcode
  api.shortcode('hello', async (attrs) => {
    return `<div>Hello ${attrs.name}!</div>`;
  });

  // HTTP 路由
  api.http.get('/hello', (req, res) => {
    res.json({ message: 'Hello World!' });
  });
};
```

保存为 `plugins/my-plugin/index.ts`，重启服务器即可！

---

## 🎯 核心概念

### 1. Plugin API v2.0

v2.0 是完全重新设计的插件系统，充分利用 NestJS 生态：

**核心特性**：
- ✅ **数据库访问** - 直接使用 Drizzle ORM + 动态表创建
- ✅ **依赖注入** - NestJS DI + 跨插件服务注入
- ✅ **HTTP 路由** - 原始路由 + ts-rest 类型安全契约
- ✅ **元数据系统** - 为任何实体存储自定义数据
- ✅ **声明式资源** - 自动生成完整的 CRUD API
- ✅ **向后兼容** - 保留所有 v1.0 功能

### 2. 插件结构

```
plugins/
└── my-plugin/
    ├── index.ts          # 插件入口（必需）
    ├── package.json      # 插件元数据（推荐）
    ├── README.md         # 说明文档（推荐）
    └── *.spec.ts         # 单元测试（推荐）
```

### 3. 插件元数据（package.json）

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "vanblog": {
    "displayName": "我的插件",
    "config": {
      "enabled": {
        "type": "boolean",
        "default": true,
        "label": "启用插件"
      }
    }
  }
}
```

---

## 📖 核心 API 概览

### 元信息

```typescript
api.id          // 插件 ID
api.name        // 插件名称
api.version     // 插件版本
api.log         // 日志记录器
```

### 数据库访问

```typescript
// 直接访问数据库
api.db.select().from(api.coreTable('articles'))

// 创建插件专属表
const bookTable = api.table('books', BookSchema);
await api.db.insert(bookTable).values({ title: 'Book 1' });
```

### HTTP 路由

```typescript
// 原始路由
api.http.get('/books', handler);
api.http.post('/books', handler);

// ts-rest 契约
api.http.contract(contract, handlers);
```

### 依赖注入

```typescript
// 注入核心服务
const configService = api.inject(ConfigService);

// 提供服务给其他插件
api.provideService(MyService);

// 跨插件注入
const service = api.inject(BookService, 'book-plugin');
```

### 元数据系统

```typescript
// 注册 Schema
api.meta.register('article', 'reading-time', ReadingTimeSchema);

// 存储元数据
await api.meta.set('article', 123, 'reading-time', { minutes: 5 });

// 读取元数据
const data = await api.meta.get('article', 123, 'reading-time');
```

### 声明式资源

```typescript
// 自动生成 CRUD API
api.registerResource('books', {
  schema: BookSchema,
  hooks: {
    beforeCreate: async (book) => book,
    afterCreate: async (book) => {},
  },
});
// 自动生成：GET /books, GET /books/:id, POST /books, PATCH /books/:id, DELETE /books/:id
```

### Hook 系统

```typescript
// Filter - 修改数据
api.filter('article.beforeCreate', (article) => {
  return { ...article, processedBy: 'my-plugin' };
});

// Action - 副作用
api.action('article.afterCreate', async (article) => {
  await sendNotification(article);
});
```

### Shortcode

```typescript
api.shortcode('book', async (attrs) => {
  const book = await findBook(attrs.id);
  return `<div>${book.title}</div>`;
});
```

### 配置管理

```typescript
// 读取配置
const maxBooks = api.config.get('max_books', 100);

// 监听配置变化
api.onConfigChange(async (newConfig) => {
  await reloadCache();
});
```

### 生命周期

```typescript
api.onActivate(async () => {
  api.log.info('Plugin activated');
});

api.onDeactivate(async () => {
  api.log.info('Plugin deactivating');
});
```

---

## 🎓 设计理念与经验教训

### v2.0 设计原则

1. **充分利用 NestJS** - DI、模块化、装饰器
2. **类型安全优先** - TypeScript + Zod + ts-rest
3. **声明式配置** - 减少样板代码
4. **向后兼容** - 保留 v1.0 所有功能
5. **生产就绪** - 性能、安全、可测试

### 从 v1.0 到 v2.0 的演进

#### v1.0 的问题
- ❌ 缺少数据库访问能力
- ❌ 无法提供 HTTP 端点
- ❌ 没有依赖注入
- ❌ 插件间通信困难

#### v2.0 的改进
- ✅ 完整的数据库访问（Drizzle ORM）
- ✅ 灵活的 HTTP 路由（原始 + ts-rest）
- ✅ 强大的依赖注入（NestJS + 跨插件）
- ✅ 类型安全的插件间通信
- ✅ 自动化 CRUD 生成
- ✅ WordPress 风格的元数据系统

### 关键经验教训

1. **不要放弃框架优势** - 最初的函数式 API 设计虽然简洁，但放弃了 NestJS 的 DI 和 HTTP 能力
2. **类型安全很重要** - Zod + ts-rest 组合提供了出色的类型推导和运行时验证
3. **自动化优于手动** - 声明式资源注册大幅减少重复代码
4. **向后兼容是关键** - 渐进式迁移让用户可以按自己的节奏升级

---

## 🔗 相关资源

### 官方文档
- [NestJS 文档](https://nestjs.com/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [ts-rest 文档](https://ts-rest.com/)
- [Zod 文档](https://zod.dev/)

### 内部文档
- [server-ng CLAUDE.md](../../CLAUDE.md) - 服务器架构文档
- [shared CLAUDE.md](../../../shared/CLAUDE.md) - 类型系统文档

### 示例代码
- [book-manager-plugin](../../../plugins/book-manager-plugin/) - 完整示例
- [内置插件](../../../plugins/) - RSS、Rewards、Email 等

---

## 💡 获取帮助

### 常见问题

查看 [FAQ](./faq.md) 获取常见问题解答。

### 问题反馈

如遇问题：
1. 查看相关文档和示例代码
2. 检查测试文件中的用法
3. 查看 JSDoc 接口文档

### 贡献

欢迎贡献代码、文档或示例！

---

**祝你开发愉快！** 🚀
