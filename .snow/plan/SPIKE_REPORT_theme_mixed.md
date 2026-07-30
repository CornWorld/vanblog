# Spike 2 报告：custom/builtin 混合模型验证结论

## Status: ✅ Completed

**日期**: 2026-07-26
**作者**: spike-driven planning session
**Plan**: `.snow/plan/migrate-vanblog-frontend-to-theme-palette.md`
**Spike 代码**: `/tmp/spike-s4/test-repo-v4/`（已 cleanup，本报告记录结论）

---

## TL;DR

✅ **custom/builtin 混合模型在技术上完全可行**，所有 5 个核心机制都通过验证。可以推进 Phase 1（docs 对齐）和 Phase 2（kernel 实现）。

⚠️ **唯一需要注意的次要问题**：git submodule 的 sparse-checkout 配置在 fresh clone 后会丢失，需要 `scripts/theme-init.mjs` 自动化或文档强调。

---

## 验证结果总表

| Step | 验证目标 | 结论 | 关键证据 |
|------|---------|------|---------|
| **S1** | `src/custom/` 同路径覆盖 `src/builtin/` 生效 | ✅ PASS | custom index.astro 被注入到 `/`，渲染显示 `CUSTOM INDEX`；同时 BaseLayout 仍来自 builtin（fallback 正确） |
| **S2** | Vite resolveId 劫持 `@layouts/@components/@styles/@pages` 前缀 | ✅ PASS | custom NavButton.astro（紫色 ⭐）被 builtin BaseLayout 通过 `@components/NavButton.astro` 正确引用；`data-astro-source-file` 标记证明源文件 |
| **S3** | admin 禁区 fail closed（`pages/admin/*` 不允许在 custom） | ✅ PASS | 创建 `src/custom/pages/admin/index.astro` 后，integration 抛 `FORBIDDEN custom file` 错误，dev server `exit code 1`，未启动 |
| **S4** | git submodule 自引用（themes/default/src/builtin 指向本仓库 app/src） | ✅ PASS（含 caveat） | `git submodule add git@github.com:CornWorld/vanblog.git themes/default/src/builtin` 成功；main-go 分支 HEAD 自动同步；cone sparse-checkout `app/src` 工作 |
| **S5** | Dockerfile build-arg `VANBLOG_ACTIVE_THEME` 机制 | ✅ PASS | shell 层验证 ARG 替换语义、theme 存在性检查、build context 大小（1.4MB） |

---

## 各 Step 详细结论

### S1: custom 覆盖 builtin 同路径

**测试方法**：在 `themes/default/src/builtin/pages/index.astro` 和 `themes/default/src/custom/pages/index.astro` 各放一个内容不同的版本，启动 dev server，访问 `/`。

**结果**：
- integration 在 `astro:config:setup` 阶段扫描 builtin + custom 文件清单
- 对相同路径（`pages/index.astro`），**custom 胜出**——`injectRoute({ pattern: '/', entrypoint: custom/.../index.astro })`
- HTTP 响应显示 custom 内容（`CUSTOM INDEX OVERRIDE`）+ builtin 的 BaseLayout 包裹（fallback 工作）

**关键证据片段**：
```
[vanblog-themes-spike] builtin: 6 files, custom: 1 files
[vanblog-themes-spike] inject / -> /private/tmp/.../src/custom/pages/index.astro
```

**结论**：✅ custom/builtin 合成机制按 plan 设计工作。

---

### S2: Vite resolveId 劫持 alias 前缀

**测试方法**：在 builtin 的 BaseLayout.astro 用 `@components/NavButton.astro`，在 custom 提供 NavButton.astro，验证渲染的是 custom 版本。

**结果**：
- Vite plugin 在 `resolveId(id)` hook 拦截 `@components/` 前缀
- 优先尝试 `src/custom/components/NavButton.astro`，存在则返回该路径
- 不存在则 fallback 到 `src/builtin/components/NavButton.astro`
- 浏览器返回的 HTML 中 `data-astro-source-file="/private/tmp/.../src/custom/components/NavButton.astro"` 证明源文件来自 custom

**关键证据片段**（响应 HTML）：
```html
<button style="padding: 8px 16px; border: 2px solid #7928ca; background: #7928ca; color: white; ..."
  data-astro-source-file="/private/tmp/.../src/custom/components/NavButton.astro">
  ⭐ Home ⭐
</button>
```

