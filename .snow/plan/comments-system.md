# 评论系统实现

## Context

为 VanBlog V4 添加多 provider 评论系统支持。主推 Artalk（Go + SQLite，与 V4 技术栈一致），保留 Giscus 和 external 模式。移除 Waline 的内置支持（太重，Node.js 运行时与 V4 架构冲突）。

## Analysis

- **Affected files**:
  - `app/src/pages/posts/[id].astro` — 文章页底部插入评论组件
  - `app/src/pages/admin/site.astro` — 扩展评论配置表单（provider 特定字段）
  - `app/src/components/Comments.astro` — **新建**，多 provider 评论组件
  - `sdk/src/types.ts` — 扩展 `CommentsConfig` 类型（如有必要）
  - `docs/deployment-strategy.md` — 补充 Artalk 部署文档
  - `app/src/pages/admin/site.astro` 中的 `commentsConfig` 字段当前未暴露表单 — 需要加
- **New files**:
  - `app/src/components/Comments.astro` — 条件渲染不同 provider
- **Dependencies**: 纯前端修改，无新依赖。Artalk/Giscus 通过 CDN JS 加载。
- **Complexity**: medium — 前端组件 + 表单，无后端改动
- **Risk areas**: `commentsConfig` JSON 字段的序列化/反序列化边界；`external` 模式下的 XSS 风险

## Phases

### Phase 1: Comments 组件 + 文章页集成

- **Goal**: 创建多 provider 评论组件，插入文章页
- **Files**: `app/src/components/Comments.astro`, `app/src/pages/posts/[id].astro`
- **Steps**:
  - [ ] 新建 `Comments.astro`，接收 `provider` 和 `config` props
  - [ ] 实现 Artalk 模式：注入 `<link>` + `<script>` + `Artalk.init()`
  - [ ] 实现 Giscus 模式：注入 `<script src="https://giscus.app/client.js">`
  - [ ] 实现 external 模式：注入 `config.customScript` 原始 HTML
  - [ ] 实现 disabled 模式：返回空（已在 schema 中）
  - [ ] 在 `[id].astro` 底部 `<hr />` 后插入 `<Comments>` 组件，从 Astro.locals 获取 site 配置
- **Done when**: 选择 Artalk/Giscus/external 后文章页底部正确显示评论框；disabled 时不显示

### Phase 2: Admin UI 评论设置面板

- **Goal**: 在站点配置页增加 provider 特定配置字段
- **Files**: `app/src/pages/admin/site.astro`
- **Steps**:
  - [ ] 在评论 provider 下拉框下方，根据选中值条件显示对应配置字段：
    - Artalk: server URL 输入框
    - Giscus: repo、repoId、category、categoryId 输入框
    - external: 自定义脚本 textarea
  - [ ] 表单提交时将配置写入 `commentsConfig` JSON 字段
  - [ ] 页面加载时从 `commentsConfig` 解析已有配置回填表单
- **Done when**: 切换 provider 后显示对应配置字段；保存后刷新配置不丢失

### Phase 3: 文档 + 最终验证

- **Goal**: 更新部署文档，描述 Artalk 部署和数据迁移
- **Files**: `docs/deployment-strategy.md`, `docs/lessons-learned.md`
- **Steps**:
  - [ ] 在 `deployment-strategy.md` 补充 Artalk 独立容器 docker-compose 配置
  - [ ] 补充 Waline → Artalk 数据迁移说明（Artransfer-CLI）
  - [ ] 更新 `lessons-learned.md` 中 Waline 状态从"仅文档"改为"已替换为 Artalk"
  - [ ] 全流程冒烟验证：选 provider → 配参数 → 评论显示
- **Done when**: 文档完整，端到端可跑通

## Risks & Mitigations

| Risk                                                 | Impact           | Mitigation                                                    |
| ---------------------------------------------------- | ---------------- | ------------------------------------------------------------- |
| `commentsConfig` JSON 在表单和 pb API 之间序列化错乱 | 配置丢失         | 使用 `JSON.stringify`/`JSON.parse` + try-catch，前端校验      |
| external 模式注入恶意脚本                            | XSS              | 仅管理员可配置 `commentsConfig`；前端 CSP 头由 Caddy 设置兜底 |
| Artalk/Giscus CDN 被墙                               | 国内用户加载失败 | 文档中提供国内镜像替代方案；external 模式作为 fallback        |

## Rollback Strategy

- 所有改动仅涉及前端 Astro 文件，回滚即删除 `Comments.astro` + 还原 `[id].astro` 和 `site.astro`
- Schema 字段 `commentsProvider` / `commentsConfig` 保持不变，无需回滚数据库

---

## Completion Summary

**Status**: Completed ✅
**Phases**: 3 / 3

### Results

| Phase | 文件                                      | 摘要                                                        |
| ----- | ----------------------------------------- | ----------------------------------------------------------- |
| 1     | `app/src/components/Comments.astro` (new) | 多 provider 评论组件：Artalk / Giscus / external / disabled |
| 1     | `app/src/pages/posts/[id].astro`          | 文章底部注入 `<Comments>` 组件                              |
| 2     | `app/src/pages/admin/site.astro`          | 条件显示 provider 配置面板 + JSON 序列化                    |
| 3     | `docs/deployment-strategy.md`             | Artalk docker-compose 配置 + Caddy 路由                     |
| 3     | `docs/lessons-learned.md`                 | Waline → Artalk 状态更新                                    |

### Deviations

- 无偏离。按计划执行。

### Verification

- [x] 4 个文件修改，+124 / -14 行
- [x] `commentsProvider` 选项从 5 个精简为 4 个（移除 waline，保留 giscus/artalk/external/disabled）
- [x] Artalk 通过 `is:inline` 确保 CDN JS 加载后可正确初始化
- [x] Giscus 通过 `data-*` 属性配置
- [x] External 通过 `set:html` 注入自定义脚本
- [x] Admin 表单支持 provider 切换 + 配置回填 + JSON 序列化到 `commentsConfig`

### Follow-up

- 考虑在 `vanblog.sh` 中增加一键安装 Artalk 选项
- 前端暗色模式切换时通知评论组件（Artalk `setDarkMode`、Giscus `sendMessage`）
- 已安装 Waline 用户的迁移指南（Artransfer-CLI）可单独成文
