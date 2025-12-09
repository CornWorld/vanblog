# server 模块文档（已废弃）

[根目录](../../CLAUDE.md) > [packages](../) > **server (已废弃)**

---

## 模块职责

**⚠️ 注意：此模块已废弃，正在被 server-ng 替代。**

server 是 VanBlog 的遗留 API 服务器，基于 NestJS + Mongoose（MongoDB）构建。

**核心职责**（遗留）：

- 提供 v1 API
- MongoDB 数据持久化
- 用户认证与授权
- 文章、草稿管理

**为何废弃**：

- 替换为 Drizzle ORM + SQLite（更轻量）
- 替换为 ts-rest 类型安全契约
- 不再维护 v1 API

---

## 迁移指南

### 从 server 迁移到 server-ng

1. **数据迁移**：运行数据迁移脚本（待实现）
2. **API 调用**：更新客户端使用 v2 API
3. **环境变量**：更新配置（MongoDB → SQLite）

### v1 API 弃用时间表

- **当前状态**：v1 API 仍可访问，但会返回弃用警告
- **计划移除**：待定

---

## 相关文件清单

```
src/
├── main.ts                    # 应用入口（NestJS）
├── app.module.ts              # 根模块
└── modules/                   # 功能模块（基于 Mongoose）
```

---

## 变更记录

### 2025-12-09

- 标记为已废弃
- 建议迁移到 server-ng
