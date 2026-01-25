# Shared 包构建优化

## 问题

```
contracts → runtime/schema.ts → db.ts → drizzle-orm (292KB)
```

前端只需要 contracts，但被迫拉入整个 drizzle-orm。

**目标**：前端 contracts 不含 drizzle 依赖，后端保持自动验证，源码保持 Single Source of Truth。

---

## 方案概览

| 方案                   | 前端体积 | 后端验证 | 源码改动 | 推荐度 |
| ---------------------- | -------- | -------- | -------- | ------ |
| A. Zod 序列化 + alias  | 228KB    | 自动     | 无       | ⭐⭐   |
| B. c.type<T>() 纯类型  | ~0KB     | 手动     | 大       | ⭐     |
| C. 双 Contract（手动） | ~0KB     | 自动     | 大       | ⭐⭐   |
| D. 双 Contract（生成） | ~0KB     | 自动     | 无       | ⭐⭐⭐ |

---

## 方案 A: Zod 序列化 + alias

### 原理

构建时将 Zod schema 序列化为纯 Zod 代码，通过 `resolve.alias` 替换 contracts 的导入。

```
源码:   contracts → runtime/schema.ts → drizzle
构建后: contracts → generated/api-schemas.ts (纯 Zod)
```

### Zod 4 序列化

Zod 4 的 `schema.type` 或 `schema._def.type` 包含类型信息：

```typescript
function serializeZod4(schema: any, indent = 0): string {
  const type = schema.type || schema._def?.type;
  const pad = '  '.repeat(indent);

  switch (type) {
    case 'string':
      return 'z.string()';
    case 'number':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'optional':
      return `${serializeZod4(schema._def.innerType, indent)}.optional()`;
    case 'nullable':
      return `${serializeZod4(schema._def.innerType, indent)}.nullable()`;
    case 'array':
      return `z.array(${serializeZod4(schema._def.element, indent)})`;
    case 'enum':
      const values = Object.keys(schema._def.entries).map((v) => JSON.stringify(v));
      return `z.enum([${values.join(', ')}])`;
    case 'object': {
      const shape = schema._def.shape || schema.shape;
      const props = Object.entries(shape).map(
        ([key, val]) => `${pad}  ${key}: ${serializeZod4(val, indent + 1)}`,
      );
      return `z.object({\n${props.join(',\n')},\n${pad}})`;
    }
    case 'pipe':
      return serializeZod4(schema._def.in, indent); // transform 取输入类型
    case 'record':
      return `z.record(z.string(), ${serializeZod4(schema._def.valueType, indent)})`;
    case 'union':
      const options = schema._def.options.map((o: any) => serializeZod4(o, indent));
      return `z.union([${options.join(', ')}])`;
    default:
      return `z.any() /* ${type} */`;
  }
}
```

### Vite 配置

```typescript
// vite.config.ts
function generateApiSchemasPlugin(): Plugin {
  return {
    name: 'generate-api-schemas',
    async buildStart() {
      const schemas = await import('./src/runtime/schema.ts');
      const lines = ["import { z } from 'zod';", ''];

      for (const [name, schema] of Object.entries(schemas)) {
        if (schema?._def || schema?.type) {
          lines.push(`export const ${name} = ${serializeZod4(schema)};`);
        }
      }

      fs.writeFileSync('src/generated/api-schemas.ts', lines.join('\n'));
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '../runtime/schema.js': resolve(__dirname, 'src/generated/api-schemas.ts'),
    },
  },
  plugins: [generateApiSchemasPlugin()],
});
```

### 结果

- 590KB → 228KB (-61%)
- drizzle 引用: 57 → 0

---

## 方案 B: ts-rest c.type<T>()

### 原理

ts-rest 支持纯 TypeScript 类型，`c.type<T>()` 运行时只是一个 Symbol。

```typescript
// 前端 contract
import type { User } from '@vanblog/shared/type';

export const contract = c.router({
  getUser: {
    method: 'GET',
    path: '/users/:id',
    responses: { 200: c.type<User>() }, // 0 bytes
  },
});
```

### 限制

1. **后端需手动验证** - ts-rest 只在 schema 存在时自动验证
2. **无 OpenAPI schema** - 生成的 OpenAPI 文档不含响应体结构

---

## 方案 C: 双 Contract（手动维护）

### 原理

维护两套 contract：前端用 `c.type<T>()`，后端用 Zod schema。

```
@vanblog/shared/contracts        → 前端（c.type，0KB）
@vanblog/shared/contracts-server → 后端（Zod，自动验证）
```

