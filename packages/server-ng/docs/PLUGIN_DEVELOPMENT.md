# VanBlog 插件开发指南

> **⚠️ 文档状态**: 本文档基于 v1.0 Plugin API，正在更新以支持 v2.0 增强设计。
>
> **v2.0 新特性**（开发中）：
> - ✅ 数据库访问（`api.db`）
> - ✅ 依赖注入（`api.inject()`）
> - ✅ HTTP 路由注册（`api.http`）
> - ✅ 声明式资源注册（学习 WordPress）
> - ✅ 插件间通信（`api.exposeAPI()`）
>
> **v1.0 功能仍然完全支持**（向后兼容）。
>
> 详见：[增强插件系统设计方案](../../../.claude/plan/增强插件系统设计方案.md)

---

## 目录

- [快速开始](#快速开始)
- [插件结构](#插件结构)
- [Plugin API 参考](#plugin-api-参考)
- [Hook 系统](#hook-系统)
- [Shortcode 系统](#shortcode-系统)
- [配置系统](#配置系统)
- [公共数据系统](#公共数据系统)
- [响应式存储](#响应式存储)
- [生命周期钩子](#生命周期钩子)
- [测试](#测试)
- [最佳实践](#最佳实践)
- [完整示例](#完整示例)
- [复杂插件开发](#复杂插件开发)

---

## 快速开始

### 创建新插件

使用脚手架 CLI 快速创建插件：

```bash
pnpm plugin:create my-awesome-plugin
```

CLI 会提示你输入：
- 插件名称（kebab-case，如 `my-plugin`）
- 插件描述
- 作者
- 版本号

### 插件位置

所有插件位于 `packages/server-ng/plugins/` 目录：

```
packages/server-ng/plugins/
├── my-plugin/
│   ├── package.json      # 插件元数据和配置 schema
│   ├── index.ts          # 插件主文件
│   ├── index.spec.ts     # 单元测试
│   └── README.md         # 文档
```

### 最小插件示例

```typescript
// plugins/my-plugin/index.ts
import type { PluginAPI } from '@vanblog/shared/plugin';

export default (api: PluginAPI) => {
  api.log.info('My Plugin loaded!');

  // 你的插件逻辑
};
```

---

## 插件结构

### package.json

插件的 `package.json` 包含元数据和配置 schema：

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "main": "index.ts",
  "type": "module",
  "private": true,
  "keywords": ["vanblog", "plugin"],
  "author": "Your Name",
  "license": "MIT",
  "vanblog": {
    "displayName": "My Plugin",
    "config": {
      "enabled": {
        "type": "boolean",
        "default": true,
        "title": "启用插件",
        "description": "是否启用此插件"
      },
      "apiKey": {
        "type": "string",
        "default": "",
        "title": "API Key",
        "description": "第三方服务的 API Key"
      }
    }
  }
}
```

### 配置 Schema 字段类型

| 类型 | 描述 | 示例默认值 |
|------|------|-----------|
| `boolean` | 布尔值 | `true` |
| `string` | 字符串 | `"default value"` |
| `number` | 数字 | `42` |
| `array` | 数组 | `["item1", "item2"]` |
| `object` | 对象 | `{ "key": "value" }` |

### 配置字段属性

```typescript
interface PluginConfigField {
  type: 'boolean' | 'string' | 'number' | 'array' | 'object';
  default?: any;
  title?: string;           // 显示名称
  description?: string;     // 描述文本
  enum?: any[];             // 枚举值（用于下拉选择）
  minimum?: number;         // 最小值（number 类型）
  maximum?: number;         // 最大值（number 类型）
}
```

---

## Plugin API 参考

### 基础属性

```typescript
interface PluginAPI {
  // 插件标识
  id: string;           // 插件 ID（package.json 的 name）
  version: string;      // 插件版本
  dir: string;          // 插件目录绝对路径

  // 配置
  config: Record<string, unknown>;  // 当前配置（已合并 DB、ENV、默认值）

  // 日志
  log: Logger;

  // 核心方法
  filter: FilterMethod;
  action: ActionMethod;
  shortcode: ShortcodeMethod;
  provide: ProvideMethod;
  store: StoreMethod;

  // 生命周期
  onActivate: (callback: () => void | Promise<void>) => void;
  onDeactivate: (callback: () => void | Promise<void>) => void;
  onConfigChange: (key: string, callback: (newValue: unknown) => void) => void;
}
```

### Logger API

```typescript
interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

// 使用示例
api.log.info('Processing article:', article.title);
api.log.warn('Configuration missing:', key);
api.log.error('Failed to process:', error);
api.log.debug('Debug info:', { foo: 'bar' });
```

---

## Hook 系统

VanBlog 提供两种类型的 Hook：

### 1. Filter Hook（过滤器）

**用途**：修改数据后返回。

**签名**：
```typescript
api.filter(hookName: string, handler: (data: T) => T | Promise<T>): void;
```

**可用 Hook**：

| Hook 名称 | 触发时机 | 参数类型 | 返回类型 |
|-----------|---------|---------|---------|
| `article\|beforeCreate` | 文章创建前 | `Article` | `Article` |
| `article\|afterCreate` | 文章创建后（只读） | `Article` | `Article` |
| `article\|beforeUpdate` | 文章更新前 | `Article` | `Article` |
| `article\|afterUpdate` | 文章更新后（只读） | `Article` | `Article` |
| `article\|beforeDelete` | 文章删除前 | `{ id: number }` | `{ id: number }` |
| `markdown\|render` | Markdown 渲染前 | `string` | `string` |
| `content\|sanitize` | 内容清理 | `string` | `string` |

**示例**：

```typescript
// 自动为文章添加标签
api.filter('article|beforeCreate', (article) => {
  if (!article.tags) {
    article.tags = [];
  }
  article.tags.push('auto-tag');
  return article;
});

// Markdown 内容预处理
api.filter('markdown|render', (content) => {
  // 替换自定义标记
  return content.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
});
```

### 2. Action Hook（动作）

**用途**：执行副作用（发送通知、记录日志等），不返回值。

**签名**：
```typescript
api.action(hookName: string, handler: (data: T) => void | Promise<void>): void;
```

**可用 Hook**：

| Hook 名称 | 触发时机 | 参数类型 |
|-----------|---------|---------|
| `article\|afterCreate` | 文章创建后 | `Article` |
| `article\|afterUpdate` | 文章更新后 | `Article` |
| `article\|afterDelete` | 文章删除后 | `{ id: number }` |
| `comment\|afterCreate` | 评论创建后 | `Comment` |
| `server\|startup` | 服务器启动时 | `void` |
| `server\|shutdown` | 服务器关闭时 | `void` |

**示例**：

```typescript
// 文章发布通知
api.action('article|afterCreate', async (article) => {
  api.log.info('New article published:', article.title);

  // 发送通知到第三方服务
  await fetch('https://webhook.example.com', {
    method: 'POST',
    body: JSON.stringify({ title: article.title }),
  });
});

// 服务器启动时初始化
api.action('server|startup', async () => {
  api.log.info('Initializing plugin...');
  // 初始化逻辑
});
```

---

## Shortcode 系统

### 注册 Shortcode

**签名**：
```typescript
api.shortcode(
  name: string,
  handler: (attrs: Record<string, string>, content: string) => string
): void;
```

**参数**：
- `name`: Shortcode 名称
- `handler`: 处理函数
  - `attrs`: 属性对象
  - `content`: 标签内容
  - 返回值: HTML 字符串

### 示例

```typescript
// 注册简单 Shortcode
api.shortcode('highlight', (attrs, content) => {
  const color = attrs.color || 'yellow';
  return `<mark style="background-color: ${color}">${content}</mark>`;
});

// 使用（在文章中）：
// [highlight color="cyan"]重要内容[/highlight]
```

### 高级示例

```typescript
// 带多个属性的 Shortcode
api.shortcode('alert', (attrs, content) => {
  const type = attrs.type || 'info';
  const title = attrs.title || '';

  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅',
  };

  return `
    <div class="alert alert-${type}">
      ${title ? `<strong>${icons[type]} ${title}</strong>` : icons[type]}
      <div>${content}</div>
    </div>
  `;
});

// 使用：
// [alert type="warning" title="注意"]这是警告内容[/alert]
```

### 自闭合 Shortcode

```typescript
// 无内容的 Shortcode
api.shortcode('current-year', () => {
  return new Date().getFullYear().toString();
});

// 使用：
// 版权所有 © [current-year]
```

---

## 配置系统

### 读取配置

插件配置自动从以下来源合并（优先级从高到低）：

1. **数据库配置**（管理后台设置）
2. **环境变量**（`PLUGIN_插件名_配置项`）
3. **默认值**（package.json 中的 `default`）

```typescript
export default (api: PluginAPI) => {
  // 读取配置
  const enabled = api.config.enabled as boolean;
  const apiKey = api.config.apiKey as string;

  if (!enabled) {
    api.log.warn('Plugin is disabled');
    return;
  }

  api.log.info('API Key:', apiKey);
};
```

### 环境变量命名规则

配置项 `camelCase` 自动转换为 `SNAKE_CASE` 环境变量：

| 配置项 | 环境变量 |
|--------|---------|
| `enabled` | `PLUGIN_MY_PLUGIN_ENABLED` |
| `apiKey` | `PLUGIN_MY_PLUGIN_API_KEY` |
| `maxRetries` | `PLUGIN_MY_PLUGIN_MAX_RETRIES` |

**环境变量示例**：

```bash
# .env
PLUGIN_MY_PLUGIN_ENABLED=true
PLUGIN_MY_PLUGIN_API_KEY=sk-xxxxx
PLUGIN_MY_PLUGIN_MAX_RETRIES=3
```

### 配置变更监听

```typescript
api.onConfigChange('apiKey', (newValue) => {
  api.log.info('API Key changed:', newValue);
  // 重新初始化
});

// 监听多个配置
['enabled', 'apiKey'].forEach(key => {
  api.onConfigChange(key, (newValue) => {
    api.log.info(`${key} changed to:`, newValue);
  });
});
```

---

## 公共数据系统

### 暴露数据给前端

使用 `api.provide()` 将数据暴露到 Bootstrap API (`/api/v2/public/bootstrap`)：

```typescript
api.provide('myData', {
  title: 'Hello',
  items: [1, 2, 3],
});

// 或使用函数（支持异步）
api.provide('dynamicData', async () => {
  const data = await fetchFromAPI();
  return data;
});
```

### 前端使用

在 React 组件中使用 `usePluginData` Hook：

```tsx
import { usePluginData } from '@/hooks/usePluginData';

function MyComponent() {
  const { data, loading, error } = usePluginData<{
    title: string;
    items: number[];
  }>('myData');

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h2>{data.title}</h2>
      <ul>
        {data.items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
```

### Bootstrap API 响应格式

```json
{
  "statusCode": 200,
  "data": {
    "version": "1.0.0",
    "extensions": {
      "myData": {
        "version": "1.0.0",
        "data": {
          "title": "Hello",
          "items": [1, 2, 3]
        }
      }
    }
  }
}
```

---

## 响应式存储

### 创建响应式状态

```typescript
// 创建存储
const counter = api.store('counter', 0);

// 读取值
console.log(counter.value); // 0

// 修改值
counter.value = 1;
console.log(counter.value); // 1

// 复杂类型
const userSettings = api.store('settings', {
  theme: 'dark',
  language: 'zh-CN',
});

userSettings.value.theme = 'light';
```

### 与配置结合使用

```typescript
// 从配置初始化存储
const maxItems = api.store('maxItems', api.config.maxItems as number);

// 配置变更时更新存储
api.onConfigChange('maxItems', (newValue) => {
  maxItems.value = newValue as number;
});
```

### 持久化存储

存储数据自动保存到数据库的 `plugin_data` 表：

```typescript
const cache = api.store<string[]>('cache', []);

// 数据会自动持久化
cache.value.push('new-item');

// 服务器重启后数据仍然存在
```

---

## 生命周期钩子

### onActivate（激活）

插件加载完成时调用：

```typescript
api.onActivate(async () => {
  api.log.info('Plugin activated');

  // 初始化数据库
  await initDatabase();

  // 启动定时任务
  startCronJob();
});
```

### onDeactivate（停用）

插件卸载时调用（用于清理资源）：

```typescript
api.onDeactivate(async () => {
  api.log.info('Plugin deactivated');

  // 停止定时任务
  stopCronJob();

  // 关闭数据库连接
  await closeDatabase();
});
```

### onConfigChange（配置变更）

配置更新时调用：

```typescript
api.onConfigChange('enabled', (newValue) => {
  if (newValue === false) {
    api.log.warn('Plugin disabled by config');
    // 停止相关功能
  } else {
    api.log.info('Plugin enabled by config');
    // 重新启动功能
  }
});
```

---

## 测试

### 单元测试模板

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginAPI } from '@vanblog/shared/plugin';
import plugin from './index';

describe('My Plugin', () => {
  let mockAPI: Partial<PluginAPI>;

  beforeEach(() => {
    mockAPI = {
      id: 'my-plugin',
      version: '1.0.0',
      dir: '/path/to/plugin',
      config: { enabled: true },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
      filter: vi.fn(),
      action: vi.fn(),
      shortcode: vi.fn(),
      provide: vi.fn(),
      store: vi.fn((key, defaultValue) => ({ value: defaultValue })),
      onActivate: vi.fn(),
      onDeactivate: vi.fn(),
      onConfigChange: vi.fn(),
    };
  });

  it('should load plugin successfully', () => {
    expect(() => plugin(mockAPI as PluginAPI)).not.toThrow();
  });

  it('should register hooks when enabled', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).toHaveBeenCalledWith(
      'article|beforeCreate',
      expect.any(Function)
    );
  });

  it('should not register hooks when disabled', () => {
    mockAPI.config = { enabled: false };
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).not.toHaveBeenCalled();
  });
});
```

### 运行测试

```bash
# 测试单个插件
pnpm --filter @vanblog/server-ng test -- plugins/my-plugin

# 测试所有插件
pnpm --filter @vanblog/server-ng test -- plugins

# 覆盖率报告
pnpm --filter @vanblog/server-ng test:cov
```

---

## 最佳实践

### 1. 错误处理

```typescript
api.filter('article|beforeCreate', async (article) => {
  try {
    // 可能失败的操作
    const processed = await processArticle(article);
    return processed;
  } catch (error) {
    api.log.error('Failed to process article:', error);
    // 返回原始数据，不阻止流程
    return article;
  }
});
```

### 2. 性能优化

```typescript
// 缓存昂贵的计算结果
const cache = api.store<Map<string, any>>('cache', new Map());

api.filter('markdown|render', (content) => {
  const hash = hashContent(content);

  if (cache.value.has(hash)) {
    return cache.value.get(hash);
  }

  const result = expensiveTransform(content);
  cache.value.set(hash, result);
  return result;
});
```

### 3. 配置验证

```typescript
export default (api: PluginAPI) => {
  const apiKey = api.config.apiKey as string;

  if (!apiKey) {
    api.log.error('API Key is required!');
    return; // 停止插件加载
  }

  // 继续初始化
};
```

### 4. 异步操作

```typescript
api.action('article|afterCreate', async (article) => {
  // 使用 Promise.all 并行执行
  await Promise.all([
    sendNotification(article),
    updateIndex(article),
    syncToCloud(article),
  ]);
});
```

### 5. 资源清理

```typescript
let intervalId: NodeJS.Timeout | null = null;

api.onActivate(() => {
  // 启动定时任务
  intervalId = setInterval(() => {
    api.log.debug('Periodic task running');
  }, 60000);
});

api.onDeactivate(() => {
  // 清理定时任务
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
```

---

## 完整示例

### 示例：文章统计插件

```typescript
// plugins/article-stats-plugin/index.ts
import type { PluginAPI } from '@vanblog/shared/plugin';

interface ArticleStats {
  totalArticles: number;
  totalWords: number;
  averageWords: number;
  lastUpdate: string;
}

export default (api: PluginAPI) => {
  // 配置
  const enabled = api.config.enabled as boolean;
  if (!enabled) return;

  // 存储
  const stats = api.store<ArticleStats>('stats', {
    totalArticles: 0,
    totalWords: 0,
    averageWords: 0,
    lastUpdate: new Date().toISOString(),
  });

  // 计算字数
  const countWords = (content: string): number => {
    return content.replace(/\s+/g, '').length;
  };

  // 更新统计
  const updateStats = (wordCount: number, isNew: boolean) => {
    if (isNew) {
      stats.value.totalArticles += 1;
    }
    stats.value.totalWords += wordCount;
    stats.value.averageWords = Math.round(
      stats.value.totalWords / stats.value.totalArticles
    );
    stats.value.lastUpdate = new Date().toISOString();
  };

  // 文章创建时
  api.action('article|afterCreate', (article) => {
    const wordCount = countWords(article.content);
    updateStats(wordCount, true);
    api.log.info(`Article created: ${wordCount} words`);
  });

  // 文章更新时
  api.action('article|afterUpdate', (article) => {
    const wordCount = countWords(article.content);
    updateStats(wordCount, false);
    api.log.info(`Article updated: ${wordCount} words`);
  });

  // 暴露统计数据给前端
  api.provide('articleStats', () => stats.value);

  // Shortcode：显示统计信息
  api.shortcode('stats', () => {
    return `
      <div class="article-stats">
        <p>📊 博客统计</p>
        <ul>
          <li>总文章数: ${stats.value.totalArticles}</li>
          <li>总字数: ${stats.value.totalWords.toLocaleString()}</li>
          <li>平均字数: ${stats.value.averageWords.toLocaleString()}</li>
        </ul>
      </div>
    `;
  });

  // 生命周期
  api.onActivate(() => {
    api.log.info('Article Stats Plugin activated');
  });

  api.onDeactivate(() => {
    api.log.info('Article Stats Plugin deactivated');
  });
};
```

### package.json

```json
{
  "name": "article-stats-plugin",
  "version": "1.0.0",
  "description": "Article statistics plugin",
  "main": "index.ts",
  "type": "module",
  "private": true,
  "keywords": ["vanblog", "plugin", "stats"],
  "author": "Your Name",
  "license": "MIT",
  "vanblog": {
    "displayName": "Article Statistics",
    "config": {
      "enabled": {
        "type": "boolean",
        "default": true,
        "title": "启用插件",
        "description": "是否启用文章统计功能"
      }
    }
  }
}
```

### 前端使用

```tsx
import { usePluginData } from '@/hooks/usePluginData';

interface ArticleStats {
  totalArticles: number;
  totalWords: number;
  averageWords: number;
  lastUpdate: string;
}

function StatsWidget() {
  const { data, loading } = usePluginData<ArticleStats>('articleStats');

  if (loading || !data) return null;

  return (
    <div className="stats-widget">
      <h3>博客统计</h3>
      <div className="stats-grid">
        <div className="stat">
          <span className="label">文章总数</span>
          <span className="value">{data.totalArticles}</span>
        </div>
        <div className="stat">
          <span className="label">总字数</span>
          <span className="value">{data.totalWords.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">平均字数</span>
          <span className="value">{data.averageWords.toLocaleString()}</span>
        </div>
      </div>
      <small>最后更新: {new Date(data.lastUpdate).toLocaleString()}</small>
    </div>
  );
}
```

---

## 调试技巧

### 1. 日志级别

```typescript
// 开发环境使用 debug
if (process.env.NODE_ENV === 'development') {
  api.log.debug('Debug info:', { data });
}

// 生产环境使用 info/warn/error
api.log.info('Important info');
api.log.warn('Warning');
api.log.error('Error occurred');
```

### 2. 检查插件加载

```bash
# 查看服务器日志
pnpm dev:server

# 输出示例：
# [PluginLoader] Loading plugin: my-plugin
# [my-plugin] My Plugin loaded!
```

### 3. 测试配置

```bash
# 通过环境变量测试
PLUGIN_MY_PLUGIN_ENABLED=false pnpm dev:server
```

---

## 常见问题

### Q1: 插件没有加载？

检查：
1. 插件目录是否在 `packages/server-ng/plugins/`
2. `package.json` 的 `main` 字段是否正确
3. 是否有语法错误（查看服务器日志）

### Q2: 配置不生效？

检查：
1. `package.json` 的 `vanblog.config` 是否正确
2. 环境变量命名是否正确
3. 数据库配置是否已保存

### Q3: Hook 没有触发？

检查：
1. Hook 名称拼写是否正确
2. 是否在正确的时机注册（不要在异步回调中注册）
3. Handler 函数是否正确返回数据（Filter Hook）

### Q4: 前端拿不到数据？

检查：
1. `api.provide()` 是否正确调用
2. Bootstrap API (`/api/v2/public/bootstrap`) 是否包含数据
3. `usePluginData` 的插件名称是否正确

---

## 复杂插件开发

### 什么是复杂插件？

如果你的插件需要以下特性，则属于**复杂插件**：

- ✅ 注册 HTTP 路由（如 `/api/my-plugin/*`）
- ✅ 使用 NestJS Controller/Service 架构
- ✅ 使用 NestJS 依赖注入系统
- ✅ 与数据库深度集成

### 复杂插件应使用对象式接口

对于复杂插件，**请继续使用对象式插件接口**，而不是函数式 API。

**对象式插件示例**:

```typescript
import { Logger } from '@nestjs/common';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';

const logger = new Logger('my-complex-plugin');

const plugin: Plugin = {
  id: 'my-complex-plugin',
  name: 'My Complex Plugin',
  version: '1.0.0',

  async init(context: PluginContext): Promise<void> {
    logger.log('Plugin initializing...');
    // 初始化逻辑
  },

  async destroy(context: PluginContext): Promise<void> {
    logger.log('Plugin destroyed');
    // 清理逻辑
  },

  hooks: {
    'article|afterCreate': {
      type: 'action',
      priority: 10,
      handler: async (article, context) => {
        // 处理逻辑
      },
    },
  },
};

export default plugin;
```

### 为什么不推荐迁移复杂插件？

函数式 Plugin API 设计目标是简化**轻量级插件**的开发。对于包含 Controller/Service 的复杂插件：

1. ❌ 函数式 API **不支持** HTTP 路由注册
2. ❌ 函数式 API **不支持** NestJS 依赖注入
3. ✅ 对象式接口**更适合**复杂业务逻辑

### 复杂插件示例

VanBlog 内置的复杂插件：
- **rss-plugin** - RSS 订阅生成（包含 Controller）
- **rewards-plugin** - 打赏管理（包含 Controller + Service + Contract）

### 详细迁移指南

如果你需要在复杂插件中使用函数式 Hook，或者想了解混合模式，请参阅：

📖 **[复杂插件迁移指南](./PLUGIN_MIGRATION_COMPLEX.md)**

该指南包含：
- 复杂插件识别方法
- 迁移策略对比（保留现状 vs 混合模式）
- 混合模式实现示例
- 迁移检查清单

---

## 更多资源

- [Plugin API 类型定义](../../../shared/src/plugin/plugin-api.interface.ts)
- [示例插件](../plugins/)
- [公共数据系统指南](../../../.tmp/plugin-public-data-guide.md)
- [测试指南](./TESTING.md)

---

**祝你开发愉快！** 🎉

如有问题，请提交 Issue 或查看社区讨论。
