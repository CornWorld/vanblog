---
name: tailwind-v4-migration
description: VanBlog 主题的 Tailwind v3→v4 迁移审计。把上游 mereithhh(v3.3.5 语义)组件 vendor 进本仓 v4 主题、修改 vendored React 组件/Astro 模板的 class、排查"类名在 DOM 里但样式没生效/视觉变了"、暗色或调色盘回归、或任何涉及 themes/vanblog 与 app/src 的 Tailwind 类增删时,必须使用本 skill。用户提到 Tailwind 升级、样式静默失效、迁移手册、vendored 组件样式对不齐时也触发——即使没明说"迁移"。
---

# Tailwind v3→v4 迁移审计(VanBlog 主题)

本文件只写流程编排与检查清单。领域决策背景读 `docs/developer/vendor-islands-design.md`(兼容层原则 + 实现偏离对照表);官方权威清单读 <https://tailwindcss.com/docs/upgrade-guide>。

## 为什么需要专门流程

上游组件按 Tailwind v3.3.5 语义书写,主题运行在 v4(`@import "tailwindcss"` + `@tailwindcss/vite`)。v4 的破坏性变更(废弃类移除、改名、默认值变化、变体生成规则变化)全部**静默失效**:DOM 里类名还在,css 规则没生成或值不同。DOM diff 校验发现不了,必须按类名审计 + 产物实测。

## 工作流

1. **读背景**:`docs/developer/vendor-islands-design.md` 的"兼容层原则"与"实现偏离对照表"——已裁定的偏离与登记项,避免重复决策。
2. **读官方手册**:拉取 upgrade-guide 全文,提取当版实际生效的变更清单(以实测版本为准,见下"已知陷阱"的教训:手册说移除的类,当前版本可能仍出等值别名,以构建产物实测为准)。
3. **类名审计**(并行分片,模式见下节)。
4. **集中修复**:主会话统一改,不分散给 scout;禁区只登记不改。
5. **三层验证**(见"验证"节)后提交,并把新裁定追加进偏离对照表。

## 类名审计分片(4 个只读 scout 并行)

| 分片 | 范围 | 方法 |
|---|---|---|
| RenameRemoved | 两棵树 src 下 `.astro/.tsx/.ts/.css` | token 边界 grep(前后非 `[A-Za-z0-9_-]`);shadow/rounded/blur/ring 按裸用与带后缀分开统计 |
| BorderDefaults | 同上 | 找宽度类(`border`/`border-{side}`/`divide-{xy}`/`border-{n}`)后**同串无任何 border 色**的命中;对手写类追配套 CSS 兜底,对插值类串追变量定义 |
| SpaceButtonsStyle | 同上 | `space-[xy]-`/`divide-` 子元素 display 核验;`<button>`/`[role=button]` 无 cursor 类;`hidden` 属性与 display 类混用;`.astro` 内 `<style>` 的 @apply |
| RuntimeVerify | 主题构建产物 | 唯一允许跑 build;对每类疑点构造完整规则片段探针,报"生成/未生成 + 实际值" |

**每条命中必须人工核验上下文再定级**:grep 命中 ≠ 需要修(同串带色、组件样式兜底、插值分支齐全都是假阳性)。

## 已知陷阱清单(v4.3.2 实测,2026-09)

| v3 语义 | v4 行为 | 处置 |
|---|---|---|
| `flex-grow/shrink(-0)?` | 手册标移除,**实测仍生成等值别名** | 改 `grow/shrink`(前瞻防移除) |
| `rounded-sm` = 0.125rem | = 0.25rem(翻倍) | 保 v3 视觉用 `rounded-xs` |
| `border`/`divide`/`hr` 无显式色 | 落 currentColor(v3 落 gray-200) | 补显式色;上游用默认色时补 `border-gray-200`(上游 literal) |
| button cursor pointer | default | 两树 global.css `@layer base` 加 `button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer }`(官方推荐写法) |
| `space-*`/`divide-*` 用 `* + *` margin-top/left | 翻转为 `:not(:last-child)` margin-bottom/right | 子元素同质块级/flex 时等价;内联子元素逐个核验 |
| v3 `outline-none`(隐形 outline) | 真取消(`outline-hidden` 才是旧语义) | 有 ring 兜底时视觉一致,可不动 |
| `@layer components` 手写类无变体生成 | v4 不为自定义类生成 `dark:*` 等变体 | 暗色手写变体须显式规则(如 `.dark .dark\:text-dark{…}`),已沉淀在 `src/styles/vendor/upstream-globals.css` |
| `.astro` `<style>` 块内 @apply | 独立样式表看不到 theme | 加 `@reference`,或移到 global.css |
| `[hidden]` vs display 类 | v4 `!important` 保证 hidden 胜出 | JS 切换统一走 classList 切 hidden class |
| `shadow-sm`/`blur-sm`/`backdrop-blur-sm` 等改名 | `-sm` 值变为旧"裸"值 | 零命中则无风险;命中时按手册改名 |

## 修复原则

- 上游 v3 语义的类改造**优先保上游视觉**;上游 literal(如 gray-200)可保留字面,标注 `/* upstream literal */`;灰阶语义色用 `var(--border)` 等 token。
- `app/src/pages/admin/**` 为锁定区:发现迁移面问题**登记不改**,记入偏离对照表"登记不改"栏。
- 改名时逐文件确认 token 边界,避免误伤 `shadow-sm-dark` 之类的自定义组合。

## 验证(三层,缺一不可)

1. `cd themes/vanblog && pnpm astro check && pnpm astro build` — 编译零错。
2. **产物 grep**:对每个修复点在 `dist/client/_astro/*.css` 构造完整规则片段探针(压缩单行,勿按行 grep,用字符串包含或分页直读)。确认新类生成、旧类不再被依赖、值正确(如 `rounded-xs` 解析 0.125rem)。
3. **浏览器计算样式探针**:headless 打开页面,对修复元素读 `getComputedStyle`(flex 值、borderColor、cursor);明暗两态都要测——**headless Chrome 默认 prefers-color-scheme=dark**,读亮色前先摘 `.dark` 再读,不要只信 classList 判断。

## 交付

- 提交信息:`fix(theme+app): Tailwind v3→v4 迁移面…`,正文列每类修复 + 实测证据。
- 新裁定/新陷阱追加到 `docs/developer/vendor-islands-design.md` 偏离对照表(表格一行,含对齐目标/实现/等价性说明/登记项);skill 内清单只在此表与官方手册冲突时更新。
