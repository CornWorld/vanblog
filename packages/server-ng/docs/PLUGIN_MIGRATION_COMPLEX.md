# 复杂插件迁移指南

**文档版本**: 1.0.0
**最后更新**: 2025-12-17
**适用范围**: 包含 NestJS Controller/Service 的复杂插件

> **注意**: 函数式 Plugin API 主要针对轻量级插件。对于需要 HTTP 路由、依赖注入、
> 复杂业务逻辑的插件，建议保持对象式接口（Object Plugin）。

---

## 📋 目录

1. [概述](#概述)
2. [复杂插件的特征](#复杂插件的特征)
3. [迁移策略对比](#迁移策略对比)
4. [推荐方案：保留现状](#推荐方案保留现状)
5. [可选方案：混合模式](#可选方案混合模式)
6. [迁移检查清单](#迁移检查清单)
7. [示例分析](#示例分析)

---

## 概述

### 什么是复杂插件？

复杂插件是指包含以下特性的插件：

- ✅ NestJS Controller（注册 HTTP 路由）
- ✅ NestJS Service（复杂业务逻辑）
- ✅ 依赖注入（DI）系统
- ✅ 数据库操作
- ✅ ts-rest Contract 集成

### 为什么需要特殊处理？

函数式 Plugin API 设计目标是**简化轻量级插件**的开发，主要支持：

- Filter hooks（数据转换）
- Action hooks（副作用）
- Shortcode（内容扩展）
- 配置管理
- 响应式存储

但**不直接支持**：

- ❌ HTTP 路由注册
- ❌ NestJS 依赖注入
- ❌ Controller/Service 架构

---

## 复杂插件的特征

### 当前 VanBlog 复杂插件清单

| 插件                          | Controller | Service | Contract | 复杂度 |
| ----------------------------- | ---------- | ------- | -------- | ------ |
| **rss-plugin**                | ✅         | ✅      | ❌       | 高     |
| **rewards-plugin**            | ✅         | ✅      | ✅       | 高     |
| **email-notification-plugin** | ❌         | ✅      | ❌       | 中     |

### 复杂插件特征识别

如果你的插件满足以下**任意一条**，应视为复杂插件：

1. **有 Controller 文件** (`*.controller.ts`)
2. **注册了 HTTP 路由** (`GET /api/*`, `POST /api/*`)
3. **使用了 NestJS `@Injectable()` 装饰器**
4. **依赖其他 NestJS 服务**（如 `ConfigService`, `DatabaseService`）

---

## 迁移策略对比

### 策略 1: 保留现状 ⭐ 推荐

**适用场景**: 所有复杂插件（rss, rewards, email-notification）

**优点**:

- ✅ 零迁移成本
- ✅ 保持现有架构稳定
- ✅ 不破坏现有功能
- ✅ 继续使用 NestJS 最佳实践

**缺点**:

- ⚠️ 无法使用新的函数式 API 特性
- ⚠️ 维护两套插件体系

**决策建议**:

> 如果插件功能稳定，无需频繁修改，**强烈推荐保留现状**。

---

### 策略 2: 混合模式

**适用场景**: 需要同时使用 NestJS Module 和 函数式 Hook 的插件

**实现方式**: 插件同时导出 NestJS Module 和函数式入口

**优点**:

- ✅ 保留 Controller/Service（HTTP 路由）
- ✅ 可使用函数式 Hook（如 `article.afterCreate`）
- ✅ 灵活性高

**缺点**:

- ⚠️ 架构复杂度增加
- ⚠️ 需要维护两套代码
- ⚠️ 可能导致逻辑重复

**示例代码**:

```typescript
// index.ts - 混合模式插件
import { Module, Controller, Injectable } from '@nestjs/common';
import type { PluginAPI } from '@vanblog/shared/plugin';

// === NestJS 部分 ===
@Injectable()
class RssService {
  async generateRss() {
    // RSS 生成逻辑
  }
}

@Controller('rss')
class RssController {
  constructor(private rssService: RssService) {}

  @Get('feed.xml')
  async getFeed() {
    return this.rssService.generateRss();
  }
}

@Module({
  controllers: [RssController],
  providers: [RssService],
  exports: [RssService],
})
class RssPluginModule {}

// === 函数式 API 部分 ===
const rssServiceInstance = new RssService();

export default {
  // NestJS Module（用于 Controller 和路由）
  module: RssPluginModule,

  // 函数式入口（用于 Hook）
  init: (api: PluginAPI) => {
    // 注册 Action Hook - 文章创建后重新生成 RSS
    api.action('article.afterCreate', async (article) => {
      await rssServiceInstance.generateRss();
      api.log.info(`RSS regenerated for article: ${article.title}`);
    });

    // 注册 Action Hook - 文章更新后重新生成 RSS
    api.action('article.afterUpdate', async (article) => {
      await rssServiceInstance.generateRss();
      api.log.info(`RSS regenerated for article: ${article.title}`);
    });

    api.log.info('RSS plugin hooks registered');
  },
};
```

**决策建议**:

> 仅当插件**既需要 HTTP 路由，又需要 Hook 功能**时使用混合模式。

---

### 策略 3: 完全迁移到函数式 API ❌ 不推荐

**适用场景**: ~~无~~

**为什么不推荐**:

1. **无法实现 HTTP 路由**: 函数式 API 不支持注册 Controller
2. **丢失依赖注入**: 无法使用 NestJS DI 系统
3. **代码重构成本高**: 需要重写所有业务逻辑

**结论**:

> **不要**尝试将复杂插件完全迁移到函数式 API。

---

## 推荐方案：保留现状

### 实施步骤

1. **不做任何修改** ✅
2. **继续使用对象式插件接口**
3. **添加文档注释**（标记为复杂插件，不迁移）

### 示例：在插件入口添加注释

```typescript
// plugins/rss-plugin/index.ts

/**
 * RSS Plugin
 *
 * 【复杂插件 - 保留对象式接口】
 *
 * 原因：
 * - 包含 NestJS Controller（HTTP 路由）
 * - 使用 NestJS 依赖注入系统
 * - 功能稳定，无需迁移
 *
 * 迁移策略：保留现状
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';

const plugin: Plugin = {
  id: 'rss-plugin',
  name: 'RSS Plugin',
  version: '2.0.0',

  async init(context) {
    // 现有初始化逻辑
  },

  async destroy(context) {
    // 现有销毁逻辑
  },

  hooks: {
    // 现有钩子定义
  },
};

export default plugin;
```

---

## 可选方案：混合模式

### 何时使用混合模式？

**仅当满足以下条件时考虑**:

1. ✅ 插件需要注册 HTTP 路由（必须保留 Controller）
2. ✅ 插件需要使用新的函数式 Hook（如 `api.filter()`, `api.action()`）
3. ✅ 团队有能力维护混合架构

### 实施步骤

#### 1. 创建混合模式插件结构

```
plugins/my-complex-plugin/
├── index.ts              # 混合模式入口
├── my.module.ts          # NestJS Module
├── my.controller.ts      # NestJS Controller
├── my.service.ts         # NestJS Service
├── hooks.ts              # 函数式 Hooks（新建）
└── package.json
```

#### 2. 编写函数式 Hooks

```typescript
// hooks.ts
import type { PluginAPI } from '@vanblog/shared/plugin';
import { MyService } from './my.service';

export function registerHooks(api: PluginAPI, service: MyService) {
  // Filter Hook
  api.filter('article.beforeCreate', (article) => {
    // 修改文章数据
    return {
      ...article,
      processedBy: api.id,
    };
  });

  // Action Hook
  api.action('article.afterCreate', async (article) => {
    // 触发服务方法
    await service.handleArticleCreated(article);
    api.log.info(`Article created: ${article.title}`);
  });

  // 配置变化监听
  api.onConfigChange('enabled', (newValue) => {
    api.log.info(`Plugin enabled changed to: ${newValue}`);
  });
}
```

#### 3. 更新插件入口

```typescript
// index.ts
import { Module } from '@nestjs/common';
import type { PluginAPI } from '@vanblog/shared/plugin';
import { MyController } from './my.controller';
import { MyService } from './my.service';
import { registerHooks } from './hooks';

@Module({
  controllers: [MyController],
  providers: [MyService],
  exports: [MyService],
})
class MyPluginModule {}

// 创建服务单例（用于 Hook）
const myServiceInstance = new MyService();

export default {
  // NestJS Module（用于 Controller 和路由）
  module: MyPluginModule,

  // 函数式入口（用于 Hook）
  init: (api: PluginAPI) => {
    api.log.info('Initializing MyPlugin hooks...');
    registerHooks(api, myServiceInstance);
    api.log.info('MyPlugin hooks registered successfully');
  },
};
```

### 混合模式注意事项

⚠️ **服务实例问题**:

- NestJS Module 中的 Service 由 NestJS DI 管理
- 函数式 Hook 中的 Service 是手动创建的单例
- **可能导致状态不一致**

💡 **解决方案**:

1. 确保 Service 是无状态的（Stateless）
2. 或者在 Module 中导出 Service，在 Hook 中通过依赖注入获取

---

## 迁移检查清单

### 复杂插件识别清单

在决定是否迁移之前，先回答以下问题：

- [ ] 插件是否包含 `*.controller.ts` 文件？
- [ ] 插件是否注册了 HTTP 路由（`@Get()`, `@Post()`）？
- [ ] 插件是否使用了 NestJS 依赖注入（`@Injectable()`）？
- [ ] 插件是否依赖其他 NestJS 服务？
- [ ] 插件功能是否稳定，很少修改？

**如果任意一项为是，建议保留现状。**

### 迁移后验证清单

如果选择混合模式，完成后需验证：

- [ ] HTTP 路由仍然工作正常
- [ ] 函数式 Hook 正确触发
- [ ] 配置系统正常工作
- [ ] 日志输出正确
- [ ] 所有测试通过
- [ ] 文档已更新

---

## 示例分析

### 示例 1: rss-plugin（保留现状）

**当前架构**:

- RssController（`/rss/feed.xml` 等路由）
- RssService（RSS 生成逻辑）
- Hook: `article|afterCreate`（触发 RSS 重新生成）

**迁移决策**: **保留现状** ⭐

**理由**:

1. ✅ 功能稳定，很少修改
2. ✅ HTTP 路由是核心功能，无法用函数式 API 替代
3. ✅ 现有架构已经很好

**实施**: 无需任何修改

---

### 示例 2: rewards-plugin（保留现状）

**当前架构**:

- RewardController（CRUD API）
- RewardService（奖励管理逻辑）
- ts-rest Contract（类型安全 API）
- Hook: `bootstrap|beforeGenerate`（注入奖励数据）

**迁移决策**: **保留现状** ⭐

**理由**:

1. ✅ 包含完整的 CRUD API
2. ✅ 使用 ts-rest Contract（NestJS 集成）
3. ✅ 架构复杂，迁移成本高

**实施**: 无需任何修改

---

### 示例 3: email-notification-plugin（可选迁移）

**当前架构**:

- EmailNotificationService（邮件发送逻辑）
- Hook: `article|afterCreate`（发送通知）

**迁移决策**: **可选择完全迁移** 🤔

**理由**:

1. ⚠️ 无 Controller，仅使用 Service
2. ⚠️ Hook 逻辑简单（发送邮件）
3. ✅ 可以迁移到函数式 API

**函数式实现示例**:

```typescript
// email-notification-plugin/index.ts
import type { PluginAPI } from '@vanblog/shared/plugin';
import nodemailer from 'nodemailer';

export default (api: PluginAPI) => {
  const smtpHost = api.config.smtpHost as string;
  const smtpPort = api.config.smtpPort as number;
  const emailTo = api.config.emailTo as string;

  // 初始化邮件发送器
  const transporter = nodemailer.createTransporter({
    host: smtpHost,
    port: smtpPort,
    auth: {
      user: api.config.smtpUser as string,
      pass: api.config.smtpPass as string,
    },
  });

  // 文章创建后发送邮件
  api.action('article.afterCreate', async (article) => {
    try {
      await transporter.sendMail({
        from: api.config.emailFrom as string,
        to: emailTo,
        subject: `新文章: ${article.title}`,
        html: `<p>文章《${article.title}》已发布</p>`,
      });
      api.log.info(`Email sent for article: ${article.title}`);
    } catch (error) {
      api.log.error(`Failed to send email: ${error.message}`);
    }
  });

  api.log.info('Email notification plugin initialized');
};
```

---

## 总结

### 迁移决策树

```
是否包含 Controller/HTTP 路由？
├─ 是 → 保留现状（rss-plugin, rewards-plugin）
└─ 否 → 是否使用 NestJS DI？
    ├─ 是 → 保留现状或混合模式
    └─ 否 → 可以迁移到函数式 API（email-notification-plugin）
```

### 关键建议

1. **默认选择：保留现状** ⭐
   - 适用于 90% 的复杂插件
   - 零迁移成本，稳定可靠

2. **特殊需求：混合模式**
   - 仅在需要同时使用 Controller 和函数式 Hook 时考虑
   - 注意维护复杂度

3. **罕见情况：完全迁移**
   - 仅适用于无 Controller、简单逻辑的插件
   - 如 email-notification-plugin

### 文档更新

在 `PLUGIN_DEVELOPMENT.md` 中添加以下内容：

> ## 复杂插件开发
>
> 如果你的插件需要注册 HTTP 路由或使用 NestJS 依赖注入，请继续使用**对象式插件接口**。
>
> 详见：[复杂插件迁移指南](./PLUGIN_MIGRATION_COMPLEX.md)

---

**文档结束**
