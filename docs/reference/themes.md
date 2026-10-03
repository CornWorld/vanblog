# 主题 — 事实 (SSOT)

> 主题作者手册见 [theme-implementer-guide.md](../theme-implementer-guide.md)（950+ 行契约文档）。

## 三层模型

| 层        | 位置       | 职责                                                      |
| --------- | ---------- | --------------------------------------------------------- |
| L0 后端   | `vault/`   | 数据 / API / 权限（PocketBase + Go）                      |
| L1 平台层 | `app/`     | 数据访问 + 渲染基础设施 + base 布局；admin / api 是平台层 |
| L2 主题   | `themes/*` | 站点视觉 / 信息架构 / 交互（独立 Astro 项目）             |

## 内置主题

| 主题              | 定位                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `vanblog`（默认） | 旗舰主题：从原版 mereithhh 前端迁移的完整视觉主题，自带 BaseLayout、全套组件、11 个 public 页面 |
| `base`            | minimal 兜底主题：纯布局 + 简单颜色，用于验证后端能力 + 降级                                    |

首次启动默认主题 `vanblog`（`VANBLOG_DEFAULT_THEME`，见 [配置](configuration.md)）。

## 主题怎么工作

- 每个主题是独立 Astro 项目，通过 `@vanblog/base/*` alias 引用平台层。
- 覆盖 base 组件保留所有 props（可加 optional 新 props）。
- admin / login / setup 是平台层 control plane，主题不编译它们。
- 运行期按 `site.activeTheme` 切换（后台「外观」页）。

## 主题设置（settings）

主题在 `theme.json` 里声明可配置项（四种类型:`string` / `text` / `boolean` / `select`），站点管理员改值、主题 SSR 消费——**改页脚/横幅/开关不再需要 fork 主题**：

- **读取**:`GET /api/vanblog/theme-settings/<name>`（匿名,10s 缓存）返回 schema 默认值 ← 存量行合并后的全量值。SSR 侧 `Astro.locals.getThemeSettings()`（middleware 惰性加载,10s 进程缓存）。
- **写入**:`PUT /api/vanblog/theme-settings/<name>`（admin-only,body `{"values":{...}}`）,服务端按 theme.json 校验（类型/select 枚举/单值 64KB/总量 256KB）,未知 key 原样保留（主题升降级恢复）,写入后延迟失效页面缓存。
- **CLI**:`./vanblog.sh pack theme settings <name>` 读;`... <name> key=value ...` 写（需 `VANBLOG_ADMIN_TOKEN`）。
- 存储:专用 `theme_settings` collection（一行一主题,切换主题配置保留）。**公开可读——只放外观参数,凭据一律 `site_secrets`**。
- 两个内置主题已声明:`footerText`（页脚附言）、`bannerUrl`（横幅图）、`showBackToTop`（仅 vanblog）。

- **兼容性声明**：`theme.json` 可写 `"vanblogCompatibility": "^1"`——theme host 加载时校验 major，不匹配/无法解析即拒绝加载并保持当前主题（fail-closed；缺省 = 不限制）。主版本随主题契约的破坏性变更递增。

## 安装 / 切换

- **切换**：后台「外观」→ 选择主题（实时预览）。
- **运行时新增**：把主题（含 `dist/`）放进 `VANBLOG_THEMES_DIR`（默认 `/var/lib/vanblog/themes`）。prod 下 fsnotify 自动检测重扫；后台「重新加载主题」按钮兜底。
- **CLI**：`./vanblog.sh pack theme install <dir|zip>` / `remove <name>` / `list`。

## 新建主题

```bash
node scripts/build/theme-init.mjs my-theme   # 克隆 themes/base 模板
cd themes/my-theme && pnpm install && pnpm dev   # http://localhost:4321
```

主题必须自备：`src/middleware.ts`、`src/live.config.ts`、`src/layouts/PackPage.astro`。CSS 用 `var(--color-*)`，不硬编码颜色。
