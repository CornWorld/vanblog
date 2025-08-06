# VanBlog 插件系统

这个目录包含 VanBlog 的插件系统。插件系统支持两种类型的插件：

1. **代码片段插件** - 通过数据库存储的 JavaScript 代码片段
2. **文件插件** - 存储在 `src/plugins` 目录中的独立插件模块

## 文件插件结构

每个插件应该放在自己的目录中，目录结构如下：

```
src/plugins/
├── example-plugin/
│   ├── plugin.json          # 插件清单文件（可选）
│   └── index.mjs            # 插件主文件
└── another-plugin/
    ├── plugin.json
    └── index.js
```

### 插件清单文件 (plugin.json)

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "插件描述",
  "main": "index.mjs",
  "dependencies": [],
  "hooks": {
    "article:beforeCreate": {
      "type": "filter",
      "priority": 10
    },
    "article:afterCreate": {
      "type": "action",
      "priority": 10
    }
  }
}
```

### 插件主文件

插件主文件应该导出一个包含以下属性的对象：

```javascript
export default {
  name: 'example-plugin',
  version: '1.0.0',
  description: '插件描述',

  // 插件初始化（可选）
  async init(context) {
    // 插件初始化逻辑
    context.logger.log('插件初始化');
  },

  // 插件销毁（可选）
  async destroy(context) {
    // 插件清理逻辑
    context.logger.log('插件销毁');
  },

  // 插件钩子（可选）
  hooks: {
    'article:beforeCreate': {
      type: 'filter',
      priority: 10,
      async handler(data, context) {
        // 过滤器逻辑
        return data;
      },
    },
    'article:afterCreate': {
      type: 'action',
      priority: 10,
      async handler(data, context) {
        // 动作逻辑
      },
    },
  },
};
```

## 插件上下文 (PluginContext)

每个插件都会收到一个上下文对象，提供以下功能：

### 数据存储 (context.data)

```javascript
// 存储数据
await context.data.set('key', 'value');

// 获取数据
const value = await context.data.get('key');

// 检查数据是否存在
const exists = await context.data.has('key');

// 删除数据
await context.data.delete('key');

// 清空所有数据
await context.data.clear();

// 获取所有键
const keys = await context.data.keys();
```

### 配置读取 (context.config)

```javascript
// 获取配置值
const value = context.config.get('api_key');

// 获取配置值，带默认值
const value = context.config.get('api_key', 'default-value');

// 获取必需的配置值（不存在时抛出错误）
const value = context.config.getOrThrow('api_key');

// 检查配置是否存在
const exists = context.config.has('api_key');
```

配置通过环境变量提供，格式为：`PLUGIN_{PLUGIN_NAME}_{CONFIG_KEY}`

例如：`PLUGIN_EXAMPLE-PLUGIN_API_KEY=your-api-key`

### 日志记录 (context.logger)

```javascript
context.logger.log('信息日志');
context.logger.error('错误日志');
context.logger.warn('警告日志');
context.logger.debug('调试日志');
context.logger.verbose('详细日志');
```

## 钩子系统

插件可以注册钩子来响应系统事件。有两种类型的钩子：

### 动作钩子 (Actions)

动作钩子在特定事件发生时执行，不返回值。

```javascript
hooks: {
  'article:afterCreate': {
    type: 'action',
    priority: 10,
    async handler(article, context) {
      // 文章创建后的处理逻辑
      context.logger.log(`文章已创建: ${article.title}`);
    }
  }
}
```

### 过滤器钩子 (Filters)

过滤器钩子可以修改传递的数据。

```javascript
hooks: {
  'article:beforeCreate': {
    type: 'filter',
    priority: 10,
    async handler(articleData, context) {
      // 修改文章数据
      articleData.title = `[插件] ${articleData.title}`;
      return articleData;
    }
  }
}
```

### 优先级

钩子按优先级执行，数字越小优先级越高。默认优先级为 10。

## 可用的钩子

### 文章相关

- `article:beforeCreate` (filter) - 文章创建前
- `article:afterCreate` (action) - 文章创建后
- `article:beforeUpdate` (filter) - 文章更新前
- `article:afterUpdate` (action) - 文章更新后
- `article:beforeDelete` (action) - 文章删除前
- `article:afterDelete` (action) - 文章删除后

### 用户相关

- `user:beforeLogin` (filter) - 用户登录前
- `user:afterLogin` (action) - 用户登录后
- `user:beforeLogout` (action) - 用户登出前
- `user:afterLogout` (action) - 用户登出后

### 系统相关

- `system:startup` (action) - 系统启动时
- `system:shutdown` (action) - 系统关闭时

## API 端点

插件系统提供以下 API 端点：

- `GET /api/v2/plugins` - 获取所有已加载的插件
- `GET /api/v2/plugins/:name` - 获取特定插件的详细信息
- `POST /api/v2/plugins/reload` - 重新加载所有插件
- `DELETE /api/v2/plugins/:name` - 卸载特定插件

## 开发建议

1. **使用 ESM 格式** - 推荐使用 `.mjs` 扩展名和 ES 模块语法
2. **错误处理** - 在插件代码中添加适当的错误处理
3. **异步操作** - 使用 `async/await` 处理异步操作
4. **资源清理** - 在 `destroy` 方法中清理资源
5. **配置验证** - 验证必需的配置项
6. **日志记录** - 使用提供的日志记录器记录重要事件

## 示例插件

查看 `example-plugin` 目录中的示例插件，了解如何创建一个完整的插件。
