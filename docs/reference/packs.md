# Pack — 事实 (SSOT)

> Pack = 可插拔的扩展单元（主题、前端贡献、自声明集合）。使用文档见 [guide/packs.md](../guide/packs.md)。

## 什么是 Pack

Pack 是 vanblog 的扩展单元，通过 `pack.json` 描述自身，可携带：
- **前端贡献**：`pages/`（路由页，如 `/p/bookmarks`）、`components/`、`hooks/`（JSVM 钩子）
- **自声明集合**：`migrations/*.js`（pb 迁移，Pack 可自建数据集合）
- **导航项**：`pack.json` 的 `nav` 字段（如收藏 → `/p/bookmarks`）

## pack.json 格式

```json
{
  "name": "bookmarks",
  "version": "1.0.0",
  "title": "收藏",
  "nav": { "label": "收藏", "href": "/p/bookmarks" }
}
```

## 生命周期与安装位置

- 内置 Pack：镜像内（`/build/packs`，只读）。
- 用户 Pack：持久卷 `VANBLOG_PACKS_DIR`（默认 `/var/lib/vanblog/packs`）。**用户覆盖优先**。
- `vanblog.sh pack list` 列出已安装 Pack；`pack status` 看生命周期状态；`pack plan` 部署预检（只读）；`pack inspect <name>` 看详情；`pack add <name>` 添加本地覆盖。

## 现有 Pack（内置）

| Pack | title | 说明 |
|---|---|---|
| `bookmarks` | 收藏 | 收藏夹页，路由 `/p/bookmarks` |
| `moments` | 说说/动态 | 短动态流 |
| `visits` | 访客 | 访客计数/聚合 |
| `live2d-companion` | — | Live2D 看板娘 |

## 约束

- Pack 不得覆盖平台层禁区（`app/src/pages/admin|api`、`lib`、`loaders`、`middleware` 等 fail-closed 路径）。
- Pack 通过 `migrations/*.js` 建集合时遵循 pb 迁移规范。
