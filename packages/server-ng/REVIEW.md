# V2 差距评审与落地计划（精简版）

## TL;DR

- v1 已彻底移除：所有 `/api/v1/*` 返回 410（Gone）并附带迁移提示，由全局中间件负责拦截。
- v2 现状：Articles、Categories、Tags、Auth、Analytics、RSS、Sitemap 等核心能力已具备，基础可用。
- 主要缺口（按优先级）：
  1. 文章 pathname GET 访问、2) 自定义页面、3) 时间线、4) 文章密码验证、5) 聚合选项、6) 公开访客统计、7) 构建元数据。
- 建议实施顺序：先补齐"用户面直观断层"（pathname、自定义页面、时间线），再处理安全与可用性增强（密码、统计），最后考虑体验优化（聚合、元数据）。

---

## v2 现有能力（一览）

- **Articles**：GET /articles、GET /articles/search、GET /articles/:id、GET /articles/export、GET /articles/category/:name、POST /articles/import、POST /articles（管理）、PUT /articles/:id（管理）、DELETE /articles/:id（管理）、POST /articles/:id/view、POST /articles/pathname/:pathname/view
- **Drafts**：GET /drafts、GET /drafts/:id、POST /drafts（管理）、PUT /drafts/:id（管理）、PUT /drafts/:id/auto-save（管理）、DELETE /drafts/:id（管理）、POST /drafts/:id/publish（管理）、POST /drafts/import（管理）、GET/POST/DELETE /drafts/:id/versions/\*（版本管理）
- **Categories**：GET /categories、GET /categories/:id、POST /categories/:id/verify-password、GET /categories/statistics/overall、GET /categories/associations/tags、POST /categories（管理）、PUT /categories/:id（管理）、DELETE /categories/:id（管理）
- **Tags**：GET /tags、GET /tags/:id、GET /tags/statistics/overall、GET /tags/associations/categories、POST /tags（管理）、PUT /tags/:id（管理）、DELETE /tags/:id（管理）
- **Users**：GET /admin/users、GET /admin/users/:id、POST /admin/users（管理）、PUT /admin/users/:id（管理）、DELETE /admin/users/:id（管理）
- **Media**：GET /admin/media、POST /admin/media/upload、DELETE /admin/media/:id（管理）
- **Analytics**：POST /analytics/record、POST /article/:id/view、POST /article/:id/reading-time、GET /admin/analytics/\*（管理统计，含 Echarts 格式化）
- **Auth**：POST /auth/login、GET /auth/profile、POST /auth/logout、POST /auth/refresh、POST /auth/revoke-all、GET /auth/logs（管理）、GET /auth/csrf-token
- **RSS**：GET /rss、GET /rss.xml
- **Sitemap**：GET /sitemap、GET /sitemap.xml
- **WebHook**：GET/POST/PATCH/DELETE /webhooks（完整CRUD、事件管理、测试触发、日志查询、统计信息）
- **插件系统**：HookService（doAction/applyFilters）、PluginContext（数据存储）、动态模块加载、安全隔离、GET /v2/plugins/\*（插件管理）
- **权限系统**：GET /permissions（权限节点查询、角色管理、语义化权限名称、模块化注册）
- **设置管理**：GET/PATCH /api/admin/settings/_（站点信息、布局、主题、友链、导航、自定义代码）、GET/PUT/DELETE /api/admin/config/_（动态配置注册系统）
- **备份恢复**：GET/POST/DELETE /backup、POST /backup/:filename/restore、GET /backup/restore/:taskId/progress（全模块数据导出/导入/下载/恢复进度）
- **Demo 演示**：GET /demo（演示环境标识与功能限制）
- **健康检查**：GET /health（系统状态监控）
- **辅助模块**：Comment（评论集成）、Reward（打赏模块）、Beian（备案信息）、Social Links（社交链接）等管理端点

以上接口已通过 e2e 验证，且不受 v1 拦截影响（非 `/api/v1/*` 路径）。

---

## v1 → v2 迁移速查（核心）

