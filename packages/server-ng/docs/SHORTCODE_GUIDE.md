# Shortcode 系统使用指南

**版本**: 1.0.0
**最后更新**: 2025-12-17

---

## 概述

Shortcode 是一种类似 WordPress 的内容扩展机制，允许在 Markdown 内容中嵌入动态功能。

**语法示例**：

```markdown
[gallery ids="1,2,3" columns="3" /]
[button url="https://example.com"]点击这里[/button]
```

---

## 语法规则

### 1. 自闭合标签

```markdown
[tag /]
[tag attr="value" /]
```

### 2. 包含内容

```markdown
[tag]content[/tag]
[tag attr="value"]content[/tag]
```

### 3. 属性规则

- 属性名：字母、数字、下划线、连字符
- 属性值：用双引号包裹
- 多个属性用空格分隔

---

## 插件中注册 Shortcode

### 函数式 API

```typescript
import type { PluginAPI } from '@vanblog/shared/plugin';

export default (api: PluginAPI) => {
  // 注册 shortcode
  api.shortcode('gallery', (attrs, content) => {
    const { ids, columns = '3' } = attrs;
    const imageIds = ids.split(',');

    return `
      <div class="gallery cols-${columns}">
        ${imageIds.map((id) => `<img src="/media/${id}" />`).join('')}
      </div>
    `;
  });
};
```

### 参数说明

```typescript
type ShortcodeHandler = (
  attrs: Record<string, string>, // 属性对象
  content: string, // 标签内容
  context: ShortcodeContext, // 上下文信息
) => string | Promise<string>; // 返回 HTML
```

**Context 包含**：

- `postId`: 文章/页面 ID
- `postType`: 内容类型（'article' | 'page' | 'draft'）

---

## 内置 Shortcode 示例

### 1. 图片画廊

```markdown
[gallery ids="1,2,3" columns="3" /]
```

### 2. 按钮

```markdown
[button url="https://example.com" style="primary"]点击这里[/button]
```

### 3. 提示框

```markdown
[alert type="info"]这是一条提示信息[/alert]
```

---

## 完整示例

```typescript
// plugins/my-plugin/index.ts
import type { PluginAPI } from '@vanblog/shared/plugin';

export default (api: PluginAPI) => {
  // 1. 简单 shortcode
  api.shortcode('highlight', (attrs, content) => {
    const { color = 'yellow' } = attrs;
    return `<mark style="background-color: ${color}">${content}</mark>`;
  });

  // 2. 异步 shortcode
  api.shortcode('user-info', async (attrs, content, ctx) => {
    const { userId } = attrs;
    const user = await fetchUser(userId);
    return `<div class="user-card">${user.name}</div>`;
  });

  // 3. 使用上下文
  api.shortcode('related-posts', async (attrs, content, ctx) => {
    const posts = await getRelatedPosts(ctx.postId);
    return `<ul>${posts.map((p) => `<li>${p.title}</li>`).join('')}</ul>`;
  });
};
```

---

## 最佳实践

### ✅ 推荐

1. **返回安全的 HTML**

   ```typescript
   api.shortcode('safe', (attrs, content) => {
     const escaped = escapeHtml(content);
     return `<div>${escaped}</div>`;
   });
   ```

2. **提供默认值**

   ```typescript
   const { columns = '3', gap = '10px' } = attrs;
   ```

3. **验证必需属性**
   ```typescript
   if (!attrs.url) {
     return '<p>Error: url attribute is required</p>';
   }
   ```

### ❌ 避免

1. **不要执行危险操作**

   ```typescript
   // ❌ 不要执行用户输入的代码
   eval(attrs.code);
   ```

2. **不要返回未转义的用户输入**

   ```typescript
   // ❌ XSS 风险
   return `<div>${attrs.userInput}</div>`;
   ```

3. **不要阻塞太久**
   ```typescript
   // ❌ 避免长时间异步操作
   await sleep(10000);
   ```

---

## 调试

### 查看已注册的 Shortcode

```typescript
// 在插件中
api.log.info('Registered shortcodes:', api.listShortcodes?.());
```

### 测试 Shortcode

```typescript
// 单元测试示例
it('should render gallery shortcode', () => {
  const mockAPI = createMockAPI();
  plugin(mockAPI);

  const handler = mockAPI.shortcode.mock.calls[0][1];
  const result = handler({ ids: '1,2,3', columns: '3' }, '', {});

  expect(result).toContain('class="gallery"');
});
```

---

## 常见问题

### Q1: Shortcode 不生效？

检查：

1. 标签名是否正确注册
2. 语法是否正确（注意空格、引号）
3. 插件是否已启用

### Q2: 如何传递复杂数据？

使用 JSON 字符串：

```markdown
[chart data='{"labels":["A","B"],"values":[1,2]}' /]
```

```typescript
api.shortcode('chart', (attrs) => {
  const data = JSON.parse(attrs.data);
  // ...
});
```

### Q3: 如何嵌套 Shortcode？

Shortcode 系统支持递归解析，内层会先被处理：

```markdown
[outer][inner /][/outer]
```

---

## 技术细节

### 解析流程

1. **扫描内容**：查找 `[tag ...]` 模式
2. **提取属性**：解析 `key="value"` 对
3. **调用处理器**：执行注册的 handler
4. **替换内容**：用返回的 HTML 替换原标签
5. **递归处理**：处理嵌套的 shortcode

### 性能考虑

- Shortcode 在内容渲染时同步处理
- 避免在 handler 中执行耗时操作
- 考虑使用缓存减少重复计算

---

## 相关文档

- [插件开发指南](./PLUGIN_DEVELOPMENT.md)
- [Plugin API 参考](./PLUGIN_DEVELOPMENT.md#plugin-api-参考)
- [WordPress Shortcode API](https://codex.wordpress.org/Shortcode_API)（设计参考）

---

**文档结束**
