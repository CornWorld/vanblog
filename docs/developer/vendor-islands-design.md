# 内置主题对齐上游原版的决策:Vendor-as-Islands

> 读者:主题作者、维护者。回答一个问题:**原版 mereithhh/vanblog 的 Next.js 前台(fork)与本仓库 Astro 重写的关系怎么处理**。
> 相关:[theme-implementer-guide](../theme-implementer-guide.md)(L0/L1/L2 契约)、[architecture-layering](architecture-layering.md)。

## 决策

**把原版交互组件按文件原样 vendor 进内置主题(`themes/vanblog/src/vendor/`),以 React islands 运行;原版 Next.js 整站不进生产。**

- 上游 React 组件逐文件复制,行为级 1:1;每个文件头记 `UPSTREAM: packages/website/components/<Path>@<sha>`,上游 fix 可直接对本文件 apply patch。
- 不手搓复刻交互,也不整站迁移 Next.js。

## 兼容层原则(2026-09-07 裁定)

**努力对齐行为;实现完全允许不一样——只要保证可解释、可与原版 compare。**

- **行为**指用户可见面:URL 形态、渲染结果、交互响应、时序可见性(如发布即可见)。
- **实现**指框架机制与内部结构:Astro/React、渲染时机、取数路径、组件拆分。
- 每处实现偏离必须**可解释**:vendor 文件头 `SEAM` 注释,或下方对照表登记;不允许无记录的静默分叉。
- 每处行为等价必须**可 compare**:用验证基线一节的手段(同源数据垫片、URL 探活、截图)可重复检验,不靠"看起来像"。

### 实现偏离对照表

