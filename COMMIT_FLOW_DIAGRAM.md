# Commit 拆分流程图

```
原有 4 个粗粒度 Commits
=======================

d4d4b75c  ─┐
feat      │  7 files  - Pipeline 模块
          │
4c841279  ├┐
test      ││ 200 files - 测试重构
          ││
1a5c8490  │├┐
refactor  │││ 113 files - Logger 回退
          │││
09be467e  ││├┐
chore     │││└ 19 files - 配置清理
          │││
          │││
          ▼▼▼

拆分为 15 个细粒度 Commits
==========================

feat(pipeline): Schema & Entity/DTO      [1] ───┐
feat(pipeline): Service 实现             [2] ───┤
feat(pipeline): Controller & API         [3] ───┤  Pipeline
test(pipeline): 单元测试                 [4] ───┘  功能组
                                                   (4 commits)

test(core): 基础设施测试                 [5] ───┐
test(database): 数据库层测试             [6] ───┤
test(config): 配置模块测试               [7] ───┤
test(auth): 认证模块测试                 [8] ───┤
test(category): 分类模块测试             [9] ───┤  测试重构
test(analytics): 分析模块测试            [10] ──┤  (7 commits)
test(modules): 其他模块测试              [11] ──┘

chore(plugins): 删除过时插件             [12] ────  清理工作
                                                   (1 commit)

refactor(admin): Logger 回退             [13] ──┐
refactor(website): Logger 回退           [14] ──┘  前端重构
                                                   (2 commits)

chore(server-ng): 配置清理               [15] ────  文档工具
                                                   (1 commit)

执行顺序：1 → 2 → 3 → 4 → 5 → ... → 15
```

---

## 按类型分组

### 功能开发 (feat) - 4 commits
```
1. feat(pipeline): Schema & Entity/DTO (7 files, +150 lines)
2. feat(pipeline): Service 实现 (2 files, +438 lines)
3. feat(pipeline): Controller & API (1 file, +119 lines)
4. test(pipeline): 单元测试 (2 files, +690 lines)
```

### 测试重构 (test) - 7 commits
```
5.  test(core): 基础设施 (8 files, +800/-80 lines)
6.  test(database): 数据库层 (5 files, +1200 lines)
7.  test(config): 配置模块 (4 files, +1283/-132 lines)
8.  test(auth): 认证模块 (10 files, +3500/-184 lines)
9.  test(category): 分类模块 (11 files, +3500 lines)
10. test(analytics): 分析模块 (7 files, +3300/-400 lines)
11. test(modules): 其他模块 (30+ files, +15000/-1500 lines)
```

### 代码重构 (refactor) - 2 commits
```
13. refactor(admin): Logger 回退 (57 files, ~200 changes)
14. refactor(website): Logger 回退 (56 files, ~200 changes)
```

### 维护清理 (chore) - 2 commits
```
12. chore(plugins): 删除过时插件 (8 files, -2000 lines)
15. chore(server-ng): 配置清理 (11 files, +2537/-45 lines)
```

---

## 按影响范围分组

### 后端 (server-ng) - 11 commits
```
Pipeline: #1, #2, #3, #4
Tests:    #5, #6, #7, #8, #9, #10, #11
Cleanup:  #12, #15
```

### 前端 (admin/website) - 2 commits
```
Admin:   #13
Website: #14
```

### 共享 (shared) - 1 commit
```
Pipeline Schema: #1 (部分)
```

---

## 关键里程碑

```
[Milestone 1] Commits 1-4 完成
└─> Pipeline 模块完整实现 + 测试覆盖

[Milestone 2] Commits 5-7 完成
└─> 核心基础设施测试完成

[Milestone 3] Commits 8-11 完成
└─> 所有模块测试重构完成 (Phase 2)

[Milestone 4] Commit 12 完成
└─> 过时插件清理完成

[Milestone 5] Commits 13-14 完成
└─> 前端 Logger 策略调整完成

[Milestone 6] Commit 15 完成
└─> 配置优化与文档完善
```

---

## 验证点

每个里程碑后的验证步骤：

| 里程碑 | 验证命令 | 预期结果 |
|--------|----------|----------|
| M1 | `pnpm --filter @vanblog/server-ng test pipeline` | Pipeline 测试全部通过 |
| M2 | `pnpm --filter @vanblog/server-ng test "src/core\|src/database\|src/config"` | 基础设施测试通过 |
| M3 | `pnpm --filter @vanblog/server-ng test:cov` | 覆盖率 ≥ 80% |
| M4 | `ls plugins/` | book-manager, read-time 已删除 |
| M5 | `git diff HEAD~2 --stat \| grep "packages/admin\|packages/website"` | 113 files changed |
| M6 | `git log --oneline -15` | 15 个 commits 清晰可见 |

---

**生成时间**: 2025-12-25
