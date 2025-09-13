# 插件系统重构方案

## 问题诊断

当前插件系统存在以下问题：

1. **主系统侵入**：主包代码中硬编码了特定插件（如 rewards）的处理逻辑
2. **扩展性差**：每增加一个插件特性都需要修改主系统代码
3. **耦合度高**：主系统需要了解每个插件的数据结构

## Linus 的视角

"Bad programmers worry about the code. Good programmers worry about data structures."

当前的问题本质是数据结构设计错误。主系统不应该知道任何特定插件的存在。

## 重构方案

### 1. 数据结构改进

#### 现状（糟糕的设计）

```typescript
// bootstrap.service.ts - 特殊处理 rewards
private extractRewardsFromPluginData(pluginData: Record<string, unknown>): RewardItem[] {
  const rewardsData = pluginData['rewards-plugin'];
  if (Array.isArray(rewardsData)) {
    return rewardsData as RewardItem[];
  }
  return [];
}

// meta.controller.ts - 硬编码 rewards 结构
interface PublicMetaProp {
  meta: {
    rewards: RewardItemDto[];  // 特殊字段
    // ...
  }
}
```

#### 改进后（好品味）

```typescript
// bootstrap.service.ts - 通用处理
interface PublicBootstrapResponse {
  // 核心系统数据
  version: string;
  tags: string[];
  totalArticles: number;
  // ...

  // 插件数据 - 完全通用
  extensions: Record<string, unknown>;
}

async getPublicBootstrap(): Promise<PublicBootstrapResponse> {
  const pluginData = await this.pluginRegistryService.getAllPublicData();

  return {
    // 系统核心数据
    version: this.getVersion(),
    tags: await this.getAllTags(),

    // 所有插件数据，不做任何特殊处理
    extensions: pluginData,
  };
}
```

### 2. 插件接口标准化

#### 定义标准插件数据格式

```typescript
// plugin-data.interface.ts
export interface PluginPublicData {
  /** 插件ID */
  pluginId: string;
  /** 插件版本 */
  version: string;
  /** 插件暴露的公共数据 */
  data: unknown;
  /** 数据模式（可选，用于前端验证） */
  schema?: Record<string, unknown>;
}
```

#### 插件注册标准化

```typescript
// rewards-plugin/index.ts
async init(context: PluginContext): Promise<void> {
  // 注册标准化的公共数据
  context.registry.register('rewards', async () => {
    const rewards = await this.getRewards();
    return {
      pluginId: 'rewards-plugin',
      version: '1.0.0',
      data: rewards,
      schema: RewardSchema,
    };
  });
}
```

### 3. 使用 Hook 系统替代直接调用

#### 现状（直接调用）

```typescript
// bootstrap.service.ts
rewards: this.extractRewardsFromPluginData(pluginData),
```

#### 改进后（Hook 系统）

```typescript
// bootstrap.service.ts
async getPublicBootstrap() {
  const baseResponse = {
    version: this.getVersion(),
    // ... 核心数据
  };

  // 让插件通过 hook 增强响应
  const enhanced = await this.hookService.applyFilters(
    'bootstrap|enhance',
    baseResponse
  );

  return enhanced;
}

// rewards-plugin/index.ts
hooks: {
  'bootstrap|enhance': {
    type: 'filter',
    handler: async (response, context) => {
      const rewards = await this.getRewards(context);
      return {
        ...response,
        extensions: {
          ...response.extensions,
          rewards,
        },
      };
    },
  },
}
```

### 4. 前端适配

前端需要从通用的 `extensions` 字段中提取插件数据：

```typescript
// Frontend
interface BootstrapResponse {
  // 核心数据
  version: string;
  tags: string[];

  // 插件数据
  extensions: {
    rewards?: RewardItem[];
    beian?: BeianInfo;
    socialLinks?: SocialLink[];
    // ... 其他插件
  };
}

// 使用时
const rewards = response.extensions?.rewards || [];
```

## 实施步骤

### 第一阶段：建立新架构（不破坏兼容性）

1. 添加通用的 `extensions` 字段到响应中
2. 保持现有的 `rewards` 字段以兼容旧版前端
3. 标记旧字段为 `@deprecated`

### 第二阶段：迁移插件

1. 修改 rewards-plugin 使用新的注册方式
2. 修改其他插件遵循新标准
3. 添加插件数据的 schema 验证

### 第三阶段：清理旧代码

1. 前端迁移到新的数据结构
2. 移除主系统中的插件特定代码
3. 移除废弃的字段和方法

## 收益

1. **解耦**：主系统不再依赖特定插件
2. **扩展性**：新插件无需修改主系统代码
3. **维护性**：插件逻辑完全独立，易于理解和维护
4. **类型安全**：通过 schema 提供类型信息

## 注意事项

1. **向后兼容**：分阶段实施，确保不破坏现有功能
2. **文档更新**：更新插件开发文档
3. **测试覆盖**：确保每个阶段都有充分的测试

## 结论

这个重构遵循了 Linus 的"好品味"原则：

- 消除特殊情况（rewards 不再是特殊的）
- 简化数据流（所有插件数据统一处理）
- 减少耦合（主系统不知道插件细节）

"Never break userspace" - 通过分阶段实施，确保向后兼容性。
