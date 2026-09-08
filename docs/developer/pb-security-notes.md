# PocketBase 安全语义笔记（OCR 规则包溯源卡片）

供 `.opencodereview/rule.json` 域 prompt 与代码评审引用的官方语义卡片。
来源：PocketBase 官方文档（经 Context7 `/websites/pocketbase_io` 拉取，2026-09-07）+ 本仓实测。
每张卡片标注文档出处；规则文本引用卡片编号（如 [S2]）。

## S1. API Rules 是"访问控制 + 数据过滤器"双语义

- 五规则：`listRule / viewRule / createRule / updateRule / deleteRule`（auth 集合另有 `manageRule`）。
- 规则表达式作为**过滤器**叠加在查询上：规则不满足时 list 返回 `200 {"items":[]}`，view 返回 404——
  **不是 403，也不会暴露集合存在性以外的信息，但也不会"拒绝"**。
- 推论：规则通过 ≠ 安全。行级规则放行 ⇒ 该行的**所有非 hidden 字段**都进了匿名响应。
  出处：pocketbase.io/docs/api-rules-and-filters。

## S2. 字段级响应整形 = `OnRecordEnrich`

- 官方机制（JSVM 示例，Go 对应 `app.OnRecordEnrich("collection")`）：

```js
onRecordEnrich((e) => {
  if (!e.requestInfo.auth || e.requestInfo.auth.get("role") != "staff") {
    e.record.hide("someStaffOnlyField")   // 字段从该次响应中消失
  }
  e.next()
}, "articles")
```

- `e.requestInfo.auth` 区分请求身份；`record.hide(field)` 使字段从 JSON 输出消失
  （本仓 enrich 钩子用 `Set(field, "")` 置空，语义等价可断言，字段名仍可见——见
  `vault/internal/article/enrich.go`）。
- 推论：任何"某些用户不该看到的字段"问题都应在此层解决，而不是指望行级规则。
  出处：pocketbase.io/docs/js-records。

## S3. 文件默认公开，敏感文件须 `protected` + file token

- FileField 默认 URL 公开可猜性靠随机文件名兜底；字段标记 `Protected` 后，
  访问需短时效 file token 且必须满足集合 viewRule。
- 推论：审计含 FileField 的集合（media 等）时，确认是否依赖"随机名"当访问控制。
  出处：pocketbase.io/docs/files-handling。

## S4. 认证体系分层

- `_superusers`（管理面 `/_/`）与 `users`（应用角色，本仓 role=admin/collaborator + permissions）是两套主体。
- `@request.auth.*` 在规则表达式里指 users 记录；Go 层 `e.Auth` 对 superuser 与 users 记录都可能非 nil——
  自定义 `requireAdmin` 检查 `role` 字段时对 _superusers 记录不适用（无 role 字段），需注意口径一致。
- 出自：pocketbase.io/docs/authentication；本仓 `internal/admin.requireAdmin` 实测口径。

## S5. 写路径钩子分层

- `OnRecordCreate/Update`（模型层，Go 直写 `app.Save` 也会触发）与
  `OnRecordCreateRequest/UpdateRequest`（仅 HTTP 请求路径触发）。
- 推论：审计/密钥剥离/字段派生（hasPassword）必须挂模型层；只挂 request 层会被
  Go 直写、import、迁移回填绕过。出处：pocketbase.io/docs/go-records / js-records；
  本仓事故：Go 层路由写入绕过 JSVM 审计钩子（internal/caddy/audit.go 注释自证）。

## S6. 内置能力默认关闭清单（部署层检查单）

- Settings.RateLimits（API 限流）、Batch API、Trusted Proxy（反代取真实 IP）、
  protected files、backup cron——默认均未启用/未配置。
- 出处：pocketbase.io/docs；本仓 `.snow/plan/pb-capabilities.md` 盘点。

## S7. 自研校验桥（internal/validation）与凭据隔离的交互（2026-09-08 事故）

- 校验桥对 models bundle 未声明的集合曾是 fail-closed（"missing from all model
  sources"）。后果：site_secrets 的 park 写入（MoveSecretsFromRecord → app.Save）
  在真实 serve 环境下**从未成功过**——隔离被自己的校验层打穿，fail-open 钩子还
  把明文密钥落回公开 site 行。修复：hook 层对未声明集合跳过（pb 自身字段校验
  仍然生效），测试 `TestHookSkipsUndeclaredCollection` 锁定。
- **recordValues 空 string 映射为"未设置"**：pb `Record.Get` 对未设 text/relation
  字段返回 `""`，而 zod `.optional()` 只豁免 `undefined`——`string().min(1)
  .optional()` 会拒绝空串（事故：audits 行 actor 为空被拒，审计静默丢失）。
- 新增内部集合（如 site_secrets）时必须同步：core schema artifact 重生成
  （`pnpm build:models`，Makefile 规则），否则校验桥按未声明集合跳过。

## S8. site_secrets 隔离运维要点

- 隔离钩子 fail-closed：park 失败即拒绝 site 写（宁可 admin 重试，不可密钥回公开行）。
- `site_secrets.key` 有 UNIQUE 索引（迁移 1783600202）；hook 是 find-then-create，
  并发首写靠该索引兜底。
- 清除凭据的唯一正确渠道：直接编辑 site_secrets main 行。site 行的密钥字段隔离后
  恒为 `null`，不能当"管理员刚清空"的信号（否则 pb Admin UI 每次保存 site 行都会
  误清密钥）。
- OCR（全量 4 组）14 条意见裁决：修 3（fail-open、secretsRecord 错误混淆、key 无
  唯一索引）+ 记录 2（迁移 hooks 风险随 UnsafeWithoutHooks 化解除、ErrNoRows 混淆
  由 1783600202/新代码覆盖）+ 拒 2（site 行 null 当清除信号会误清、park 先行属
  幂等且方向安全）+ 已满足 7（docs 登记、visits 注释改写等）。
- nuclei 黑盒实测（v3.11.1，7 条不变量模板）：修复态 0 findings；旧实例（隔离前）
  命中 2 条 high（search 锁文泄漏、RSS 内容泄漏）——模板具备证伪能力。
  注意：nuclei 3.11 单文件多文档 YAML 只加载第一条，harness 已运行时拆分。
