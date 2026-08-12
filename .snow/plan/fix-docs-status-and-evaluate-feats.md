# 修复 docs 计划状态 + 评估剩余 feat 是否需要实现

## Context

用户需求:① 修复 `docs/` 下计划文档的过期状态标记;② 结合当前架构,评估执行计划中仍未实现的 feat 是否还有实现必要。

**背景**:`docs/theme-host-design.md` §9(实施计划,第 528-548 行)的 checkbox 大多仍是 `[ ]`,但对应工作在代码里已全部落地(Phase 1/2 完成、Phase 3 部分完成)。同时架构在实现过程中发生了演进(方向 B:静态资源移交 Caddy、admin 卡牌式选择器 + 实时预览、base/vanblog 双主题),这让「原计划里剩的 4 个未实现 feat」是否需要实现变成了开放问题。

## Analysis

### 现状盘点(已在代码中核实)

| 设计文档 §9 条目                    | 代码现状                                                                                                    | 结论                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Phase 1: 修 entrypoint.prod.sh      | `docker/entrypoint.prod.sh` L86-95 启动 theme host + 健康检查 + 子进程监控                                  | ✅ 已实现                      |
| Phase 1: Dockerfile COPY themes/    | `Dockerfile` L90-98 循环 build 全部 theme;L170-173 symlink → `/var/lib/vanblog/themes`                      | ✅ 已实现                      |
| Phase 2: theme host 核心            | `app/src/theme-host/index.mjs` + `core.mjs`(LRU/5s 轮询/健康端点/graceful shutdown)                         | ✅ 已实现(用 .mjs 而非 .ts)    |
| Phase 2: entrypoint 启动 theme host | 同上 entrypoint                                                                                             | ✅ 已实现                      |
| Phase 2: PB 变更推送/订阅           | `index.mjs` 5s 轮询 pollSiteChanges()                                                                       | ✅ 已实现(轮询方案,非 PB hook) |
| Phase 2: theme base + assetsPrefix  | `themes/shared-config.mjs` 统一注入 base/assetsPrefix                                                       | ✅ 已实现(收敛到共享模块)      |
| Phase 2: admin/site.astro UI        | `site.astro` 卡牌式主题/调色盘选择器 + iframe 实时预览(commit 57afde1d)                                     | ✅ 已实现(比单下拉更进一步)    |
| Phase 2: 集成测试                   | `scripts/test-theme-switch.mjs` + `app/test/lifecycle.test.mjs`                                             | ✅ 已实现                      |
| Phase 3: caddy file_server          | `vault/internal/caddy/static_routes.go` + themeWatcher 自动 resync                                          | ✅ 已实现                      |
| Phase 3: theme.zip 上传             | 上传 UI 缺失;但自动发现已有(themeWatcher + site.astro「重新加载主题」按钮 + listAvailableThemes() 即时读盘) | ⚠️ 部分                        |
| Phase 3: palette migration 三策略   | 字段 + 表单 + recommendedPalette 两级 fallback(silent 实质生效);「prompt」confirm 未接线                    | ⚠️ 部分                        |
| Phase 3: theme marketplace          | 无                                                                                                          | ❌ 远期                        |

### 剩余 4 个 feat 的必要性分析

**Feat 1 — theme.zip 上传 + 解压安装**

- 现状支撑:自动发现已完整(themeWatcher resync Caddy、reload 按钮、theme host 每次即时读盘),只缺「上传 zip」UI。
- **关键阻塞**:`/var/lib/vanblog/themes` 是镜像内 symlink(→`/build/themes`),**非持久卷** → 容器重建即丢失,上传的主题无法持久化。要让上传有意义,须先改 themes 目录为持久卷(更大架构改动)。
- **判断**:单用户自托管换主题走镜像 rebuild 或 `scripts/theme-init.mjs` 脚手架足够;上传能力留给未来 marketplace 配套。**建议延期,不实现**。

**Feat 2 — palette migration「prompt」confirm**

- 现状支撑:silent 已由 recommendedPalette fallback 链生效(用户显式 palette > site.palette > 主题 recommendedPalette > 内置 default);prompt 的「切换前 confirm()」未接线。
- **判断**:设计初衷是防旧「单下拉 + 高级折叠」UI 误切换;现 UI 已是卡牌式 + iframe 实时预览,用户保存前已能直接看到效果,confirm() 属多余摩擦。且用户显式 palette 永远赢。**建议降级(de-scope)**:保留 `paletteMigrationMode` 字段(兼容),文档注明 prompt 语义已被实时预览取代,不改代码。

**Feat 3 — theme marketplace**

- 判断:明确标注「远期」,依赖 Feat 1,单用户无迫切需求。**保持远期,不实现**。

**Feat 4 — 第二个独立测试主题 themes/minimal**

- 现状:`themes/base/theme.json` 描述即「纯布局 + 简单颜色的 minimal 主题,作兜底/降级」;Dockerfile 循环会 build 它;`test-theme-switch.mjs` 头注释已写明「vanblog + base」双主题。E1 意图已被 base 主题覆盖。
- **判断:已满足,无需新建**。