- public.getByOption → 使用多接口：/articles、/categories、/tags、/rss、/sitemap（短期不提供聚合端点）
- public.searchArticle → GET /articles/search?keyword={keyword}&page={page}&limit={limit}
- public.getArticleByIdOrPathname → GET /articles/:id；pathname 访问缺口：建议新增 GET /articles/by-path/:pathname
- public.getArticleWithPassword → 待实现（建议：密码验证颁发短期 JWT 白名单，自动过期/清理）
- public.getArticlesByTagName → 先 GET /tags 获取并在客户端筛选 name，或后续提供 /tags/by-name/:name
- public.getArticlesByCategory → 现有为 GET /articles/category/:name（按名称获取文章）；如需按 id，可在后续补充 /categories/:id/articles
- public.getArticlesByTag → 待实现（按标签获取文章列表端点缺失）
- public.addViewer → POST /article/:id/view 或 POST /articles/pathname/:pathname/view 或 POST /analytics/record
- public.getViewer / getViewerByArticleIdOrPathname → 暂无公开查询（现偏向管理员统计：/admin/analytics/\*）
- public.getAllCustomPages / getCustomPageByPath → 待实现（需要 Custom Pages 控制器）
- public.getTimeLineInfo → 待实现（Timeline 模块）
- public.getMeta / getBuildMeta → 待实现（元数据端点）
- auth.login/logout/profile/logs → v2 已有 login/profile/logout/refresh/revoke-all/csrf-token，logs 通过 /auth/logs（管理员）

---

## 缺口清单与验收标准

1. 自定义页面（高）

- 目标：GET /pages、GET /pages/:path
- 验收：根据数据库 `customPages` 返回内容；支持草稿/发布状态和缓存；404 语义清晰。
- 现状：数据库与备份模块已存在 customPages 表与数据流，缺控制器与服务层。

2. pathname GET 访问（高）

- 目标：GET /articles/by-path/:pathname（可配置是否允许通过 id 访问）
- 验收：同一资源 id 与 pathname 指向一致；冲突与迁移策略明确；缓存命中有效。
- 现状：已有 POST /articles/pathname/:pathname/view 用于统计；服务层已有 findOneByPathname，可复用。

3. 时间线（高）

- 目标：GET /timeline（聚合文章/事件）
- 验收：分页/过滤可用；数据来源可配置；无 N+1 查询。
- 现状：sitemap 中包含 /timeline，测试有期望；缺实际实现。

4. 文章密码（中）

- 目标：POST /articles/:id/auth，验证成功后发放短期令牌（白名单）
- 验收：令牌自动过期/清理；对未授权访问返回 403；审计日志可追踪。
- 现状：Article 实体含 password 字段，无验证端点；Category 已有 verify-password 可供参考。

5. 统一选项聚合（中）

- 目标：GET /options?include=articles,categories,tags,siteMeta,...（可选）
- 验收：强约束速率限制，避免“巨接口”滥用；按 include 精确返回；响应体稳定。

6. 公开访客统计（中）

- 目标：GET /analytics/public/overview、GET /analytics/public/article/:id
- 验收：脱敏、安全限流；与管理员统计口径一致；缓存策略合理。
- 现状：管理员端 /admin/analytics/\* 已完善，缺公开查询端点。

7. 构建元数据（低）

- 目标：GET /meta/build
- 验收：版本、提交号、构建时间来源统一；在 CI/CD 注入。
- 现状：缺模块与端点。

---

## 兼容性与风险

- v1 访问明确返回 410，并提供文档与迁移建议，避免“静默失败”。
- 前端需适配 v2 响应格式（直接数据）与可能的分页参数差异。
- 对于 pathname/密码类改动，需设计灰度与回滚策略，避免 SEO 与访问的突变。

---

## 建议实施顺序（里程碑）

**现状优势**：

- 插件系统与 WebHook 集成已完成，支持动态扩展与第三方集成
- 权限系统已采用模块化设计，语义化权限节点，支持角色继承
- 数据库架构已优化，性能查询与索引策略就位
- Drizzle-Zod 集成完成，类型安全与运行时验证统一

**剩余里程碑**：
M1（用户可见断层修复）：pathname、自定义页面、时间线
M2（安全与可用性增强）：文章密码、公开访客统计
M3（体验优化）：聚合选项、构建元数据

每个模块并行开发但独立验收，统一走 e2e 用例与文档更新。

---

最后更新：2024-01-20
分析版本：v2.0.0
