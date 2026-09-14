# styles/vendor — 原版 CSS 搬运

搬运自上游 `refs/mereithhh-original/packages/website/styles/`(@`4b48850`)。

**权威清单在 [`src/vendor/upstream.manifest.json`](../../vendor/upstream.manifest.json)**——每个文件的血缘(`upstream[]`)、类别(`derivation`)、适配(`rewrites`)、本地修复(`patches`)逐条登记,`node scripts/dev/vendor-sync.mjs check` 机器校验。本文件只保留约定。

## 现存文件(10)

`custom-container` `github-markdown` `loader` `scrollbar` `side-bar` `tip-card` `toc` `upstream-globals`(globals.css + 暗色变体自上游构建产物移植) `upstream-var` `zoom`——逐文件适配见 manifest,此处不再重复(历史清单曾与本目录实际漂移,已废弃)。

## 上游 styles/ 未搬运

- `code-light.css` / `code-dark.css`:平台管线 shiki `github-light`/`github-dark` 双主题 + `--shiki-dark` 变量(见 `app/src/lib/markdown/config.ts`;对照表「语法高亮」行)。

## 颜色规则(约定,不变)

- 明显语义灰阶一律映射 `var(--text|--text-muted|--bg|--surface|--surface-soft|--border|--accent|--hover)`(html.dark 自动翻转)。
- 无语义对应(品牌色、类型色、语法高亮、半透明色、data-URI SVG fill)保留原值 + 行尾 `/* upstream literal */` 注释。
- dark 覆盖段保留 `.dark` 选择器(本主题同为 `html.dark` 类开关)。
- Tailwind 检查:全部为纯 CSS,无 `@apply`、无 v3 废弃类(`bg-opacity-*` 等)。
