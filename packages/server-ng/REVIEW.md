# V2 差距评审与落地计划（精简版）

## TL;DR

- v1 已彻底移除：所有 `/api/v1/*` 返回 410（Gone）并附带迁移提示，由全局中间件负责拦截。
- v2 现状：Articles、Categories、Tags、Auth、Analytics、RSS、Sitemap 等核心能力已具备，基础可用。
- 主要缺口（按优先级）：
  1. 时间线、2) 文章密码验证、3) 公开访客统计、4) 聚合选项、5) 构建元数据。
- 建议实施顺序：先补齐时间线，再处理安全与可用性增强（密码、统计），最后考虑体验优化（聚合、元数据）。

---

## v1 → v2 迁移速查（核心）

- public.getByOption → 使用多接口：/articles、/categories、/tags、/rss、/sitemap（短期不提供聚合端点）
- public.searchArticle → GET /articles/search?keyword={keyword}&page={page}&limit={limit}
- public.getArticleByIdOrPathname → GET /articles/:id 或 GET /articles/by-path/:pathname
- public.getArticleWithPassword → 待实现（建议：密码验证颁发短期 JWT 白名单，自动过期/清理）
- public.getArticlesByTagName → 先 GET /tags 获取并在客户端筛选 name，或后续提供 /tags/by-name/:name
- public.getArticlesByCategory → 现有为 GET /articles/category/:name（按名称获取文章）；如需按 id，可在后续补充 /categories/:id/articles
- public.getArticlesByTag → 待实现（按标签获取文章列表端点缺失）
- public.addViewer → POST /article/:id/view 或 POST /articles/pathname/:pathname/view 或 POST /analytics/record
- public.getViewer / getViewerByArticleIdOrPathname → 暂无公开查询（现偏向管理员统计：/admin/analytics/\*）
- public.getAllCustomPages / getCustomPageByPath → GET /public/customPage/all、GET /public/customPage?path={pathname}
- public.getTimeLineInfo → 待实现（Timeline 模块）
- public.getMeta → GET /public/meta
- public.getBuildMeta → 待实现（构建元数据端点）
- auth.login/logout/profile/logs → v2 已有 login/profile/logout/refresh/revoke-all/csrf-token，logs 通过 /auth/logs（管理员）

---

## 缺口清单与验收标准

### 已完成（近期）

- 自定义页面（Public）：GET /public/customPage/all、GET /public/customPage?path={pathname}，具备草稿/发布状态处理与 404 语义；已覆盖 e2e
- 文章 pathname GET 访问：GET /articles/by-path/:pathname，已覆盖 e2e

### 待办

1. 时间线（高）

- 目标：GET /timeline（聚合文章/事件）
- 验收：分页/过滤可用；数据来源可配置；无 N+1 查询。
- 现状：sitemap 中包含 /timeline，测试有期望；缺实际实现。

2. 文章密码（中）

- 目标：POST /articles/:id/auth，验证成功后发放短期令牌（白名单）
- 验收：令牌自动过期/清理；对未授权访问返回 403；审计日志可追踪。
- 现状：Article 实体含 password 字段，无验证端点；Category 已有 verify-password 可供参考。

3. 统一选项聚合（中）

- 目标：GET /options?include=articles,categories,tags,siteMeta,...（可选）
- 验收：强约束速率限制，避免“巨接口”滥用；按 include 精确返回；响应体稳定。

4. 公开访客统计（中）

- 目标：GET /analytics/public/overview、GET /analytics/public/article/:id
- 验收：脱敏、安全限流；与管理员统计口径一致；缓存策略合理。
- 现状：管理员端 /admin/analytics/\* 已完善，缺公开查询端点。

5. 构建元数据（低）

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

**已完成的 M1 项**：pathname、自定义页面

**剩余里程碑**：
M1（用户可见断层修复）：时间线
M2（安全与可用性增强）：文章密码、公开访客统计
M3（体验优化）：聚合选项、构建元数据

每个模块并行开发但独立验收，统一走 e2e 用例与文档更新。

---

最后更新：2025-08-16
分析版本：v2.0.0
