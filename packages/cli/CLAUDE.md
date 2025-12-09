# cli 模块文档

[根目录](../../CLAUDE.md) > [packages](../) > **cli**

---

## 变更记录 (Changelog)

### 2025-12-09 - 深度补充扫描

- 补充命令详细说明与使用示例
- 记录 resetHttps 工具详细用途
- 添加迁移工具说明

### 2025-12-09 - 初始化

- 初始化模块文档
- 记录基础结构

---

## 模块职责

cli 提供 VanBlog 的命令行工具集，用于数据库管理、系统维护等操作。

**核心职责**：

- HTTPS 设置重置（MongoDB 遗留数据清理）
- 数据库连接测试
- 系统维护脚本

---

## 入口与启动

### 主入口

- **文件**: `resetHttps.js`
- **运行方式**: `node resetHttps.js`

---

## 可用命令

### 1. HTTPS 设置重置工具（resetHttps.js）

**用途**: 重置 VanBlog 遗留版本（MongoDB）中的 HTTPS 设置。

**适用场景**：

- HTTPS 证书配置错误导致服务无法启动
- 需要清除旧的 HTTPS 设置
- 从遗留版本迁移时清理配置

**使用方法**：

```bash
cd packages/cli
node resetHttps.js
```

**交互式流程**：

1. 提示输入 MongoDB 连接 URL（可直接回车使用默认）
2. 默认连接：`mongodb://mongo:27017/vanBlog?authSource=admin`
3. 自动连接数据库并验证
4. 删除 `settings` 集合中的 HTTPS 配置项
5. 输出删除结果与重启提示

**示例输出**：

```
输入 MongoDB 连接 URL（如果看不懂或者使用的默认配置，请直接按回车）:
使用的 MongoDB 连接 URL:  mongodb://mongo:27017/vanBlog?authSource=admin 数据库： vanBlog
尝试连接数据库...
连接数据库成功
删除 HTTPS 设置成功，删除的条目数： 1
重启 vanblog 后生效
```

**错误处理**：

- 连接超时（5 秒）自动退出
- 连接失败显示错误详情
- 删除操作失败时打印错误信息

---

## 关键依赖

| 依赖      | 版本    | 用途           |
| --------- | ------- | -------------- |
| `mongodb` | ^6.14.2 | MongoDB 客户端 |

---

## 技术实现

### resetHttps.js 实现细节

```javascript
// 核心功能
const main = async () => {
  // 1. 读取用户输入的连接 URL
  const uriFromUser = await readString('输入 MongoDB 连接 URL...');

  // 2. 解析数据库名称
  const db = parseDBfromURI(uriToUse);

  // 3. 连接数据库（5 秒超时）
  await tryConnectDB(client);

  // 4. 删除 HTTPS 设置
  await resetHttps(client, db);
};

const resetHttps = async (client, dbName) => {
  const db = client.db(dbName);
  const col = db.collection('settings');

  // 删除 type='https' 的设置项
  const result = await col.deleteOne({ type: 'https' });
  console.log('删除 HTTPS 设置成功，删除的条目数：', result.deletedCount);
};
```

---

## 使用场景

### 场景 1：HTTPS 证书错误导致服务无法启动

```bash
# 症状
# - VanBlog 服务启动后立即崩溃
# - 日志显示 HTTPS 证书路径错误

# 解决方案
cd packages/cli
node resetHttps.js
# 按提示输入 MongoDB 连接 URL（或直接回车）
# 删除成功后重启 VanBlog 服务
```

### 场景 2：从 Docker Compose 部署环境使用

```bash
# 进入容器
docker exec -it vanblog-cli bash

# 运行重置工具
cd /app/packages/cli
node resetHttps.js

# 退出容器并重启服务
exit
docker-compose restart vanblog
```

### 场景 3：自定义 MongoDB 连接

```bash
node resetHttps.js
# 提示时输入：
# mongodb://username:password@custom-host:27017/customDB?authSource=admin
```

---

## 常见问题 (FAQ)

### Q1: 为什么需要这个工具？

VanBlog 遗留版本（server）使用 MongoDB 存储配置，HTTPS 设置存储在 `settings` 集合中。如果证书配置错误，服务可能无法启动。此工具提供快速重置功能，无需手动连接数据库。

### Q2: 会删除其他设置吗？

不会。工具仅删除 `type: 'https'` 的单条记录，其他设置（如站点名称、描述等）不受影响。

### Q3: 适用于 server-ng 吗？

不适用。server-ng 使用 SQLite 数据库，设置存储方式不同。此工具仅适用于遗留 MongoDB 版本。

### Q4: 连接超时怎么办？

- 检查 MongoDB 服务是否运行
- 验证连接 URL 是否正确
- 确认网络连接正常
- 尝试增加超时时间（修改代码中的 5000ms）

---

## 未来扩展

### 计划添加的功能

1. **数据迁移工具**
   - MongoDB 到 SQLite 迁移脚本
   - 批量导入/导出工具

2. **配置管理工具**
   - 批量修改设置
   - 配置备份与恢复

3. **诊断工具**
   - 数据库健康检查
   - 配置一致性验证

---

## 相关文件

```
packages/cli/
├── README.md          # 简要说明
├── package.json       # 依赖配置
├── resetHttps.js      # HTTPS 重置工具
└── CLAUDE.md          # 本文档
```

---

## 开发与调试

### 本地测试

```bash
# 安装依赖
cd packages/cli
npm install

# 运行工具
node resetHttps.js
```

### 添加新命令

1. 在 `packages/cli/` 目录创建新脚本文件（如 `migrateData.js`）
2. 实现命令逻辑
3. 更新 `package.json` 添加脚本入口
4. 更新本文档记录新命令

---

## 注意事项

- 此工具仅适用于 VanBlog 遗留版本（MongoDB）
- 执行前建议备份数据库
- 重置后需重启 VanBlog 服务才能生效
- 生产环境使用前建议先在测试环境验证
