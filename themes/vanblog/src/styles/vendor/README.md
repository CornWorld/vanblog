# styles/vendor — 原版 CSS 搬运

搬自上游 `refs/mereithhh-original/packages/website/styles/`(Mereithhh/vanblog `packages/website`)。

## 搬运清单(@4b48850)

| 文件 | 上游源 | 适配 |
|---|---|---|
| `github-markdown.css` | `styles/github-markdown.css` | 灰阶/链接色映射语义 var;`.light` 作用域 → `html:not(.dark)`;悬空 `--color-text-primary` → `var(--text)` |
| `custom-container.css` | `styles/custom-container.css` | 五类容器类型色(含内联 SVG fill)保留 upstream literal |
| `toc.css` | `styles/toc.css` | 单值灰阶 → `var(--text|--text-muted|--hover)`;6 级标题灰阶渐变保留 |
| `zoom.css` | `styles/zoom.css` | 遮罩底色 → `var(--bg)` |

## 跳过清单与原因

- `code-light.css` / `code-dark.css`:平台层 markdown 管线用 shiki `github-light`/`github-dark` 双主题(见 `app/src/lib/markdown/config.ts`),代码高亮已覆盖。
- `loader.css`:加载态由现主题自管。
- `side-bar.css`:现主题侧栏已自成体系,避免双份规则打架。
- `globals.css` / `var.css` / `scrollbar.css` / `tip-card.css` / `back-to-top.module.css`:语义 token 与滚动条等在现主题 `global.css` 已有等价实现。

## 颜色规则

- 明显语义灰阶一律映射 `var(--text|--text-muted|--bg|--surface|--surface-soft|--border|--accent|--hover)`(html.dark 自动翻转)。
- 无语义对应(品牌色、类型色、语法高亮、半透明色、data-URI SVG fill)保留原值 + 行尾 `/* upstream literal */` 注释。
- dark 覆盖段保留 `.dark` 选择器(本主题同为 `html.dark` 类开关)。
- Tailwind 检查:四个文件均为纯 CSS,无 `@apply`、无 v3 废弃类(`bg-opacity-*` 等)。