| 行为(对齐目标) | 原版实现 | 本主题实现 | 等价性说明 |
| --- | --- | --- | --- |
| 路由形态 | `/post/[id]`(id 或 permalink 双解析)、`/category`+`/category/[name]`、`/tag`+`/tag/[name]`、`/page/[p]` | 同形态迁移;`/posts/[id]` 留 301 兼容桩(admin 面板可能拼旧复数形态);Astro params 不自动解码,补 `decodeURIComponent` 对齐 Next | URL 逐形态一致;非法 name/slug → 404 同原版 |
| 顶栏站点名 | `getLayoutProps`:siteLogo 为空时强制回落 siteName | BaseLayout 同语义守卫 | 配置了 siteLogo 模式但未传图时两站都显示站名,不留空白 |
| 正文内嵌元素 | sanitize 放行 script/iframe/object/center | **iframe 放行**(B 站/YouTube 嵌入全走 iframe,srcdoc/on*/js-scheme 已防);script/object/embed 仍剥离 | 有意安全分叉:嵌入场景 iframe 全覆盖;script 执行面无正当内容需求(站点级注入走 customScript) |
| 微信二维码 | SocialIcon 点击弹 Popover(dark 用 wechat-dark 变体) | vendor `SocialIcon.tsx` 逐字(dark 态走 html.dark 桥) | 与原版同一 React 组件,逐行为一致 |
| 过期提醒范围 | 仅 PostCard 内 AlertCard(type=article/about) | PostCard island 原样(移除首页/分页卡误挂载) | 修正范围漂移,与原版一致 |
| 分页 URL | `page/[p].tsx` 路由,无 query 分页 | `pages/page/[p].astro` + `/?page=N` 兼容入口 | 第 1 页=`/`,N≥2=`/page/N` 形态一致;非法页 rewrite 404 同原版 |
| 列表排序 | 服务端默认 `-top,-created` | SDK `sort: '-top,-created'` | 置顶优先 + 创建时间倒序,逐项一致 |
| 发布可见性 | getStaticProps + ISR 时间窗重建 | SSR 缓存(`routeRules` SWR)+ Go 写钩子 `POST /api/revalidate` 主动失效 | 主动失效比 ISR 窗口更即时;e2e:`app/test/cache-e2e.test.mjs` |
| `/?page=N` 缓存隔离 | 原版无此入口(兼容层自有) | Astro cache 键含 query(`x-astro-cache` 实测 `/` 与 `/?page=2` 各自 MISS/HIT) | 兼容入口不污染首页缓存 |
| 站内链接 | 裸根路径(站点根=`/`) | `withBase()` 统一加 `/themes/<name>/`(站点根=主题前缀) | 语义等价:都是"站内路由根";平台 `/admin`、`/api/*` 除外 |
| 数据获取 | SWR + legacy `/api/public/*` | SDK 串行取数(同 client 并发触发 auto-cancel) | 渲染输入同源(parity 垫片保证);串行是实现约束非行为差异 |
| Markdown 渲染 | bytemd 客户端 | 平台 remark/rehype SSR + `lib/upstreamMarkdown.ts` 后处理对齐 DOM | 代码块/标题/TOC 行 DOM 同构;语法高亮保持平台 shiki 内联色(见下行) |
| 语法高亮 | highlight.js(`hljs` 类,code-light/dark.css) | 平台管线 shiki 内联色 + `--shiki-dark` 暗色变量 | **有意分叉**:暗色即开即用;换行符/Token 粒度不同,文本内容一致 |
| CSS 层 | globals.css 手写工具类 + var/tip-card/scrollbar 诸文件 + 代码块包裹内边距 | `vendor/upstream-globals.css` 全量补齐 + var/tip-card/scrollbar 三文件 vendor;页面底色对齐上游像素(slate-100/#1d2025);`text-dark-r` 等暗色 token 已删(见下行机制行) | DOM diff 之外以计算样式探针逐项核验(nav 0.15s 过渡、headroom transform、ua::before 0.3s、代码块 22px 16px 16px、pre-wrap) |
| 静态展示件 | React | 已全量 vendor(2026-09-07 二批:PostCard 系/AuthorCard 系/Footer/TimeLineItem/LinkCard/PageNav/ImageBox 等) | 换框架不换行为;删除早期 Astro 手写版 |
| 暗色类机制 | 上游 v3.3.5 会对 @layer components 手写类生成 `dark:` 变体(color+fill 成对、hover/group-hover 全套;`text-dark`=灰158 与 `bg-dark`=#26282c 同名不同值) | @theme 单 token 无法表达 → 已删错误 token;`upstream-globals.css` 手写 27 条变体规则 + 无条件类,**逐字从上游构建产物移植**(dev styleSheets 抓取) | 修正暗色文字被涂成 #26282c(背景同色隐形)与 `a` 全局染 accent 蓝两个根因;计算样式探针实测 nav/标题/副标题/页脚=rgb(158,158,158) 与上游逐位一致 |
| 调色盘切换失效 | —(上游无调色盘) | SDK `runWithTransition` 裸调 `document.startViewTransition` 抛 Illegal invocation,回调(切 dark 类+换 palette.css link)从未执行 → `vt.call(doc, fn)` | 选盘 → link 换 `name=midnight-dark` + CSS 变量实际生效 + 清除回落,浏览器闭环验证 |
| 评论数角标 | SubTitle 内 `span.waline-comment-count[data-path]` 初始 0,WaLine commentCount 客户端填充(仅文章页;首页保持静态 0) | 同 DOM;CommentArtalk 挂载时按 Artalk `/api/v2/stats` 填充 `data-path` | **修正此前误登记**:上游确有评论数角标;enableComment 由 commentsProvider 映射 |
| Tailwind v3→v4 迁移面 | 上游组件按 v3.3.5 语义书写(类名/默认值/选择器) | 按[官方升级手册](https://tailwindcss.com/docs/upgrade-guide)全量审计(4 scout 并行分片 + 构建产物实测):flex-grow/shrink 族→grow/shrink、rounded-sm→rounded-xs(保 v3 0.125rem)、hr/divide 补显式亮色(v4 默认色 currentColor)、button cursor 全局兜底 pointer(官方推荐写法)、custom-container 显式边色;实测 v4.3.2 对 flex-grow/shrink 旧名仍出等值别名,改名属前瞻 | 删除孤儿 ArticleList.astro/TimeLineItem.astro;app/src/pages/admin/** 为锁定区,v4 边框默认色变化在其中保留原样(登记) |

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
- **静态展示件二批全量 vendor(2026-09-07)**:PostCard(index/title/bottom+AlertCard/TopPinIcon/CopyRight/Reward/UnLockCard/CommentArtalk)、AuthorCard(SocialCard/SocialIcon/ImageBox/getIcon)、Footer(RunningTime/SiteViewer)、TimeLineItem、LinkCard、PageNav、404。早期 Astro 手写版(ArticleCard/PostViewer/ExpirationNotice/CopyRight/Reward/TopPin/Comments/PostLock)已删——原「静态件保持 Astro」决议废止,比对成本优先。
- **壳层对齐上游 Layout/LayoutBody**:body 裸、内容+Footer 同包 `mx-auto lg:px-6 md:py-4 py-2 px-2 md:px-4 text-gray-700` 容器;类名 upstream literal(不走语义变量)。
- **依赖 pin `react@^18.3`**:上游 18.2 系,勿升 19。
- **CSS 语义变量**:vendor CSS 里的硬编码色改 `var(--text|--bg|--surface|--border|--accent|--text-muted)`;无语义对应保留原值并注 `/* upstream literal */`。
- **props 类型内联各 vendor 文件**(与上游一致),不建共享 types。
## 验证基线(parity shim)

`scripts/dev/public-api-shim.mjs`(dev-only,零依赖):在 :3000 把原版 legacy `/api/public/*` 十个端点映射到本仓库 PocketBase,使**原版 Next 站点**(`refs/mereithhh-original/packages/website`,`pnpm dev` 监听 3001,dev rewrite 已指 3000)与**本主题**在同一份种子数据上渲染。垫片不进生产镜像。复现命令见 `.snow/artifacts/parity-report-2026-09-05.md`(gitignored,报告含已知有意偏差清单)。

**可 compare 三件套**(按兼容层原则可重复执行):
1. **同源数据**:垫片使两站读同一份 PB 数据,渲染差异只可能来自前端。
2. **URL 探活**:`Accept: text/html` 逐 URL 探状态(curl 默认 `*/*` 会吃到 dev fallback 假 200,必须带真实浏览器头);首页全部内链闭环探活。
3. **全页截图**:关键页(首页/文章/时间轴/搜索/分页)两站对比,交互(暗色、⌘K、TOC、解锁)走真实浏览器点击流。

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

## 重评触发

满足以下之一再议「生产 vendored Next」:连续 3–6 个月出现人类(非 AI 批量)提交且方向与本仓库兼容;或 pack 生态需求超出 islands 模型能力。

## 文件清单(2026-09-05)

- `themes/vanblog/src/vendor/`:21 个文件(组件 + `seams/` + `scroll.ts` + module.css)。计划外新增:`NavChrome.tsx`(跨岛 isOpen 状态)、`PalettePicker.tsx`(平台调色盘 React 化)、`PostLock.tsx`(锁定态包装)。
- 删除的手搓件:`Nav.astro`、`Toc.astro`、`TocMobile.astro`、`BackToTop.astro`(被 vendor 岛替换)。
- Go 端:`SearchResult` 增 `createdAt`(vendor ArticleList 日期列)。
- 已知有意偏差记录在各 vendor 文件头(SEAM 注释),如折叠 ± 文案、分类按 id 路由。
