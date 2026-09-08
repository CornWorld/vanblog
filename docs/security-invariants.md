# 安全不变量（Security Invariants）

本文件是 vanblog 安全不变量的**唯一事实源**。三处消费方必须从这里生成，不得各自维护：

- **白盒**：OCR 审查规则 `.opencodereview/rule.json`（域 prompt 引用本文）
- **黑盒**：nuclei 模板 `scripts/pentest/templates/vanblog-invariants.yaml`
- **守护测试**：`vault/internal/article/unlock_test.go` 等 Go 集成测试

任何改动公开 API 面（集合规则、Go 路由、SSR 数据读取）的 PR，必须对照本文检查；违反任一不变量的代码必须在 PR 中显式论证。

## 1. 匿名可读面清单

匿名（无 Authorization/Cookie）请求 `/api/collections/*` 时：

| 集合 | 匿名可见性 | 敏感字段处置 |
|---|---|---|
| `site` | 公开读（渲染需要） | **零凭据字段**。s3Config/syncConfig/syncRemote/outputConfig 一律在 `site_secrets`；对 site 行的写入由钩子自动剥离密钥（`internal/site.MoveSecretsFromRecord`） |
| `site_secrets` | 不可列不可读（admin-only 五规则） | 唯一凭据存放处 |
| `posts` | 仅 `deleted=false && status="published" && private=false` | 密码锁文章：匿名读到的 `content`/`password` 必须为空（`OnRecordEnrich` 遮蔽），`hasPassword` 保留供 UI 判断 |
| `categories` | 公开读 | `password` 对匿名必须为空（enrich 遮蔽） |
| `tags` | 公开读 | 无敏感字段 |
| `users` | 登录且 admin-or-self | email/password/tokenKey 等认证字段框架级隐藏 |
| `revisions`/`audits`/`visits`/`media`（非 img）/`_superusers`/`_mfas` 等 | 不可匿名读 | — |

**不变量 I1**：匿名 list 任何集合，响应字段里不得出现凭据（AK/SK/sshKey/密码/token/内嵌凭证 URL）。
**不变量 I2**：匿名读 `posts` 时，`hasPassword=true` 的行 `content === "" && password === ""`。

## 2. 锁定内容的服务端执行

- "锁定/解锁/验证密码"语义**必须在服务端完整执行**。匿名 SSR/客户端能从 pb REST 读到的行 = 攻击者可见；任何只依赖 UI 形态的锁定都是装饰（事故：posts.password 泄漏，2026-09-07 修复）。
- 解锁凭证必须是**服务端签名的不可伪造 token**（HMAC，密钥不出服务器），禁止字面量哨兵值（如 `"true"` cookie）。
- 解锁端点必须：无 oracle（缺失/未发布/无密码文章统一 404）；密码比对常数时间；失败限速（每 IP 窗口计数）。
- 文章内容的所有消费方（feed/atom、search、timeline、sitemap）复用同一套可见性过滤（`status='published' && deleted=false && password=''`），禁止各自手写 filter 造成旁路（事故：feed 泄漏 200 字摘要）。

## 3. 凭据存放

- 凭据类配置只存 `site_secrets`（admin-only），访问只经 `internal/site` 包（`S3Config`/`MoveSecretsFromRecord`/`HealSecrets`）。
- `site_secrets.key` 必须保持单例行语义：唯一索引 `idx_site_secrets_key_unique`（迁移 1783600202）+ `secretsRecord` 区分 no-row（新建）与真实读错误（报错，禁止再插行）。
- 隔离钩子（site create/update 上的 `MoveSecretsFromRecord`）**fail-closed**：park 失败必须拒绝 site 写。剥密钥失败还放行 = 凭据落回公开行。
- **清除凭据的渠道是直接编辑 `site_secrets` main 行**（pb Admin UI → site_secrets）。隔离生效后 site 行的密钥字段永远是 `null`，不能作为"管理员刚清空"的信号——若把 site 行上的 null 当清除意图，pb Admin UI 每次正常保存 site 行都会误清密钥。
- 密钥明文存 SQLite 是已知部署层风险（SECURITY.md），不因隔离而豁免卷加密。

## 4. 公开写路由

- 公开写端点（如 `POST /api/vanblog/visits/record`）必须有输入上限（path 前缀/长度、id 长度）且文档如实描述防护等级；**注释/迁移文本声称的防护必须能在代码中指出实现位置**（事故：迁移注释声称 abuse checks 实际不存在）。
- admin 域操作（备份/导出/路由/用户/删除）一律 `requireAdmin` 实调校验。

## 5. API 形态语义（PocketBase 特有）

- 集合规则是**行级过滤器**：规则不满足时匿名 list 返回 `200 {"items":[]}` 而非 403。规则通过 ≠ 安全；行公开 ⇒ 必须逐字段回答"匿名可读是否可接受"。
- 字段级响应整形用 `OnRecordEnrich`（按 `e.RequestInfo.Auth` 区分身份）；新增敏感字段时必须同时回答"落在哪个集合、谁可读、enrich 是否遮蔽"。
- Go 层直写（`app.Save`）绕过 `OnRecord*Request` 钩子；依赖写路径钩子的逻辑（审计、密钥剥离）必须确认写入来源全集。

## 6. 变更流程

- 新集合/新字段/新路由/新消费方，PR 描述必须含"公开读面影响"一节。
- 违反不变量的应急修复：先加守护测试钉住（红→绿），再改实现。
