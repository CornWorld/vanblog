# 配置系统优化指南

## 概述

通过 **Zod + JSON Schema** 优化配置系统，实现：

1. **编辑器智能提示**：JSON 配置文件获得自动补全、类型校验、悬停文档
2. **单一数据源**：Zod Schema 作为唯一定义，自动生成 JSON Schema
3. **灵活配置**：支持 dotenv（部署）+ JSON（开发）双模式

---

## 配置优先级

```
环境变量 (.env) > JSON 配置文件 (config/*.json) > 代码默认值
```

- **环境变量**：最高优先级，适合生产环境覆盖敏感配置（如密钥、数据库连接）
- **JSON 配置文件**：中等优先级，适合开发环境配置，支持版本控制
- **代码默认值**：最低优先级，在 `config.schema.ts` 中定义

---

## 快速开始

### 1. 生成 JSON Schema

```bash
# 从 Zod Schema 生成 JSON Schema
pnpm config:schema
```

生成的文件：`packages/server-ng/config.schema.json`

### 2. 创建 JSON 配置文件

在 `packages/server-ng/config/` 目录下创建配置文件：

```bash
# 开发环境配置
touch config/development.json

# 生产环境配置
touch config/production.json
```

### 3. 编辑配置文件（享受智能提示）

打开 `config/development.json`，VS Code 会自动提供：

- ✅ 自动补全（Ctrl+Space）
- ✅ 类型校验（实时错误提示）
- ✅ 悬停文档
- ✅ 默认值提示

```json
{
  "$schema": "../config.schema.json",
  "PORT": 3050,
  "NODE_ENV": "development",
  "DATABASE_DRIVER": "local",
  "DATABASE_URL": "file:./data/vanblog.db",
  "JWT_SECRET": "your-secret-key-at-least-32-characters-long",
  "LOG_LEVEL": "debug"
}
```

### 4. 集成到 ConfigModule

在 `src/config/config.module.ts` 中添加 JSON 配置加载器：

```typescript
import { createConfigFileLoader } from './config-file.loader';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: validateConfig, // Zod 校验
      load: [
        createConfigFileLoader(), // 🆕 加载 JSON 配置文件
        databaseConfig,
      ],
    }),
  ],
  providers: [ConfigService, ConfigValidationService],
  exports: [ConfigService, ConfigValidationService, NestConfigModule],
})
export class ConfigModule {}
```

---

## 使用示例

### 场景 1：开发环境

创建 `config/development.json`：

```json
{
  "$schema": "../config.schema.json",
  "PORT": 3050,
  "NODE_ENV": "development",
  "LOG_LEVEL": "debug",
  "DATABASE_URL": "file:./dev-data/vanblog.db",
  "CORS_ORIGIN": "http://localhost:3001,http://localhost:3002"
}
```

启动应用：

```bash
pnpm dev
# 自动加载 config/development.json
```

### 场景 2：生产环境（JSON + dotenv）

创建 `config/production.json`（非敏感配置）：

```json
{
  "$schema": "../config.schema.json",
  "NODE_ENV": "production",
  "LOG_LEVEL": "warn",
  "CORS_ORIGIN": "https://yourdomain.com"
}
```

创建 `.env.production`（敏感配置）：

```bash
# 敏感配置通过环境变量传递
JWT_SECRET=your-production-secret-at-least-32-characters-long
JWT_REFRESH_SECRET=your-production-refresh-secret-at-least-32-characters-long
DATABASE_URL=file:/data/vanblog.db
```

启动应用：

```bash
NODE_ENV=production node dist/main.js
# 加载顺序：
# 1. config/production.json
# 2. .env.production（覆盖 JSON）
# 3. 环境变量（最高优先级）
```

### 场景 3：Docker 部署

`Dockerfile`：

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY . .

# 使用环境变量覆盖配置
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/main.js"]
```

`docker-compose.yml`：

```yaml
version: '3.8'
services:
  vanblog-server:
    image: vanblog-server:latest
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: file:/data/vanblog.db
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    volumes:
      - ./data:/data
