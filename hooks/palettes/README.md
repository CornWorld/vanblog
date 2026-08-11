# Palettes（调色盘）目录

本目录采用**原子式调色盘**模型（VSCode Color Theme 式）：**每一套 palette = 一个目录 + 单个明暗 type**，选 palette 即同时决定「明暗渲染」和「配色」，不存在独立的 light/dark 模式开关。

## 模型总览

- 每套 palette 位于 `hooks/palettes/<name>/`，目录名即 palette 名（后端以目录名注册，见 `vault/internal/palette/routes.go`）。
- 后端启动时自动扫描本目录：
  - `GET /api/palettes` → 返回所有 palette 的元数据（name / label / version / type）。
  - `GET /api/palette.css?name=<name>` → 拼接该目录下的 `tokens.css` + `typography.css` + `components.css`（缺文件自动跳过）。
- 前端 SDK（`sdk/src/theme.ts`）负责：
  - 按生效 palette 的 `type` 给 `<html>` 加/不加 `dark` class（`dark` = 暗色渲染）。
  - 把 `<link data-vanblog-palette>` 指向对应 palette 的 CSS。
  - **`system` 伪调色盘**：跟随 OS `prefers-color-scheme` 决定明暗，同时保留站点 palette 的配色（无独立偏好时也走系统明暗）。显式选择一个 palette 则会锁定配色 + 明暗。
- **新增 palette 是纯数据工作**：建目录 + 写 `palette.json` + `tokens.css`，无需改动任何 Go/TS 代码，服务重启即自动发现。

## `palette.json` Schema

```json
{
  "name": "midnight",          // 必须与目录名一致（后端以此为准）
  "label": "午夜 Midnight",    // 展示名称
  "type": "light",             // "light" | "dark"，决定 html.dark 是否启用
  "version": "1.0.0",
  "author": "vanblog",
  "description": "..."         // 设计说明（可选但建议写）
}
```

| 字段 | 说明 |
| --- | --- |
| `name` | 唯一标识，**必须与目录名一致**（后端读目录名，`palette.json` 中的 name 仅供元数据展示） |
| `label` | 前端下拉/选择器展示的友好名称 |
| `type` | `"light"`（不加 `html.dark`）或 `"dark"`（加 `html.dark`） |
| `version` | 版本号，用于缓存刷新参考 |
| `author` | 作者，内置 palette 统一为 `vanblog` |
| `description` | 一句话描述配色设计来源 |

## `tokens.css` 契约

原子式 palette 的 token 契约非常严格，只覆盖 **6 个颜色变量**：

- **light**（`type: "light"`）——只写 `:root` 作用域下的亮色变量：

```css
:root {
  --color-bg: #fafafa;          /* 页面背景 */
  --color-surface: #ffffff;     /* 卡片/面板表面 */
  --color-text: #1e293b;        /* 主文字 */
  --color-text-muted: #64748b;  /* 次要文字 */
  --color-border: #e2e8f0;      /* 边框/分隔线 */
  --color-accent: #2563eb;      /* 强调色 */
}
```

- **dark**（`type: "dark"`）——只写 `html.dark` 作用域下的暗色变量（后缀 `-dark`）：

```css
html.dark {
  --color-bg-dark: #0f172a;
  --color-surface-dark: #1e293b;
  --color-text-dark: #e2e8f0;
  --color-text-muted-dark: #94a3b8;
  --color-border-dark: #334155;
  --color-accent-dark: #60a5fa;
}
```

约定：

1. **不要混合**：light palette 只写 `:root` 的 `--color-*`；dark palette 只写 `html.dark` 的 `--color-*-dark`。不要在一个文件里同时写两套。
2. 文件头加注释说明设计来源（参考现有 palette 的注释风格）。
3. 颜色值需保证 text 与 bg/surface 的对比度满足 WCAG 可读性（约 4.5:1 以上为佳）。
4. **可选文件** `typography.css` / `components.css`：可附加排版与组件级样式，缺省时后端自动跳过。当前内置 palette 仅提供 `tokens.css`。

## 如何新增一套 Palette

1. 建目录 `hooks/palettes/<name>/`（`<name>` 用 kebab-case，如 `midnight-dark`）。
2. 写 `palette.json`：`name` 与目录名一致，`type` 取 `light` 或 `dark`。
3. 写 `tokens.css`：按上述契约覆盖 6 个变量。
4. （可选）加 `typography.css` / `components.css`。
5. **无需改任何代码**，重启后端（或让开发服务器重载）即自动发现，`GET /api/palettes` 与 `GET /api/palette.css?name=<name>` 即可使用。

## 注意

- **不要改动** `themes/vanblog/src/styles/global.css` 里既有的 hardcode 颜色——组件级配色迁移属后续独立决策，不在 palette 体系范围内。
- 本目录改动仅限 `hooks/palettes/` 下的数据文件，不应涉及 `vault/`、`app/`、`sdk/`、`themes/` 的任何代码。

## 现有 Palette 清单

| 目录 | type | 说明 |
| --- | --- | --- |
| `default` | light | 内置默认亮色（slate 浅色 + 蓝强调） |
| `default-dark` | dark | 内置默认暗色（navy 深色 + 蓝强调） |
| `vanblog-classic` | light | 原 vanblog 经典视觉亮色 |
| `vanblog-classic-dark` | dark | 原 vanblog 经典视觉暗色 |
| `midnight` | light | 午夜家族亮色（浅 slate + 靛蓝，参考 GitHub/shadcn） |
| `midnight-dark` | dark | 午夜家族暗色（深蓝黑 + 靛蓝） |
| `catppuccin` | light | Catppuccin Latte 官方浅色 |
| `catppuccin-dark` | dark | Catppuccin Mocha 官方深色 |
