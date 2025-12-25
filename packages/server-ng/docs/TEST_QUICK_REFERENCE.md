# 测试组织快速参考

**一页速查** | [完整指南](./TEST_ORGANIZATION_GUIDE.md)

---

## 🎯 三大核心原则

```
1️⃣ 一对一：每个源文件只有一个对应测试文件
2️⃣ 就近：测试文件与源文件在同一目录
3️⃣ 场景拆分：>800 行时使用描述性后缀拆分
```

---

## ✅ 正确示例

### 基础结构
```
src/modules/article/
├── article.service.ts
└── article.service.spec.ts           ✅ 唯一测试文件
```

### 场景拆分（>800 行时）
```
src/modules/media/services/
├── media.service.ts
├── media.service.spec.ts               ✅ 核心 CRUD (500 行)
├── media.service.concurrency.spec.ts   ✅ 并发场景 (300 行)
└── media.service.batch-limits.spec.ts  ✅ 批量限制 (200 行)
```

---

## ❌ 错误示例

### 错误 1：父子目录重复
```
src/modules/media/
├── services/
│   ├── media.service.ts
│   └── media.service.spec.ts         ✅ 保留这个
└── media.service.spec.ts             ❌ 删除！重复且误导
```

### 错误 2：模糊命名
```
media.service.spec.ts                 ✅ 核心测试
media.service.2.spec.ts               ❌ 用什么？不清楚！
media.service.concurrency.spec.ts     ✅ 清晰的场景名
```

### 错误 3：混合后缀
```
article.service.spec.ts               ✅ Vitest 标准
article.service.test.ts               ❌ 混淆！
article.service.fixtures.spec.ts      ❌ 已废弃
```

---

## 📋 场景拆分后缀

| 场景 | 后缀 | 示例 |
|------|------|------|
| 并发 | `.concurrency.spec.ts` | `upload.concurrency.spec.ts` |
| 批量 | `.batch-limits.spec.ts` | `delete.batch-limits.spec.ts` |
| 事务 | `.transaction.spec.ts` | `order.transaction.spec.ts` |
| 性能 | `.performance.spec.ts` | `search.performance.spec.ts` |
| 边界 | `.edge-cases.spec.ts` | `validation.edge-cases.spec.ts` |
| 搜索 | `.search.spec.ts` | `article.search.spec.ts` |
| 权限 | `.permissions.spec.ts` | `resource.permissions.spec.ts` |
| 密码 | `.password.spec.ts` | `category.password.spec.ts` |

---

## 🔍 新建测试检查清单

创建测试文件前，问自己：

```
□ 测试文件与源文件在同一目录吗？
□ 使用了 .spec.ts 后缀吗？
□ 文件名清晰表达测试内容吗？
□ 没有与现有测试文件重复吗？
□ 如果拆分场景，添加头部注释了吗？
```

---

## 🛠️ 何时拆分？

**触发条件**（满足任一即拆分）：

- ✅ 单文件 **>800 行**
- ✅ 运行时间 **>30 秒**
- ✅ 存在 **明确独立场景**
- ✅ 不同场景需要 **不同 Mock 设置**

**不应拆分**：

- ❌ <800 行
- ❌ 基础 CRUD 测试
- ❌ 相关业务逻辑

---

## 🚀 快速修复命令

### 删除重复的父目录测试
```bash
# 检查是否重复
diff src/modules/media/media.service.spec.ts \
     src/modules/media/services/media.service.spec.ts

# 确认重复后删除
rm src/modules/media/media.service.spec.ts
```

### 重命名为场景测试
```bash
# 如果测试不同内容，重命名为场景
mv src/modules/media/media.service.spec.ts \
   src/modules/media/services/media.service.basic.spec.ts
```

### 验证测试
```bash
pnpm test src/modules/media
```

---

## 📚 相关文档

- [完整测试组织指南](./TEST_ORGANIZATION_GUIDE.md)
- [测试分析报告](./TEST_ANALYSIS_INDEX.md)
- [CLAUDE.md - 测试策略](../CLAUDE.md#测试与质量)

---

**最后更新**: 2025-12-25 | **版本**: 1.0.0
