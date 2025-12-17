# Reading Time Plugin

估算文章阅读时长并在文章中显示的插件。

## 功能特性

- ✅ 自动计算文章阅读时长
- ✅ 支持中英文混排内容
- ✅ 可配置阅读速度（字/分钟）
- ✅ 自动在文章中显示阅读时长（可选）
- ✅ 提供统计数据（最短/最长/平均阅读时长）
- ✅ Shortcode 支持（可自定义格式）
- ✅ 前端数据 API

## 配置选项

在管理后台的"系统设置 → 插件"中配置：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enabled` | boolean | true | 是否启用插件 |
| `wordsPerMinute` | number | 200 | 每分钟阅读字数（中文建议 200-300） |
| `showInArticle` | boolean | true | 是否在文章内容中自动显示阅读时长 |

### 环境变量配置

```bash
PLUGIN_READ_TIME_PLUGIN_ENABLED=true
PLUGIN_READ_TIME_PLUGIN_WORDS_PER_MINUTE=250
PLUGIN_READ_TIME_PLUGIN_SHOW_IN_ARTICLE=true
```

## 使用方法

### 1. 自动显示（默认启用）

当 `showInArticle` 为 `true` 时，插件会自动在文章开头添加阅读时长：

```
---
📖 预计阅读时长：**5 分钟**
---

文章内容...
```

### 2. Shortcode 手动显示

在文章中使用 `[read-time]` Shortcode：

```markdown
这篇文章大约需要 [read-time]这里填写文章内容用于计算[/read-time] 阅读完成。
```

**输出**：
```html
这篇文章大约需要 <span class="read-time">📖 3 分钟</span> 阅读完成。
```

**自定义 Shortcode**：

```markdown
<!-- 自定义 emoji -->
[read-time emoji="⏱️"]文章内容[/read-time]

<!-- 显示秒数 -->
[read-time format="seconds"]文章内容[/read-time]

<!-- 显示小时 -->
[read-time format="hours"]长文章内容[/read-time]
```

### 3. 前端获取数据

在 React 组件中使用：

```tsx
import { usePluginData } from '@/hooks/usePluginData';

interface ReadingTimeData {
  stats: {
    totalArticles: number;
    averageReadTime: number;
    shortestReadTime: number;
    longestReadTime: number;
  };
  config: {
    wordsPerMinute: number;
    showInArticle: boolean;
  };
}

function ReadingTimeStats() {
  const { data, loading } = usePluginData<ReadingTimeData>('readingTime');

  if (loading || !data) return null;

  return (
    <div className="reading-stats">
      <h3>博客阅读统计</h3>
      <ul>
        <li>总文章数: {data.stats.totalArticles}</li>
        <li>平均阅读时长: {data.stats.averageReadTime} 分钟</li>
        <li>最短阅读: {data.stats.shortestReadTime} 分钟</li>
        <li>最长阅读: {data.stats.longestReadTime} 分钟</li>
      </ul>
      <p>阅读速度: {data.config.wordsPerMinute} 字/分钟</p>
    </div>
  );
}
```

## 工作原理

### 阅读时长计算

1. **移除 Markdown 语法**：代码块、链接、图片等不计入阅读时长
2. **统计字数**：
   - 中文字符：每个字符算 1 个词
   - 英文单词：按空格分隔计数
3. **计算分钟数**：`总字数 / 每分钟阅读字数`
4. **最小值**：至少显示 1 分钟

### 示例计算

```
内容: "这是一篇测试文章。This is a test article."
中文字符: 9
英文单词: 5
总字数: 14
阅读速度: 200 字/分钟
阅读时长: Math.ceil(14 / 200) = 1 分钟
```

## 开发

### 运行测试

```bash
pnpm --filter @vanblog/server-ng test -- plugins/read-time-plugin
```

### 调试

在插件代码中使用日志：

```typescript
api.log.info('Reading time calculated:', readTime);
api.log.debug('Article content length:', content.length);
```

## 扩展建议

### 1. 持久化阅读时长

将计算结果存储到文章元数据：

```typescript
api.filter('article|beforeCreate', (article) => {
  const readTime = calculateReadingTime(article.content);
  article.metadata = {
    ...article.metadata,
    readingTime: readTime,
  };
  return article;
});
```

### 2. 区分代码和文本

为代码块设置不同的阅读速度：

```typescript
const codeWordsPerMinute = 100; // 代码阅读较慢
const textWordsPerMinute = 200;

const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
const codeWords = codeBlocks.reduce((sum, block) => {
  return sum + block.length;
}, 0);

const textWords = (content.length - codeWords);
const totalTime = (codeWords / codeWordsPerMinute) + (textWords / textWordsPerMinute);
```

### 3. 多语言支持

根据语言设置不同的阅读速度：

```typescript
const speeds = {
  'zh-CN': 200,
  'en-US': 250,
  'ja-JP': 300,
};

const language = detectLanguage(content);
const wpm = speeds[language] || 200;
```

## 相关资源

- [插件开发指南](../../docs/PLUGIN_DEVELOPMENT.md)
- [Plugin API 参考](../../docs/PLUGIN_API.md)
- [阅读时长研究](https://en.wikipedia.org/wiki/Words_per_minute)

## License

MIT
