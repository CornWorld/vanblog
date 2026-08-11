# 提交当前改动 + 继续实现 theme 剩余工作（palette / admin 切换 UI / 轻量 upgrade_diff）

## Context

用户指令：**先提交 → 然后继续实现**；并明确约束：**`upgrade_diff` 不应该过重，需要从长计议**。

当前工作区有 6 个未提交文件（agent/pi 相关收尾）。但深入核查发现其中 **3 处是「清理过度」导致的回归**——把上一轮已验证的修复删掉了：

| 文件 | 工作区改动 | 判定 |
| --- | --- | --- |
| `vault/main.go` | **删除了** `app.RootCmd.ParseFlags(os.Args[1:])` 修复（+注释） | ❌ **回归**。该修复正是上轮「隔离容器 vol 重测」验证的核心修复：PocketBase `New()` 会 eager parse flags，而 pack 解析块在 `app.Start()` 之前执行，没有强制再解析则 `--packsDir`/`--builtinPacksDir` 恒为空 → user pack 永不加载 |
| `eslint.config.js` | **删除了** eb8c428a 刚加的 `scripts/**/*.mjs` Node globals 块（console/process/Buffer） | ❌ **回归**。`no-undef` 会让 `scripts/*.mjs` lint 报错 |
| `vault/internal/agent/agent.go` | SSE 循环里 `w.Write(line)` 不再检查错误、不再 break | ⚠️ 轻微。断连客户端不再被提前检测（上游 pi 关闭后自然结束，实际影响有限） |
| `.pi/settings.json` | 加 `model`/`defaultModel` = `opencode/zen/deepseek-v4-flash-free` | ✅ 安全（模型名统一） |
| `scripts/init-pi-config.mjs` | fallback 模型名加 `opencode/` 前缀 | ✅ 安全（与 settings.json 对齐） |
| `scripts/pi-rpc-server.mjs` | 命名 `_reject`→`reject`、空 catch 清理、`pending` 数组 | ✅ 安全（轻微清理） |

> `vault` 目录 `go build ./...` 已通过（语法 OK，回归是**运行时 flag 时序**问题，编译测不出）。

「继续实现」锚点 = `.snow/plan/migrate-vanblog-frontend-to-theme-palette.md` 剩余 Phase 5/6/7（已执行备注里写明余量：palette 多套内置、MCP tools、admin 切换 UI）。`upgrade_diff` 是 Phase 7 的 MCP tool，用户要求**做轻**。

---

## Phase A：修复回归并提交（先提交）

- **Goal**：把工作区整理成「无回归、可提交」的状态并提交。
- **Files**：`vault/main.go`、`eslint.config.js`、`vault/internal/agent/agent.go`、`.pi/settings.json`、`scripts/init-pi-config.mjs`、`scripts/pi-rpc-server.mjs`
- **Steps**：
  - [ ] `vault/main.go`：在 flag 注册后、pack 解析前恢复 `app.RootCmd.ParseFlags(os.Args[1:])` + 原注释（git 恢复该 hunk）
  - [ ] `eslint.config.js`：恢复 `scripts/**/*.mjs` / `*.mjs` / `models.config.mjs` 的 Node globals 块
  - [ ] `agent.go`：恢复 `w.Write(line)` 的错误检查 + break（客户端断连即停）
  - [ ] 保留其余 3 个文件的改动
  - [ ] 验证：`cd vault && go build ./... && go vet ./...`；`npx eslint scripts/*.mjs`（应 0 error）
  - [ ] 检查 `git diff` 只剩预期改动，然后 commit（message 说明「agent/pi 收尾 + 修复清理过度回归」）
- **Done when**：commit 落地；build/vet/eslint 全绿；`git status` 干净

## Phase B：Palette 系统完善（原 Phase 5）

- **Goal**：从「default 单一 palette」到「多套 builtin palette + 可切换」。
- **Files**：
  - `hooks/palettes/`：新增 midnight / solarized / rose-pine / catppuccin（tokens.css + typography.css + components.css + palette.json，参考现有 vanblog-classic 结构）
  - `vault/internal/palette/routes.go`：`servePalettes`/`servePaletteCSS` 支持 dark/light 双套（palette.json 加 `supports`/`type` 语义；按 site.defaultTheme 选 token 集）
  - `app/src/layouts/BaseLayout.astro`：palette 与 defaultTheme(auto/light/dark) 联动
  - `app/src/pages/api/palette.css` 或后端端点完善
  - CI lint 规则：builtin 文件禁 hardcode 颜色（追加到 eslint/脚本）
