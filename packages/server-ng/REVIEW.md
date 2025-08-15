# V2 差距评审与落地计划（精简版）

## TL;DR

- v1 已彻底移除：所有 `/api/v1/*` 返回 410（Gone）并附带迁移提示，由全局中间件负责拦截。
- v2 现状：Articles、Categories、Tags、Auth、Analytics 等核心能力已具备，基础可用。
- 主要缺口（按优先级）：
  1. 自定义页面、2) 文章 pathname 访问、3) 时间线、4) 文章密码、5) 聚合选项、6) 公开访客统计、7) 构建元数据。
- 建议实施顺序：先补齐“用户面直观断层”（自定义页面、pathname、时间线），再处理安全与可用性增强（密码、统计），最后考虑体验优化（聚合、元数据）。

---

## v2 现有能力（一览）

- Articles：GET /articles、GET /articles/search、GET /articles/:id、POST /articles/:id/increment-view、POST /articles/increment-view/:pathname
- Categories：GET /categories、GET /categories/:id/articles
- Tags：GET /tags
- Analytics：POST /analytics/record、POST /article/:id/view
- Auth：POST /auth/login、GET /auth/profile、POST /auth/logout

以上接口已通过 e2e 验证，且不受 v1 拦截影响（非 `/api/v1/*` 路径）。

---

## v1 → v2 迁移速查（核心）

- public.getByOption → 使用多接口：/articles、/categories、/tags...（短期不提供聚合端点）
- public.searchArticle → GET /articles/search?keyword={keyword}&page={page}&limit={limit}
- public.getArticleByIdOrPathname → GET /articles/:id（pathname 待补齐：建议 GET /articles/by-path/:pathname）
- public.getArticleWithPassword → 待实现（建议：密码验证颁发短期 JWT 白名单，自动过期/清理）
- public.getArticlesByTagName → 先 GET /tags?name=... 获取 id，再 GET /tags/:id/articles
- public.getArticlesByCategory → GET /categories/:id/articles（需先获 id）
- public.getArticlesByTag → GET /tags/:id/articles
- public.addViewer → POST /article/:id/view 或 POST /analytics/record
- public.getViewer / getViewerByArticleIdOrPathname → 暂无公开查询（现偏向管理员统计）
- public.getAllCustomPages / getCustomPageByPath → 待实现（需要 Custom Pages 控制器）
- public.getTimeLineInfo → 待实现（Timeline 模块）
- public.getMeta / getBuildMeta → 待实现（元数据端点）
- auth.login/logout/profile/logs → v2 已有 login/profile/logout，logs 可通过管理员分析接口覆盖

---

## 缺口清单与验收标准

1. 自定义页面（高）

- 目标：GET /pages、GET /pages/:path
- 验收：根据数据库 `customPages` 返回内容；支持草稿/发布状态和缓存；404 语义清晰。
- 暂时不做

2. pathname 访问（高）

- 目标：GET /articles/by-path/:pathname（可配置是否允许通过 id 访问）
- 验收：同一资源 id 与 pathname 指向一致；冲突与迁移策略明确；缓存命中有效。

3. 时间线（高）

- 目标：GET /timeline（聚合文章/事件）
- 验收：分页/过滤可用；数据来源可配置；无 N+1 查询。

4. 文章密码（中）

- 目标：POST /articles/:id/auth，验证成功后发放短期令牌（白名单）
- 验收：令牌自动过期/清理；对未授权访问返回 403；审计日志可追踪。

5. 统一选项聚合（中）

- 目标：GET /options?include=articles,categories,tags,siteMeta,...（可选）
- 验收：强约束速率限制，避免“巨接口”滥用；按 include 精确返回；响应体稳定。

6. 公开访客统计（中）

- 目标：GET /analytics/public/overview、GET /analytics/public/article/:id
- 验收：脱敏、安全限流；与管理员统计口径一致；缓存策略合理。

7. 构建元数据（低）

- 目标：GET /meta/build
- 验收：版本、提交号、构建时间来源统一；在 CI/CD 注入。

---

## 兼容性与风险

- v1 访问明确返回 410，并提供文档与迁移建议，避免“静默失败”。
- 前端需适配 v2 响应格式（直接数据）与可能的分页参数差异。
- 对于 pathname/密码类改动，需设计灰度与回滚策略，避免 SEO 与访问的突变。

---

## 建议实施顺序（里程碑）

M1（用户可见断层修复）：自定义页面、pathname、时间线
M2（安全与可用性增强）：文章密码、公开访客统计
M3（体验优化）：聚合选项、构建元数据

每个模块并行开发但独立验收，统一走 e2e 用例与文档更新。

---

最后更新：2024-01-20
分析版本：v2.0.0
