# 内置主题对齐上游原版的决策:Vendor-as-Islands

> 读者:主题作者、维护者。回答一个问题:**原版 mereithhh/vanblog 的 Next.js 前台(fork)与本仓库 Astro 重写的关系怎么处理**。
> 相关:[theme-implementer-guide](../theme-implementer-guide.md)(L0/L1/L2 契约)、[architecture-layering](architecture-layering.md)。

## 决策

**把原版交互组件按文件原样 vendor 进内置主题(`themes/vanblog/src/vendor/`),以 React islands 运行;原版 Next.js 整站不进生产。**

- 上游 React 组件逐文件复制,行为级 1:1;每个文件头记 `UPSTREAM: packages/website/components/<Path>@<sha>`,上游 fix 可直接对本文件 apply patch。
- 不手搓复刻交互,也不整站迁移 Next.js。

## 背景(2026-09 量化)

用户定性:「现在的前端只是 vanblog style,大部分交互/细节和原版都对不上」。逐文件盘点结论:

- 原版 `packages/website`:14 页(全 getStaticProps+ISR)、40 组件目录 51 文件(组件 3367 行 + 样式 3099 行)、32 条行为级交互(暗色三态轮询、TOC scrollspy+hash、⌘K 搜索 modal、AJAX 解锁、图片画廊等)。
- 重写初期主题:14 routes、21 组件、3591 行、**零 island**——交互全部手搓原生 script,搜索双形态、解锁整页刷新、图片无画廊等行为漂移由此而来。
- 上游仓库为 AI-maintained(自声明):爆发-沉寂提交模式(如 2026-09-03 单日 30 个 `fix:` 后归静默),带 vitest+Playwright 测试。

## 否决的备选

| 方案 | 否决理由 |
| --- | --- |
| 整站跑原版 Next.js 前台 | AI-maintained 无人类维护承诺;第二个 Node 运行时;锁死 Waline;让位 pack/L0 生态;双前台路由/构建体系冲突 |
| 保留手搓 Astro 组件逐个补交互 | 32 条交互逐个补永远追不上上游 fix;每条都要人肉对照上游行为;上游改一处我们盲一处 |
| 平行维护两个前台 | 同「整站跑原版」,且用户永远只看一个 |

## 只开三个 seam(刻意分叉点)

其余代码原样。seam 签名是硬契约,实现在 `themes/vanblog/src/vendor/seams/`:

| Seam | 原版 | 本主题 | 契约 |
| --- | --- | --- | --- |
| 数据层 | SWR + getStaticProps + legacy `/api/public/*` | props 进 + SDK 回调出;Go 端 `/api/vanblog/search` | `search.ts`:`searchArticles(q, limit?)` → `SearchHit{id,title,summary,category?,createdAt}` |
| 评论 | `Waline/core.tsx` | `CommentArtalk.tsx` | 平台评论是 Artalk;props `{server, path}`,dark 联动监听保留 |
| Markdown | bytemd Viewer 客户端渲染 | 平台 remark/rehype 构建期渲染 HTML | viewerEffect(TOC/复制/mermaid)原样挂载;bytemd 不搬(SSR 管线同构) |

`unlock.ts`:`unlockPost(id, password)` → `POST /api/unlock` → 200 `{html}`(平台管线渲染+消毒)/ 401 `{message}`。

## 附带决策

- **ThemeContext 砍掉**:多 island 无共享 context;主题态走 `html.dark` + localStorage(原版 `applyTheme` 本就操作这两个),`seams/theme.ts` 提供 `useThemeMode()` 替身。
- **静态展示件保持 Astro**:ArticleCard/PageNav/Reward/CopyRight/时间轴展示面无状态,换 React 只增水合成本。
- **依赖 pin `react@^18.3`**:上游 18.2 系,勿升 19。
- **CSS 语义变量**:vendor CSS 里的硬编码色改 `var(--text|--bg|--surface|--border|--accent|--text-muted)`;无语义对应保留原值并注 `/* upstream literal */`。
- **props 类型内联各 vendor 文件**(与上游一致),不建共享 types。

## 上游同步协议

```bash
git remote add upstream https://github.com/Mereithhh/vanblog.git
git fetch upstream
git diff HEAD...upstream/master -- packages/website/components
# 命中 vendor 文件 → 按文件头定位本主题对应文件,apply patch;行为差异跑一遍下方验证
```

- 触发:上游爆发日(批量 `fix:`)后 diff 一次即可,平时静默期无需跟踪。
- 影响面判断沿用 L0/L1/L2:vendor 文件属主题内 L2(上游行为即规格);seam 与 `base-overrides` 锁定路径不受 vendor 更新影响。
- 上游若改数据面字段,同步改 Go 端 `SearchResult`/页面 props,不改 seam 签名。

## 验证基线(parity shim)

`scripts/dev/public-api-shim.mjs`(dev-only,零依赖):在 :3000 把原版 legacy `/api/public/*` 十个端点映射到本仓库 PocketBase,使**原版 Next 站点**(`refs/mereithhh-original/packages/website`,`pnpm dev` 监听 3001,dev rewrite 已指 3000)与**本主题**在同一份种子数据上渲染,全页截图逐页对比。复现命令见 `.snow/artifacts/parity-report-2026-09-05.md`(gitignored,报告含已知有意偏差清单)。垫片不进生产镜像。

## 重评触发

满足以下之一再议「生产 vendored Next」:连续 3–6 个月出现人类(非 AI 批量)提交且方向与本仓库兼容;或 pack 生态需求超出 islands 模型能力。

## 文件清单(2026-09-05)

- `themes/vanblog/src/vendor/`:21 个文件(组件 + `seams/` + `scroll.ts` + module.css)。计划外新增:`NavChrome.tsx`(跨岛 isOpen 状态)、`PalettePicker.tsx`(平台调色盘 React 化)、`PostLock.tsx`(锁定态包装)。
- 删除的手搓件:`Nav.astro`、`Toc.astro`、`TocMobile.astro`、`BackToTop.astro`(被 vendor 岛替换)。
- Go 端:`SearchResult` 增 `createdAt`(vendor ArticleList 日期列)。
- 已知有意偏差记录在各 vendor 文件头(SEAM 注释),如折叠 ± 文案、分类按 id 路由。