```

---

## 编辑器配置

### VS Code（已配置）

`.vscode/settings.json` 已配置 JSON Schema 映射：

```json
{
  "json.schemas": [
    {
      "fileMatch": [
        "**/config/default.json",
        "**/config/development.json",
        "**/config/production.json",
        "**/config/test.json"
      ],
      "url": "./packages/server-ng/config.schema.json"
    }
  ]
}
```

### WebStorm / IntelliJ IDEA

自动识别 `$schema` 字段，无需额外配置。

---

## 优势对比

### 优化前（仅 dotenv）

```bash
# .env - 扁平键值对，无类型提示
PORT=3050
NODE_ENV=development
DATABASE_URL=file:./data/vanblog.db
JWT_SECRET=your-secret
```

❌ 无自动补全
❌ 无类型校验
❌ 无嵌套结构
❌ 配置错误在运行时才发现

### 优化后（JSON + dotenv）

```json
{
  "$schema": "../config.schema.json",
  "PORT": 3050,
  "NODE_ENV": "development",
  "DATABASE_URL": "file:./data/vanblog.db"
}
```

✅ 实时自动补全
✅ 编辑时类型校验
✅ 悬停查看文档
✅ 配置错误立即发现
✅ 支持嵌套对象（如果需要）

---

## 对比表格

| 维度            | 仅 dotenv         | dotenv + JSON + JSON Schema |
| --------------- | ----------------- | --------------------------- |
| **配置格式**    | 扁平键值对        | JSON（结构化）              |
| **编辑器支持**  | ❌ 无             | ✅ 完整支持                 |
| **类型校验**    | 运行时            | 编辑时 + 运行时             |
| **自动补全**    | ❌ 无             | ✅ 有                       |
| **文档提示**    | ❌ 无             | ✅ 有                       |
| **Docker 友好** | ✅ 是             | ✅ 是（支持环境变量覆盖）   |
| **版本控制**    | ⚠️ 敏感信息需小心 | ✅ 非敏感配置可提交         |
| **复杂配置**    | ❌ 不支持嵌套     | ✅ 支持嵌套                 |
| **学习曲线**    | 低                | 中                          |

---

## 最佳实践

### 1. 配置分层

- **default.json**：通用默认配置（提交到 Git）
- **development.json**：开发环境配置（提交到 Git）
- **production.json**：生产环境非敏感配置（提交到 Git）
- **.env.production**：生产环境敏感配置（不提交，通过 CI/CD 注入）

### 2. 敏感信息处理

```json
// ❌ 不要在 JSON 中存储敏感信息
{
  "JWT_SECRET": "actual-production-secret"  // 不安全
}

// ✅ 在 .env 中存储敏感信息
JWT_SECRET=actual-production-secret
```

### 3. Schema 同步

每次修改 `config.schema.ts` 后，重新生成 JSON Schema：

```bash
pnpm config:schema
```

### 4. 配置校验

在 CI/CD 中验证配置文件：

```bash
# 使用 ajv-cli 验证 JSON
pnpm add -D ajv-cli
ajv validate -s config.schema.json -d config/production.json
```

---

## 常见问题

### Q1: 如何查看最终合并的配置？

```typescript
// 在任意服务中注入 ConfigService
constructor(private readonly configService: ConfigService) {}

// 查看所有配置
console.log(this.configService.all);
```

### Q2: 配置文件不存在会报错吗？

不会。如果未找到 JSON 配置文件，会降级到仅使用环境变量。

### Q3: 如何强制要求 JSON 配置文件？

```typescript
createConfigFileLoader({ required: true });
```

### Q4: 如何添加新的配置项？

1. 在 `src/config/config.schema.ts` 中添加 Zod 定义
2. 运行 `pnpm config:schema` 重新生成 JSON Schema
3. VS Code 会自动识别新配置项

---

## 迁移指南

### 从纯 .env 迁移到 JSON + .env

1. **保持现有 .env 文件**（向后兼容）
2. **创建 JSON 配置文件**：
   ```bash
   cp .env config/development.json
   # 手动转换为 JSON 格式
   ```
3. **移除敏感信息**：将 JWT_SECRET 等保留在 .env 中
4. **集成配置加载器**：按上述步骤修改 `config.module.ts`

---

## 扩展阅读

- [Zod 文档](https://zod.dev/)
- [JSON Schema 规范](https://json-schema.org/)
- [NestJS ConfigModule](https://docs.nestjs.com/techniques/configuration)
- [VS Code JSON Schema 配置](https://code.visualstudio.com/docs/languages/json#_json-schemas-and-settings)

---

## 总结

通过 **Zod + JSON Schema** 优化配置系统，我们获得了：

- ✅ **更好的开发体验**：编辑器智能提示、实时校验
- ✅ **更高的安全性**：敏感信息通过环境变量管理
- ✅ **更强的灵活性**：支持 JSON（开发）+ .env（部署）双模式
- ✅ **更少的错误**：配置错误在编辑时即可发现
- ✅ **向后兼容**：仍然支持纯 .env 模式

**推荐使用场景**：

- ✅ 开发环境：使用 JSON 配置文件
- ✅ 生产环境：JSON（非敏感）+ 环境变量（敏感）
- ✅ Docker 部署：环境变量优先