### 示例

```typescript
// contracts/article.ts (前端)
import type { Article } from '../type/index.js';
export const articleContract = c.router({
  findAll: {
    method: 'GET',
    path: '/api/articles',
    responses: { 200: c.type<Article[]>() },
  },
});

// contracts-server/article.ts (后端)
import { Article } from '../runtime/schema.js';
export const articleContract = c.router({
  findAll: {
    method: 'GET',
    path: '/api/articles',
    responses: { 200: Article.array() },
  },
});
```

### 限制

- 需要手动维护两套代码
- 容易出现不同步

---

## 方案 D: 双 Contract（自动生成）⭐ 推荐

### 原理

后端 contract 使用 Zod schema，构建时自动生成前端版本。

```
源码: contracts-server/*.ts (Zod schema)
     ↓ Vite 插件
生成: contracts/*.ts (c.type<T>())
```

### 实现

1. **后端 contract 作为源码**（使用 Zod schema）
2. **Vite 插件在 buildStart 生成前端版本**
3. **类型断言确保同步**

```typescript
// vite.config.ts
function generateClientContractsPlugin(): Plugin {
  return {
    name: 'generate-client-contracts',
    buildStart() {
      const serverDir = 'src/contracts-server';
      const clientDir = 'src/contracts';

      for (const file of fs.readdirSync(serverDir)) {
        if (!file.endsWith('.ts') || file === 'index.ts') continue;

        let content = fs.readFileSync(`${serverDir}/${file}`, 'utf-8');

        // 1. 收集导入的 schema 名
        const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/runtime/);
        const schemas = importMatch?.[1].split(',').map((s) => s.trim()) || [];

        // 2. 转换为 type import
        content = content.replace(
          /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/runtime\/schema\.js['"]/,
          `import type {$1} from '../runtime/schema.js'`,
        );

        // 3. 转换 responses/body 中的 schema
        for (const schema of schemas) {
          // responses: { 200: Article } → responses: { 200: c.type<Article>() }
          content = content.replace(
            new RegExp(`(responses:[^}]*\\d+:\\s*)${schema}([,\\s}])`, 'g'),
            `$1c.type<${schema}>()$2`,
          );
          // body: ArticleReq → body: c.type<ArticleReq>()
          content = content.replace(
            new RegExp(`(body:\\s*)${schema}([,\\s])`, 'g'),
            `$1c.type<${schema}>()$2`,
          );
        }

        fs.writeFileSync(`${clientDir}/${file}`, content);
      }
    },
  };
}
```

### 处理复杂情况

对于 contract 中定义的辅助 schema（如 `CategoryWithCount = Category.extend(...)`）：

**选项 1**: 移到 runtime/schema.ts 中定义
**选项 2**: 在前端 contract 中用内联 `c.type<{ ...fields }>()`
**选项 3**: 保留 Zod（前端会包含少量 Zod 代码）

### Package Exports

```json
{
  "exports": {
    "./contracts": "./dist/contracts/index.js",
    "./contracts-server": "./dist/contracts-server/index.js"
  }
}
```

### 使用

```typescript
// 前端
import { contract } from '@vanblog/shared/contracts';

// 后端
import { contract } from '@vanblog/shared/contracts-server';
```

---

## Zod 4 结构参考

```typescript
// 基本类型
(schema.type === 'string') | 'number' | 'boolean' | 'null' | 'undefined';

// 复合类型
schema.type === 'object'; // shape 在 schema._def.shape
schema.type === 'array'; // 元素在 schema._def.element
schema.type === 'enum'; // 值在 schema._def.entries (object)
schema.type === 'union'; // 选项在 schema._def.options

// 修饰符
schema.type === 'optional'; // 内部类型在 schema._def.innerType
schema.type === 'nullable'; // 同上
schema.type === 'pipe'; // transform，输入在 schema._def.in

// .extend() 后的 schema 完全展开，不保留原 schema 引用
```

---

## 总结

| 需求                   | 推荐方案 |
| ---------------------- | -------- |
| 最小改动，接受 228KB   | 方案 A   |
| 前端极致优化，无 Zod   | 方案 D   |
| 需要完整 OpenAPI       | 方案 A/D |
| 后端自动验证           | 方案 A/D |
| 不想维护两套 contract  | 方案 A   |
| 愿意投入一次性重构成本 | 方案 D   |

**推荐**: 方案 D（双 Contract 自动生成），一次性投入后可获得最佳效果。