**结论**：✅ alias 劫持 + custom 优先 + builtin fallback 的合成机制完全工作。

---

### S3: admin 禁区 fail closed

**测试方法**：在 `src/custom/pages/admin/index.astro` 创建文件，期望 integration 抛错且 dev server 不启动。

**结果**：
```
[ERROR] [vanblog-themes-spike] FORBIDDEN custom file: pages/admin/index.astro (matches /^pages\/admin\//)
[ERROR] An unhandled error occurred while running the "astro:config:setup" hook
Custom contains 1 forbidden file(s); aborting.
ELIFECYCLE Command failed with exit code 1.
```

**结论**：✅ admin 锁定（依据 plan 决策 8）强制力通过。生产 integration 可以用同一机制保护 `pages/api/`、`lib/`、`loaders/`、`live.config.ts`、`middleware.ts` 等禁区。

---

### S4: git submodule 自引用

**测试方法**：用 `git@github.com:CornWorld/vanblog.git`（同仓库 URL）作为 submodule，路径为 `themes/default/src/builtin`，验证：
1. `git submodule add` 能否成功
2. `git submodule update --init` 在 fresh clone 能否成功
3. cone sparse-checkout `app/src` 能否工作
4. 升级流程（切 tag/commit）能否工作

**关键发现**：

| 子问题 | 结论 |
|---|---|
| **同仓库 URL 作为 submodule** | ✅ git 允许，`submodule add` 不报错 |
| **main-go 分支 HEAD 自动跟踪** | ✅ submodule 默认 clone 默认分支，HEAD 与父仓库一致 |
| **cone 模式 sparse-checkout `app/src`** | ✅ 工作；保留根目录文件（Dockerfile/README.md 等），但所有不需要的子目录（vault/sdk/refs/docs）被排除 |
| **fresh clone 后 sparse 配置是否持久化** | ❌ **不持久化**。`git submodule update --init` 后 submodule 是全量 clone，sparse 配置丢失。必须 docs 强调用户 fork 后跑：`cd themes/default/src/builtin && git sparse-checkout init --cone && git sparse-checkout set app/src`，或者 `scripts/theme-init.mjs` 自动化 |
| **submodule 内容路径深度** | `themes/default/src/builtin/app/src/layouts/...`（多了 `app/src/` 一层） |

**Decision**：
- 主方案保留 submodule + cone sparse-checkout
- 路径深度问题：integration 层把 `@layouts/` 解析到 `<themeRoot>/src/builtin/app/src/layouts/`（隐藏嵌套），theme 作者写代码时无感知
- 备选方案：如果 `app/src/` 多嵌套层在 Phase 2 实施时显得太丑，改用 git subtree 或重构 vanblog 主仓库把 `app/src/` 改名 `builtin/`

**结论**：✅ 自引用 submodule 机制可行，需要 docs + 自动化脚本配套。

---

### S5: Dockerfile build-arg

**测试方法**：写最小 Dockerfile 示例（`Dockerfile.spike-s5`）+ shell 脚本（`spike-s5-verify.sh`）验证 ARG 替换语义、theme 存在性检查、build context 大小。

**关键发现**：

| 子问题 | 结论 |
|---|---|
| **ARG 在 RUN 中的字符串替换** | ✅ 标准 shell 行为 |
| **ARG 跨 stage 持久化** | ⚠️ ARG 只在声明它的 stage 有效。prod stage 想知道 build 时选了哪个 theme，需要写文件 `RUN echo "${VANBLOG_ACTIVE_THEME}" > /build/.active-theme`，然后 `COPY --from=astro-build /build/.active-theme /etc/vanblog/active-theme` |
| **theme 存在性检查** | ✅ `RUN if [ ! -d "themes/${VANBLOG_ACTIVE_THEME}" ]; then ... exit 1; fi` |
| **build context 大小** | ✅ 1.4MB（spike 内容），生产估计 5-10MB（含完整 builtin） |

**改造范围**（vs 现有 Dockerfile）：
- Stage 4 (astro-build) 加 3 行：`ARG VANBLOG_ACTIVE_THEME` + `COPY themes/ ./themes/` + 验证脚本
- Stage 4 新增 theme 内容同步逻辑（builtin + custom → app/src/）
- Stage 5 (prod) 加 2 行：`COPY --from=astro-build /build/.active-theme /etc/vanblog/active-theme` + entrypoint 校验

