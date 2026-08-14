# 功能使用（L1）

> 面向普通用户：写文章、管理站点、主题与外观。部署相关见 [快速开始](quickstart.md)。

## 写作

- 后台 `/admin/` → 「文章」→「新建」。编辑器支持 Markdown、代码块、图片上传（粘贴/本地）、`<!-- more -->` 截断标记、数学公式、Mermaid 图表。
- **草稿**：保存为草稿不发布。**回收站**：删除进回收站可恢复或彻底删除（`/admin/trash`）。
- **图片**：上传走本地或 S3（见 [配置参考](../reference/configuration.md)）。BMP/TIFF/AVIF 可自动转 WebP/AVIF（`site.mediaConfig`）。

## 内容组织

- **分类 / 标签**：文章可归属分类、打标签。
- **归档 / 时间线 / 搜索**：前台提供归档、时间线页与站内搜索。
- **自定义路径**：文章支持自定义 pathname（`/post/{pathname}`）。

## 主题与外观

- 后台「外观」页选择激活主题（默认「vanblog」旗舰主题，`site.activeTheme`）。
- 主题/调色盘选择器带**实时站点预览**；平台层兜底主题 `base`（minimal）用于降级。
- 运行时新增主题：放进 `VANBLOG_THEMES_DIR` 后，prod 下 fsnotify 自动检测重扫（无需手动），后台「重新加载主题」按钮兜底。见 [主题](../reference/themes.md)。

## 评论（Artalk）

- 默认未启用。启用后前台文章页出现评论框（同源 `/comments`）。
- 两种部署：内置 sidecar（`VANBLOG_ARTALK_ENABLED=1`，推荐）或外部容器（`VANBLOG_ARTALK_UPSTREAM`）。见 [配置参考](../reference/configuration.md)。

## 站点配置

- 后台「站点配置」维护：站点信息、导航、友链、社交、打赏、路由、`allowedDomains` 等。
- 底层 `site` 集合字段（含 S3、媒体、路由）见 [配置参考](../reference/configuration.md)。

## 数据

- 导出/导入文章走后台「数据迁移」页（ZIP）。备份/恢复用 `./vanblog.sh backup|restore`。见 [备份·升级·回滚](backup-upgrade.md)。

## 还没讲到的

- RSS 订阅、自定义页面、协作账号等进阶能力：随版本补充。遇到问题先查 [FAQ](../faq.md)。
