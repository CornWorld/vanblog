# docs/.site — Vanblog 文档站(Astro Starlight)

内容不搬家:`setup.sh`(prebuild 自动跑)把上级 `docs/` 的用户层镜像到
`src/content/docs/`(gitignored)。**改文档只改 `docs/`**。

- 本地:`pnpm dev`(http://localhost:4321;workspace 下 `pnpm --filter vanblog-docs-site dev`)
- 构建:`pnpm build` → `dist/`(30 页,含 Pagefind 搜索索引)
- 侧边栏/首页:见 `astro.config.mjs`;正文 `.md` 相对链接由 `rehype-md-links.mjs`
  改写为站内路由(未镜像/仓库根目标回退 GitHub blob)

## Cloudflare Pages 托管配置

| 项 | 值 |
| --- | --- |
| 构建命令 | `pnpm install --frozen-lockfile && pnpm --filter vanblog-docs-site build` |
| 输出目录 | `docs/.site/dist` |
| Node 版本 | 环境变量 `NODE_VERSION=24` |
| 根目录 | 仓库根(pnpm workspace) |

自定义域 `docs.vanblog.corn.im` 在 CF Pages 项目设置里绑定
(`astro.config.mjs` 的 `site` 已指向它)。