### 净结论

**4 个剩余 feat 均无需现在实现**:2 个已被现状覆盖(Feat 4)或部分覆盖(Feat 1),2 个应明确降级为远期(Feat 3)或去语义化(Feat 2)。纯分析 + 文档决策记录,无代码改动。

## Phases

### Phase 1: 修复 docs/theme-host-design.md §9 过期 checklist

- **Goal**: 让 §9 状态与代码真实状态一致
- **Files**: `docs/theme-host-design.md`
- **Steps**:
  - [ ] Phase 1 两条 `[ ]` → `[x]`(entrypoint / Dockerfile)
  - [ ] Phase 2 六条 `[ ]` → `[x]`,在实现方式不同的条目后追加实现说明(如 `.mjs` 替代 `.ts`、轮询替代 PB hook、卡牌 UI 替代单下拉、shared-config.mjs 收敛)
  - [ ] Phase 3 caddy file_server 一条 `[ ]` → `[x]`;theme.zip 标注「自动发现 ✅ / 上传 ❌」;palette migration 标注「silent ✅ / prompt 未接线」;marketplace 保持 `[ ]` 远期
  - [ ] §9 末尾追加一段「状态说明」,汇总:Phase 1+2 完成日期、架构演进导致的偏差(方向 B 静态移交、卡牌 UI 等)、Phase 3 各条当前处置(延期/去语义化/远期)
- **Done when**: §9 checkbox 与代码一致;`grep -c '\[ \]' docs/theme-host-design.md` 仅剩 marketplace 等真正未做项;文档 markdown 无语法破损

### Phase 2: 记录剩余 feat 决策(文档化,无代码改动)

- **Goal**: 把「不需要现在实现」的结论固化到 docs,供后续维护者参考
- **Files**: `docs/theme-host-design.md`(可并入 Phase 1 的状态说明)或独立小节
- **Steps**:
  - [ ] 在状态说明中明确 4 项处置:
    - theme.zip 上传 → 延期(阻塞:themes 目录非持久卷),现状自动发现已够用
    - prompt 策略 → 去语义化(实时预览取代),保留字段兼容
    - marketplace → 远期,不实现
    - minimal 测试主题 → 已由 base 主题满足,不新建
  - [ ] (可选)在 `scripts/test-theme-switch.mjs` 头注释补充说明 base 即测试用第二主题,避免后人误以为缺 minimal
- **Done when**: 决策记录落盘;无代码/无行为变更;构建与测试不受影响

## Risks & Mitigations

| 风险                               | 影响 | 缓解                                                                             |
| ---------------------------------- | ---- | -------------------------------------------------------------------------------- |
| 文档改动引入 markdown 破损         | 低   | 改动限于 checkbox 字符与追加段落,不重构文档                                      |
| 状态说明与实际实现细节不符         | 中   | 所有结论均来自已核实的代码(entrypoint/Dockerfile/theme-host/shared-config/caddy) |
| 误删 prompt 语义导致字段失效的误读 | 低   | 明确保留字段、不删枚举,仅文档说明其 UX 被预览取代                                |

## Rollback Strategy

- 全部改动为文档内容,`git checkout -- docs/theme-host-design.md`(及可选 test-theme-switch.mjs 注释)即可回滚,无数据/行为影响。

## Completion Summary

**Status**: Completed
**Phases**: 2 / 2

### Results

- **Phase 1**: `docs/theme-host-design.md` §9 全部状态对齐代码 —— Phase 1(2 条)+ Phase 2(6 条)+ Phase 3 caddy 均 `[ ]`→`[x]` 并逐条标注实现偏差(.mjs/轮询/shared-config/卡牌 UI/方向 B);Phase 3 theme.zip 与 palette migration 标注部分状态;marketplace 保留 `[ ]` 远期;§9 末尾追加状态说明 blockquote 记录 4 项处置。
- **Phase 2**: 4 项剩余 feat 处置已文档化 —— theme.zip 上传延期(阻塞:themes 目录非持久卷)、prompt 去语义化(实时预览取代)、marketplace 远期、第二测试主题由 base 满足。`scripts/test-theme-switch.mjs` 头注释补充 base 即测试第二主题说明。

### Verification

- [x] §9 checkbox 与代码一致(`grep` 确认仅剩 theme.zip 上传 / palette prompt / marketplace 为 `[ ]`,均已在行内注明部分/远期)
- [x] markdown 结构无破损(§9 → §10 边界正常,blockquote 闭合)
- [x] git diff 仅 2 个文档文件(+23/-11),无代码/行为变更
- [x] 构建与测试不受影响(纯文档改动)

### 结论(交付给用户)

4 个剩余 feat **均无需现在实现**:theme.zip 上传被非持久卷阻塞应延期、prompt 已被实时预览取代应去语义化、marketplace 属远期、minimal 测试主题已由 `themes/base` 满足。无代码改动是本次的正确范围。