- **Steps**：
  - [ ] 定 palette.json schema（name/label/version/author/supports）
  - [ ] 实现 4-5 个 builtin palette
  - [ ] 完善 palette.css 端点（light/dark 双 token 集）
  - [ ] BaseLayout dark mode + palette 联动
  - [ ] hardcode 颜色 CI 检查
- **Done when**：≥4 个 palette 可切换；light/dark/auto 三态正确；无需 rebuild 刷新即生效；hardcode 颜色检查能 catch

## Phase C：admin 切换 UI（原 Phase 6）

- **Goal**：admin/site 页有 theme/palette 管理面板 + 预览。
- **Files**：
  - `app/src/components/admin/ThemeCard.astro` / `PaletteCard.astro`
  - `app/src/pages/admin/site.astro`（完善为 grid 卡片 + dev/prod 提示）
  - `app/src/pages/api/preview.astro`（★ 新端点：theme+palette 临时覆盖的 SSR 预览 HTML）
- **Steps**：
  - [ ] ThemeCard/PaletteCard 组件
  - [ ] site.astro 卡片化排版 + 当前选中态
  - [ ] dev 即时切换 / prod 提示重建
  - [ ] preview 端点（仅 admin）
- **Done when**：卡片列出全部 theme/palette；点击切换（dev）或提示重建（prod）；preview iframe 正确渲染

## Phase D：MCP tools + **轻量 upgrade_diff**（原 Phase 7，修订为轻量版）

- **Goal**：给 agent 提供读写 theme/palette、预览、build、读 schema 的能力；其中 `upgrade_diff` **做轻**。
- **修订说明（「从长计议」落地）**：
  - ❌ 弃用重型方案：Go 里的 git-range 分类引擎（`git diff <old>..<new>` → L0/L1/L2 分类）+ 与 CI `contract-diff.mjs` 共享逻辑的双组件设计。
  - ✅ 轻量方案：`scripts/upgrade-diff.mjs`（单脚本、无 git 历史依赖）——只回答 theme 作者真正的问题：「我的 override 还匹配当前 base 吗」：
    1. 扫 `themes/<n>/src/base-overrides/`
    2. 与**当前** `app/src/<rel>` 静态对比：base 已删除 → orphaned；存在但内容不同 → 待人工过目清单；frontmatter `---` 块（L0 契约变量）有增删 → 标「L0 contract drift」
    3. 纯文本输出
  - MCP 侧：`upgrade_diff` 工具 ~30 行，shell 调脚本回显 stdout；不建分类引擎。
  - CI 契约强制（contract-diff 进 CI）**暂缓**，作为长期决策项记录在 docs（不做门禁）。
- **Files**：
  - `vault/internal/mcp/`（★ 新建 Go 包）：`read_file`/`write_file`/`list_dir`/`preview`/`build`/`pb_schema`/`pb_query`/`upgrade_diff`
  - `scripts/upgrade-diff.mjs`（★ 新增轻量脚本）
  - `sdk/src/services.ts`（mcp 命名空间）
  - `docs/theme-implementer-guide.md`（MCP tools 章节 + 轻量 upgrade_diff 说明）
- **Steps**：
  - [ ] 写 `upgrade-diff.mjs` 并手动验证（改一个 override 后输出正确）
  - [ ] Go 实现 8 个 handler（路径白名单：`themes/*/src/` + `hooks/palettes/`；禁区 403；`pb_query` 仅 GET）
  - [ ] `upgrade_diff` 薄封装调脚本
  - [ ] SDK 命名空间 + 文档
- **Done when**：curl 模拟 8 端点全通；越权写路径全 403；`pb_query` POST 被拒；`upgrade-diff.mjs` 输出符合预期；SDK 过 astro check

---

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 直接 commit 会把 main.go/eslint 回归带进历史 | user pack 加载静默坏 + lint 红 | Phase A 先恢复回归再提交；提交前 git diff 复查 |
| ParseFlags 恢复后再被「清理」 | 重复回归 | 恢复时保留明确注释说明时序原因；notebook 记录 |
| palette 多套实现工作量大 | 战线拉长 | 按 schema 先做 2-3 套高质量，再补足到 4-5 |
| upgrade_diff 又滑回重型 | 违背用户约束 | 只实现轻量静态对比，CI 门禁记为长期项不入代码 |

## Rollback Strategy

- 提交前：`git checkout -- <file>` 可丢弃任意文件改动；回归修复不涉及新文件。
- 提交后：如需回滚 `git reset --soft HEAD~1` 退回提交前工作区状态。
- MCP/palette 新文件：全部新增，删除即可回滚，不触碰既有平台层逻辑。