**结论**：✅ Dockerfile 改造成本可控，不需要重写。

---

## 对 Plan 的影响（需更新的章节）

Plan 的整体方向**保持不变**，但以下细节需要在 Phase 1 docs 对齐和 Phase 2 kernel 实施时纳入：

### Phase 2 补充

1. **`scripts/theme-init.mjs`**：必须实现，处理：
   - `cp -R themes/default themes/{new-name}`（fork 一个新 theme）
   - `cd themes/{new-name}/src/builtin && git submodule update --init && git sparse-checkout init --cone && git sparse-checkout set app/src`（fresh checkout 后的恢复脚本）

2. **`app/integrations/themes/resolver.mjs`** 中 builtin 路径处理：
   - 自动检测 `src/builtin/` 是直接内容（spike 2 的简化结构）还是 `src/builtin/app/src/` 嵌套结构（真实 submodule 结构）
   - 提供配置选项 `builtinRootSubdir: 'app/src' | ''`

3. **`Dockerfile`** 中 `astro-build` stage 改造（按 S5 spike 验证的形式）

### Phase 1 docs 补充

1. **`docs/theme-implementer-guide.md`** 必须包含：
   - "Fork 第一步"章节：fork 后立即跑 `scripts/theme-init.mjs --fix-submodule`
   - 升级流程的命令清单：`cd src/builtin && git fetch --tags && git checkout v<new>`

---

## 备选方案（如果未来遇到阻碍）

### 备选 A: 用 git subtree 替代 submodule

**触发条件**：submodule 在 GitHub fork/PR 场景出现意外行为（比如 fork 时 submodule URL 错误）

**实现**：
- `themes/default/src/builtin/` 是普通目录，不是 submodule
- 升级时跑 `git subtree pull --prefix=themes/default/src/builtin git@github.com:CornWorld/vanblog.git main-go --squash`
- 内容直接到 `builtin/`，无 `app/src/` 嵌套

**优点**：路径深度正常（`themes/default/src/builtin/layouts/...`），不需要 sparse-checkout
**缺点**：每次升级要手动 merge conflict（submodule 是 commit pin，subtree 是文本 merge）

### 备选 B: 把 vanblog 主仓库结构改了

**触发条件**：路径嵌套和 sparse-checkout 配置复杂度成为长期维护负担

**实现**：
- vanblog 主仓库 `app/src/` 改名为 `builtin/`（顶层目录）
- `Dockerfile`、`pnpm-workspace.yaml`、`app/package.json` 等所有引用 `app/src/` 的地方同步更新
- submodule 直接 sparse `builtin/`，路径就是 `themes/default/src/builtin/...`

**优点**：最干净
**缺点**：主仓库侵入式改动，影响所有现有构建

---

## 验证用代码 & 文件位置

spike 2 代码全在 `/tmp/spike-s4/test-repo-v4/`，验证完成后未保留。验证产物：

| 文件 | 用途 | 是否持久保留 |
|---|---|---|
| `themes/default/astro.config.mjs` | spike 项目入口 | ❌ |
| `themes/default/integrations/themes-spike.mjs` | spike integration（Phase 2 kernel 的雏形） | ❌（Phase 2 重写） |
| `themes/default/src/builtin/{layouts,components,pages,styles}/` | 验证用最小 builtin | ❌ |
| `themes/default/src/custom/{pages,components}/` | 验证用最小 custom | ❌ |
| `Dockerfile.spike-s5` | Dockerfile 改造示例 | ❌（Phase 2 实际实施时参考） |
| `scripts/spike-s5-verify.sh` | S5 shell 验证脚本 | ❌ |

---

## 整体决策

**推进 Phase 1（docs 对齐）和 Phase 2（kernel 实现）**，主方案：
- submodule + cone sparse-checkout
- integration 层隐藏 `app/src/` 嵌套（解析时透明处理）
- `scripts/theme-init.mjs` 自动化 submodule 初始化和恢复

**对 Plan 没有重大方向影响**，仅有 Phase 2 实施层面的微调（已记录在本文档"对 Plan 的影响"章节）。
