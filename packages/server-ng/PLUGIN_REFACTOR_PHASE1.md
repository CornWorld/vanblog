# 插件系统重构 - 第一阶段实施

## 目标

在不破坏现有 API 的前提下，建立新的插件数据架构。

## 实现步骤

### 1. 修改 Bootstrap DTO - 添加通用扩展字段

```typescript
// bootstrap.dto.ts
export const PublicBootstrapResponseSchema = z.object({
  // ... 现有字段保持不变
  version: z.string(),
  tags: z.array(z.string()),
  // ...

  // 新增：通用插件数据字段
  extensions: z.record(z.string(), z.unknown()).optional().describe('插件扩展数据，key 为插件名称'),
});
```

### 2. 修改 Bootstrap Service - 双轨制

```typescript
// bootstrap.service.ts
async getPublicBootstrap(): Promise<PublicBootstrapResponseDto> {
  // ... 现有逻辑

  const pluginData = await this.pluginRegistryService.getAllPublicData();

  // 校验与规范化插件数据
  const validatedExtensions: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(pluginData)) {
    const normalized = this.pluginDataValidator.normalizeProviderResult(name, raw);
    if (normalized !== undefined) {
      validatedExtensions[name] = normalized;
    }
  }

  const response: PublicBootstrapResponseDto = {
    // ... 现有字段
    version: this.getVersion(),

    // 新增：所有插件数据
    extensions: validatedExtensions,
  };

  return response;
}
```

### 3. 修改插件实现 - 使用标准格式

```typescript
// rewards-plugin/index.ts
async init(context: PluginContext): Promise<void> {
  // 注册到插件注册表（使用新标准）
  context.registry.register(
    'rewards',  // 新的简洁名称
    async () => ({
      version: '1.0.0',
      data: await this.getRewards(),
      schema: RewardInfoArraySchema,
    })
  );
}
```

### 4. 添加插件数据验证中间件

```typescript
// plugin-data.validator.ts
export class PluginDataValidator {
  validatePluginData(
    pluginName: string,
    data: unknown,
    schema?: z.ZodSchema,
  ): { valid: boolean; errors?: string[] } {
    if (!schema) return { valid: true };

    try {
      schema.parse(data);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => e.message),
        };
      }
      return { valid: false, errors: [String(error)] };
    }
  }
}
```

### 5. 更新 API 文档

```typescript
/**
 * @apiVersion 2.1.0
 * @api {get} /api/v2/public/bootstrap 获取启动信息
 * @apiDescription
 * 返回博客的基础配置信息。
 *
 * **重要变更（v2.1.0）**:
 * - 新增 `extensions` 字段，包含所有插件数据
 * - `rewards` 和 `socialLinks` 字段已废弃，请使用 `extensions.rewards` 和 `extensions.socialLinks`
 * - 废弃字段将在 v3.0.0 中移除
 *
 * @apiSuccess {Object} extensions 插件扩展数据
 * @apiSuccess {Array} extensions.rewards 打赏信息（如果安装了 rewards 插件）
 * @apiSuccess {Array} extensions.socialLinks 社交链接（如果安装了 social-links 插件）
 */
```

## 测试计划

### 1. 向后兼容性测试

```typescript
it('should include all plugin data in extensions', async () => {
  const response = await request(app).get('/api/v2/public/bootstrap');

  // 验证 extensions 字段存在
  expect(response.body).toHaveProperty('extensions');
  expect(typeof response.body.extensions).toBe('object');

  // 验证插件数据存在
  if (response.body.extensions['rewards']) {
    expect(Array.isArray(response.body.extensions['rewards'])).toBe(true);
  }
  if (response.body.extensions['socialLinks']) {
    expect(Array.isArray(response.body.extensions['socialLinks'])).toBe(true);
  }
});
```

### 2. 新功能测试

```typescript
it('should include all plugin data in extensions', async () => {
  const response = await request(app).get('/api/v2/public/bootstrap');

  expect(response.body.extensions).toBeDefined();
  expect(typeof response.body.extensions).toBe('object');

  // 验证插件数据存在
  if (response.body.extensions['rewards']) {
    expect(Array.isArray(response.body.extensions['rewards'])).toBe(true);
  }
});
```

## 前端迁移指南

### 现有代码（继续工作）

```typescript
// 旧代码继续工作
const rewards = response.data.rewards || [];
const socialLinks = response.data.socialLinks || [];
```

### 推荐的新代码

```typescript
// 新的推荐方式
const rewards = response.data.extensions?.rewards || response.data.rewards || []; // 降级到旧字段

const socialLinks = response.data.extensions?.socialLinks || response.data.socialLinks || [];
```

### TypeScript 类型更新

```typescript
interface BootstrapResponse {
  // ... 现有字段

  /** @deprecated 使用 extensions.rewards */
  rewards: RewardItem[];

  /** @deprecated 使用 extensions.socialLinks */
  socialLinks: SocialLink[];

  // 新字段
  extensions?: {
    rewards?: RewardItem[];
    socialLinks?: SocialLink[];
    [pluginName: string]: unknown;
  };
}
```

## 监控和告警

1. **日志监控**
   - 记录使用废弃字段的客户端
   - 统计新字段的采用率

2. **性能监控**
   - 确保插件数据聚合不影响响应时间
   - 监控 extensions 字段的大小

3. **错误监控**
   - 插件数据加载失败不应影响核心功能
   - 记录插件数据验证失败的情况

## 时间表

- **第 1-2 周**：实现和测试新架构
- **第 3-4 周**：更新文档和示例
- **第 2 个月**：监控采用情况，修复问题
- **第 3 个月**：开始第二阶段（迁移插件）

## 成功标准

1. 零破坏性变更 - 所有现有 API 调用继续工作
2. 插件数据正确聚合到 extensions 字段
3. 性能影响 < 5ms
4. 测试覆盖率 > 90%

## 风险和缓解

1. **风险**：前端可能依赖字段顺序
   - **缓解**：保持 JSON 字段顺序不变

2. **风险**：插件数据可能很大
   - **缓解**：实现分页或按需加载

3. **风险**：插件命名冲突
   - **缓解**：使用插件 ID 作为 key，而不是简单名称
