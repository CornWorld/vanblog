# Live2D Companion Demo Pack

## Status: ✅ Completed

## Context

新增一个只通过 `packs/` 实现的 demo Pack，展示 Pack 作为功能扩展单元的能力，而不修改 Vanblog 既有 Go、Astro integration、layout、SDK 或构建代码。

候选方向是一个 Live2D 风格的站点陪伴小人（Live2D Companion）：Pack 自带配置、CSS、JavaScript 和公开演示页面，主要调用已有的浏览器端 Live2D/widget 库能力，并通过 Pack 页面完成资源装配。

重要边界：当前 Pack v1 contract 只自动注入 `pages/index.astro` 为 `/p/<pack>`，不会把 Pack 的 CSS/JS 全局注入所有既有站点页面，也不会读取 fat `pack.json` 配置。因此在“不修改已有 Vanblog 代码”的约束下，本实现将把 CSS/JS 注入限定在 Pack 自己的 `/p/live2d-companion` 页面内部；Pack 配置放在 Pack 自己的源码模块中，而不是扩展 `pack.json`。

## Analysis

- **Affected files**:
  - 无既有 Vanblog 文件修改。
- **New files**:
  - `packs/live2d-companion/pack.json`：最小 Pack identity。
  - `packs/live2d-companion/pack.ts`：公开页面标题和导航元数据。
  - `packs/live2d-companion/pages/index.astro`：Live2D Companion demo 页面和页面级 CSS/JS 装配入口。
  - `packs/live2d-companion/lib/config.ts`：Pack 内部可编辑配置（模型地址、位置、尺寸、问候语、交互开关）。
  - `packs/live2d-companion/lib/widget.ts`：浏览器端 widget loader、初始化、拖拽/点击交互和降级处理。
  - `packs/live2d-companion/styles/companion.css`：命名空间化 CSS，避免污染站点已有样式。
  - `packs/live2d-companion/assets/`：如实现需要的本地占位/提示资源；默认优先使用可配置的远程模型 URL，不把大模型二进制提交进仓库。
- **Dependencies**:
  - 现有 Astro Pack page injection 和 `vanblog:theme` host。
  - 浏览器端 Live2D/widget library；优先使用页面内可配置的 CDN loader，必须有加载失败后的静态占位降级，不改变生产 Go/Node runtime。
  - 不新增根目录依赖、不修改 `package.json`、不修改 Astro integration。
- **Complexity**: medium。
- **Risk areas**:
  - 外部模型/CDN 不可用时页面不能崩溃。
  - CSS/DOM 必须全部命名空间化，避免覆盖主题页面。
  - 不得把配置塞进严格的 `pack.json`，也不得假设当前 registry 会全局注入资源。
  - 第三方脚本 URL 和模型 URL 需要明确可替换并避免无条件执行不可信 inline code。

## Phases

### Phase 1: Pack identity and demo contract

- **Goal**: 建立一个可被现有 discovery/resolver 自动发现的最小 Pack。
- **Files**: `packs/live2d-companion/pack.json`, `packs/live2d-companion/pack.ts`。
- **Steps**:
  - [ ] 创建合法 identity：`name: live2d-companion`、SemVer version。
  - [ ] 添加标题和 `/p/live2d-companion` 导航元数据。
  - [ ] 保持 `pack.json` 只有 `name` 与 `version`。
- **Done when**: 现有 Pack discovery 能发现该目录，且不需要修改任何 Vanblog 源码。

### Phase 2: Self-contained Live2D Companion page

- **Goal**: 在 Pack 自己的公开页面内完成配置、CSS/JS 注入和 widget 交互。
- **Files**: `pages/index.astro`, `lib/config.ts`, `lib/widget.ts`, `styles/companion.css`。
- **Steps**:
  - [ ] 在 `config.ts` 定义可编辑配置：enabled、model URL、script URL、尺寸、位置、问候语和 reduced-motion 行为。
  - [ ] 页面只加载本 Pack 的 CSS 和 JS；使用 `data-live2d-companion` 命名空间，避免污染宿主主题。
  - [ ] `widget.ts` 实现 script/model loader、初始化、loading/error/fallback 状态、关闭/重新打开和基础拖拽或点击交互。
  - [ ] 加入 `prefers-reduced-motion`、键盘可用性和第三方资源加载失败降级。
- **Done when**: `/p/live2d-companion` 是完整可用的 demo；第三方资源成功、失败、禁用和 reduced-motion 场景均不导致页面 runtime crash。

### Phase 3: Verification and Pack-only acceptance

- **Goal**: 证明新能力完全由 Pack 提供，没有改动 Vanblog 既有代码。
- **Files**: 仅新建的 `packs/live2d-companion/*`。
- **Steps**:
  - [ ] 运行现有 Pack resolver tests、Astro check 和 Astro build。
  - [ ] 检查页面生成的 `/p/live2d-companion` route、CSS/JS 命名空间和 fallback 文案。
  - [ ] 检查 `git diff` 中既有 Vanblog 文件没有被修改；不触碰现有无关 dirty files。
  - [ ] 如第三方库实际 API 与预期不符，优先在 Pack 内调整 loader，不修改宿主代码。
- **Done when**: Pack tests/check/build 通过，页面可访问，且变更范围仅为新 Pack 文件；无诊断错误、无构建错误、无运行时崩溃。

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 当前 registry 不支持全局 CSS/JS 注入 | 无法让小人出现在所有既有页面 | 明确 demo 页面级注入；若未来要全局注入，另开宿主 integration capability 任务，不在本次违反约束 |
| CDN/模型不可用 | demo 空白或页面报错 | 超时、catch、静态 fallback、重新加载按钮；所有异常限制在 Pack 页面 |
| 第三方脚本污染全局 | 与宿主页面冲突 | 使用 iframe 或唯一 DOM/CSS namespace；优先选择不会覆盖主题 CSS 的 widget API |
| `pack.json` 配置扩展破坏 identity contract | Pack discovery/build 失败 | 配置放入 `lib/config.ts`，identity 文件保持最小 |
| 模型资源过大 | 仓库膨胀和构建变慢 | 不提交模型二进制；使用可替换 URL，并提供无模型 fallback |

## Rollback Strategy

删除新增的 `packs/live2d-companion/` 目录即可回滚。本任务不修改既有 Vanblog 文件、依赖、构建脚本或运行时配置，因此不会改变现有 Pack 和主站行为。

## Acceptance Criteria

- [ ] 只新增 `packs/live2d-companion/*`，不修改既有 Vanblog 代码。
- [ ] Pack identity 严格符合现有 discovery contract。
- [ ] `/p/live2d-companion` 页面可构建并可访问。
- [ ] CSS/JS 只在 Pack 页面内注入且有 namespace。
- [ ] Live2D/widget 资源加载失败时有可见 fallback，不产生未处理异常。
- [ ] 无障碍和 reduced-motion 基本行为可用。
- [ ] Pack resolver、Astro check、Astro build 通过。
- [ ] 无诊断错误、无构建错误、无 runtime crash。
