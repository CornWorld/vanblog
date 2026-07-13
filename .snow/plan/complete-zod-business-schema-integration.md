# 完成 Zod v4 Business Schemas 接入

## Context

当前迁移只覆盖 `posts`、`site` 两个 collection，`exports.models` 也只有这两项；PocketBase 的 11 个非系统 collections 仍主要依赖 `virtual:pb-types` 生成的 storage/response 类型。Go 侧已经采用 Primo 风格的 `go:embed + Goja + safeParse`，但模型 bundle 存在两个输出副本且真正 embed 的文件不是 `build:models` 当前生成目标。现有 schema 还存在日期 `z.any()`、`expand` 任意 passthrough、`commentsConfig` 无边界 fallback、遗漏 Waline、theme 未按 PB select 建 enum，以及多类 config JSON 仍为 LooseJson 等 fidelity 缺陷。

目标是在**保留 PB migrations 作为 storage schema 唯一事实来源**的前提下，为 11 个业务 collections 建立 Zod v4 runtime/business schemas，在 Go `OnRecordValidate` 中继续使用 `safeParse` 且不增加 DevMode skip；随后将 SDK/前端的业务读取边界接到 Zod，同时保留必要的 PB storage/write 类型，统一 bundle 生成路径并让 Docker 可复现构建。

## Analysis

- **受影响文件**：
  - `vault/internal/validation/validation.go`：Goja payload 提取、schema 查找与 `safeParse` 执行入口；需要可测试化和日期归一化。
  - `sdk/src/models/fields.ts`、`posts.ts`、`site.ts`、`index.ts`：现有 schema、共享字段及 `models` 注册表。
  - `sdk/src/index.ts`、`sdk/src/services.ts`、`sdk/package.json`：SDK 公共业务类型、读取解析和 storage 子路径导出。
  - `app/src/**/*.astro`、`app/src/loaders/posts.ts`、`app/src/env.d.ts`：大量 `*Response` 消费与直接 PB CRUD 边界。
  - `app/vite-pb-types.mjs`、`app/astro.config.mjs`、`app/package.json`：当前构建时依赖 live PB 的 virtual module。
  - `models.config.mjs`、`vault/models.config.mjs`、`package.json`：重复配置及错误 bundle 输出位置。
  - `Dockerfile`：Go 编译前没有生成 embed 所需模型。
  - `vault/pb_migrations/1782200000_init_vanblog_collections.go`、`1783000000_create_moments_collection.go`、`1783000001_create_bookmarks_collection.go`：只作为 storage schema/fidelity 对照，不因本任务重写历史 migration。
- **新增文件**：
  - `sdk/src/models/tags.ts`
  - `sdk/src/models/categories.ts`
  - `sdk/src/models/users.ts`
  - `sdk/src/models/revisions.ts`
  - `sdk/src/models/media.ts`
  - `sdk/src/models/visits.ts`
  - `sdk/src/models/audits.ts`
  - `sdk/src/models/moments.ts`
  - `sdk/src/models/bookmarks.ts`
  - `sdk/src/models/common.ts`：PB id、系统字段、归一化日期、基础 response/expand 组合等共享 schema。
  - `sdk/src/storage/pb-types.ts`：显式、可提交的 PB storage/read/write 类型产物，不参与业务 schema 定义。
  - `scripts/generate-pb-storage-types.mjs`：显式从已迁移的 live PB schema 生成上述 storage 类型；不在普通 Astro/Docker 构建时联网。
  - `sdk/src/models/models.test.ts`：Zod v4 schema fixture、合法/非法输入和兼容性测试。
  - `vault/internal/validation/validation_test.go`：Go→Goja payload 与 `safeParse` 测试。
  - `vault/scripts/verify_zod_crud.go`：在一次性 PB data 目录执行 11 collections runtime CRUD/兼容性矩阵。
- **依赖**：Zod `^4.4.3`（已存在）、Goja、PocketBase 0.39 runtime、`pocketbase-typegen`（仅显式 storage type 生成）、项目现有 pnpm/Vite/Astro/Go/Docker 工具链。
- **复杂度**：complex。
- **风险区域**：历史记录的空值/旧 JSON 形状；Goja 中 DateTime/File/Relation 的实际 payload；auth collection 的系统字段和 write-only password 字段；partial update 被错误按完整 create payload 校验；multipart media；typed expand 的循环引用；Docker 构建顺序；把业务 schema 误当作 PB storage schema。

## 核心决策与安全策略

1. **不要移除 PB storage types 这一层，但应移除 `virtual:pb-types` 机制。** 当前 virtual module 让 `astro check/build` 和 Docker 隐式依赖运行中的 PB，且把 storage response 当成 business contract。改为显式生成、提交并通过 `@vanblog/sdk/storage` 子路径导出的 `sdk/src/storage/pb-types.ts`；它仅用于 PB adapter、FormData、原始 `Create/Update` payload 和 schema drift 对照，不从 SDK 根入口继续鼓励导出 `*Response`。
2. **PB migrations 仍是 storage schema；Zod 是业务/runtime schema。** 不修改旧 migration 来“匹配”Zod。新增 schema 必须先与 live `/api/vanblog/schema` 和真实 record payload 对齐。
3. **分离 persisted/read/create/update schema。** `models` map 只注册 Go `OnRecordValidate` 实际可见的 persisted business payload；SDK 写入使用独立 `CreateInputSchema`/`UpdateInputSchema`，读取使用含 PB system fields 的 response schema。不要用 `Partial<Response>` 作为 update 类型。
4. **users/auth 特殊处理。** Go payload builder 当前跳过 system fields，因此 `password`、`passwordConfirm`、`tokenKey` 等不得在 Go persisted schema 中设为必填，也不得尝试验证哈希。密码长度、一致性、旧密码等继续由 PB auth storage validation 保证；Zod 的 `UserCreateInputSchema`/`UserPasswordUpdateSchema` 只在 HTTP/SDK 写入边界验证明文，并确保普通 profile update 不要求密码。`email`、`emailVisibility`、`verified` 是否进入 Go schema以 live payload 观测结果为准。
5. **兼容优先、禁止盲目 strict。** collection 顶层不使用 `.strict()`；未知 storage 字段在 `safeParse` 中可被忽略，因为解析结果不会回写 record。稳定的小型值对象可 strict；历史 JSON config 使用“已知键有类型 + 未知键保留”的 Zod v4 loose/catchall 过渡策略，并通过 fixture 明确记录兼容范围。只有在 live 数据审计零失败后，才将确定必填的字段收紧。
6. **无 DevMode bypass。** 任何 validation 失败都保持阻止保存；兼容问题通过 schema/versioned compatibility branch 和数据清理解决，不在 Go hook 添加环境跳过。

## Phases

### Phase 1：先验证 live schema、真实 payload 与现有数据兼容性
- **Goal**：在扩展 schema 前得到可重复的 storage/payload/fidelity 基线，并修正现有 posts/site 的已知缺陷。
- **Files**：`vault/internal/schema/schema.go`（只作为 live schema 来源）、`vault/internal/validation/validation.go`、`vault/internal/validation/validation_test.go`、`vault/scripts/verify_zod_crud.go`、`sdk/src/models/common.ts`、`sdk/src/models/fields.ts`、`sdk/src/models/posts.ts`、`sdk/src/models/site.ts`、`sdk/src/models/models.test.ts`，以及三份 PB migration（只读对照）。
- **Steps**：
  - [ ] 将 `validation.Register` 内的 record→JS 值提取拆为可单测 helper，并对 `types.JSONRaw`、单/多文件、relation、空值和 PocketBase DateTime 做确定性转换；优先把 DateTime 归一为 ISO 字符串，再由 `common.ts` 的日期 schema 校验，消除 `z.any()`，同时保持最终调用仍为 Zod `safeParse`。
  - [ ] 在 `verify_zod_crud.go` 增加 `--dir`/只读审计模式：对**生产 `pb_data` 的副本**枚举 11 个 live collection 字段和全部现存 records，输出 collection/field/path 级失败，敏感字段（password、token、S3 secret、SSH key）必须脱敏；绝不直接保存生产数据。
  - [ ] 逐项修复现有 fidelity：`theme` 对齐 `default|minimal|magazine|custom`；`commentsProvider` 增加 `waline`，为 Waline/Artalk/Giscus/External/Disabled 建明确 schema，移除“任意对象即成功”的 fallback；给 display/output/sync/s3 config 建已知字段 schema；`PostExpandSchema` 改为 typed relation response，而不是空对象 passthrough。
  - [ ] 为默认 migration 数据、当前 UI 写入数据和匿名化历史样本建立测试 fixtures；先以兼容 schema 跑零失败基线，再只对 live storage 确认必填的字段收紧。对 `{}`、`null`、空字符串、旧字段和新增未知字段分别给出期望。
- **Done when**：`go test ./internal/validation` 与 schema tests 通过；对生产数据副本的只读审计无未解释失败；posts/site 的合法历史记录可 parse，已知非法 enum/config/expand fixture 会失败；Go hook 中不存在 DevMode skip。

### Phase 2：补齐 9 个 collection schemas 并注册全部 models
- **Goal**：让 `exports.models` 覆盖全部 11 个非系统 collections，同时形成可用于 SDK 的 read/create/update business contracts。
- **Files**：新增的 `tags.ts`、`categories.ts`、`users.ts`、`revisions.ts`、`media.ts`、`visits.ts`、`audits.ts`、`moments.ts`、`bookmarks.ts`，以及 `sdk/src/models/common.ts`、`sdk/src/models/index.ts`、`sdk/src/models/models.test.ts`。
- **Steps**：
  - [ ] 按 migration/live schema 实现 tags/categories/users：select 使用 Zod enum，relation 使用 PB id schema，categories.meta 明确“业务已知键 + 兼容未知键”；users 分离 persisted response、create、profile update、password update，覆盖 permissions enum、email/verified 与 password/passwordConfirm 的不同生命周期。
  - [ ] 实现 revisions/media/visits：snapshot 定义为可版本化的 post snapshot schema；media 区分 local/s3/external 并兼容 multipart 文件写入边界；visits 的 `date`（统计 key）与 DateTime 字段不可混淆。
  - [ ] 实现 audits/moments/bookmarks：result/static/storage/category 等 select 完整枚举，required relation/text/url 与 migration 一致；audit detail 采用按 action 可辨识的已知结构并为历史 action 保留受控兼容分支。
  - [ ] 在 `sdk/src/models/index.ts` 导出全部 schema/推导类型，并把 `models` 精确注册为 11 个 collection 名；persisted map 不注册 expand、write-only password 或 API-only payload schema。
  - [ ] 增加表驱动测试：每个 collection 至少覆盖最小合法 persisted record、完整 response、合法 create/update、非法 enum/type、nullable/empty 历史形状和 typed expand。
- **Done when**：bundle 中 `exports.models` 恰好包含 11 个目标 collection；所有模型单测和 `go test ./internal/validation` 通过；生产数据副本审计仍为零未解释失败；新增 schema 无 `z.any()`、空对象 passthrough 或通用 LooseJson fallback。

### Phase 3：迁移 SDK/frontend 消费者，同时保留隔离的 PB storage types
- **Goal**：业务读取在信任边界经过 Zod，写入使用用途明确的 input schema；前端不再把生成的 `*Response` 当作业务模型，也不再在普通构建时连接 live PB。
- **Files**：`scripts/generate-pb-storage-types.mjs`、`sdk/src/storage/pb-types.ts`、`sdk/package.json`、`sdk/src/index.ts`、`sdk/src/services.ts`、`app/vite-pb-types.mjs`、`app/astro.config.mjs`、`app/package.json`、`app/src/env.d.ts`、`app/src/loaders/posts.ts`、`app/src/pages/**/*.astro`、`app/src/layouts/BaseLayout.astro`、直接 CRUD 的 admin 页面（`edit/[id].astro`、`site.astro`、`users.astro`、`media.astro`、`tags.astro`、`categories.astro`）。
- **Steps**：
  - [ ] 将现有 `vite-pb-types.mjs` 的生成逻辑迁为显式脚本，生成稳定的 `sdk/src/storage/pb-types.ts`；SDK 新增 `./storage` export，根 `index.ts` 改为导出 Zod 推导 business types。生成脚本需与 `/api/vanblog/schema` 比对 11 个 collections，并可在 CI 中执行 drift check，但 Astro/Docker 常规 build 不调用网络。
  - [ ] 在 `sdk/src/services.ts` 建立统一 parse helper：PB `getOne/getList/getFullList/update` 返回的 unknown/storage response 在返回业务层前调用对应 response schema 的 `safeParse/parse`；服务签名改用 `Post`/`Site` 等 business response 和明确的 `SiteUpdateInput`，禁止继续使用 `Partial<SiteResponse>`。
  - [ ] 按依赖从 loaders/layout/public pages 再到 admin pages 迁移所有 `*Response`：读取类型改为 Zod inferred response，expand 用 typed expand schema；直接 PB 读取必须在页面边界 parse，或改走已解析的 SDK service。不要用类型断言代替 parse。
  - [ ] 写操作改用 collection-specific create/update schema；users 页面分别验证创建、资料更新和密码轮换，media 的 `FormData/File` 保持 storage adapter 路径；最后从 `astro.config.mjs` 移除 plugin、删除 virtual module 与 `.astro/pb-types.d.ts` 引用，并移除不再需要的 app `pocketbase-typegen` 依赖。
- **Done when**：代码搜索无 `virtual:pb-types`，业务代码无 `PostsResponse/SiteResponse/...`；PB storage 类型只从 `@vanblog/sdk/storage` 在 adapter/write 边界使用；在没有 PB server 的环境中 `pnpm --filter vanblog-app exec astro check` 和 `pnpm --filter vanblog-app build` 均通过且无诊断错误。

### Phase 4：统一模型 bundle，并接入本地、CI 与 Docker 构建链
- **Goal**：只生成一份 Go embed 使用的 bundle，避免陈旧副本，并保证 Docker 总是从当前 Zod 源码生成模型后再编译 Go。
- **Files**：`models.config.mjs`、`vault/models.config.mjs`、`package.json`、`vault/internal/validation/models.js`、`vault/pb_hooks/lib/models.js`、`Dockerfile`、相关 `.gitignore`/CI workflow（如现有 workflow 执行 build）。
- **Steps**：
  - [ ] 保留根 `models.config.mjs` 为唯一配置，输出直接设为 `vault/internal/validation/models.js`，选择已由 Goja runtime test 证明支持的 target（优先 ES2015，而非未经验证的 ES2020）；CJS 继续内联 Zod，文件名与 `//go:embed models.js` 完全一致。
  - [ ] 删除陈旧 `vault/models.config.mjs` 和不再消费的 `vault/pb_hooks/lib/models.js`；`build:models` 后增加断言，验证 bundle 可被 Goja 编译、`exports.models` 有且仅有 11 项，并避免生成两个可漂移副本。
  - [ ] 重排 Docker stages：先用 Node/pnpm models-build stage 安装必要 workspace 依赖并执行 `build:models`，再将该唯一产物复制进 go-build stage 的 `internal/validation/models.js` 后执行 `go build`；Astro stage 复用依赖但不得访问 live PB。
  - [ ] 更新根 `build:all`/CI 顺序为模型测试与 bundle → Go tests/build → Astro check/build，并增加“重新生成后工作树内容一致”或 checksum drift 检查（执行任何 Git 命令前按项目安全规则取得用户同意）。
- **Done when**：仓库和镜像构建链只存在一个有效 `models.js`；清理后从源码执行 `pnpm build:models`、Goja bundle assertion 和 `go build` 均成功；Docker build 不复用宿主机陈旧 bundle，也不要求 PB 在线。

### Phase 5：全套 runtime CRUD、升级数据与 Docker 验收
- **Goal**：同时证明类型检查、编译、真实 Goja validation、auth 写入、历史数据升级和容器运行均正确。
- **Files**：`vault/scripts/verify_zod_crud.go`、`vault/internal/validation/validation_test.go`、`sdk/src/models/models.test.ts`、`Dockerfile`；测试过程中只使用临时目录或生产数据副本。
- **Steps**：
  - [ ] 执行静态/构建矩阵：models tests、`pnpm build:models`、`pnpm --filter vanblog-app exec astro check`、`pnpm --filter vanblog-app build`、`cd vault && go test ./...`、`go build ./...`；要求零错误、零新增 IDE diagnostics（若 IDE 连接不可用，以 Astro/TypeScript/Go diagnostics 命令替代并记录该限制）。
  - [ ] 在全新临时 PB data 上运行 11 collection CRUD：每个 collection 至少一次合法 create/read/update；再对 enum、relation、JSON config、日期各做一次预期失败，确认错误包含 collection 和 Zod path，且没有 DevMode 旁路。
  - [ ] 对 users 单独验收：创建时 password+passwordConfirm、普通 profile update 不带密码、密码轮换带 confirm、错误 confirm 被拒绝；确认 Go persisted schema 不泄露或错误要求 tokenKey/password hash。对 media 使用真实 multipart `File/FormData` 验证，而不是字符串假数据。
  - [ ] 复制一份现有生产 data 作为“升级卷”，先跑全量只读 parse，再在副本中对每类历史记录执行受控 no-op/单字段 update；任何失败先扩充受控兼容分支或安排显式数据 migration，禁止用 `.passthrough()` 全放行或 validation skip 掩盖。
  - [ ] 执行 `docker build --target prod`，分别用空卷和升级卷启动镜像；检查迁移启动、Go embed bundle、Astro 页面、11 collection CRUD/auth、重启后持久化。容器内不得存在需要运行时生成的模型步骤。
- **Done when**：上述 Astro check/build、Go test/build、runtime CRUD、历史升级卷和 Docker 空卷/升级卷全部通过；合法历史更新不被误拒绝，非法业务 payload 被 `safeParse` 阻止；无诊断错误且不依赖 live PB 完成构建。

## Verification Commands（执行阶段参考）

```sh
# Schema tests / bundle
pnpm --filter sdk test
pnpm build:models

# Frontend must work with PB stopped
pnpm --filter vanblog-app exec astro check
pnpm --filter vanblog-app build

# Go
cd vault
go test ./...
go build ./...
go run ./scripts/verify_zod_crud.go --dir /absolute/path/to/disposable-pb-data

# Container
cd /Users/corn/Code/vanblog
docker build --target prod -t vanblog:zod-validation .
```

实际实现 `verify_zod_crud.go` 时应提供明确的临时目录参数和拒绝已知生产目录的保护；上面的路径必须替换为由测试脚本创建/确认的真实副本路径，不能使用生产 `/Users/corn/Code/vanblog/pb_data` 直接做写测试。

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 对 collection 顶层盲目 strict | 新增 PB 字段或历史字段使所有更新失败 | 顶层默认 strip/兼容；解析结果不回写；通过 drift check 提醒而非阻断未知字段 |
| 历史 JSON config 形状不一致 | site 更新被全量 validation 拒绝 | 先审计生产副本；已知键 typed、未知键受控保留；必要时新增显式数据 migration |
| auth 系统字段被 Go extractor 跳过 | users schema 错误要求 password/tokenKey | persisted schema 与 create/password-update schema 分离；PB 继续负责 auth storage validation |
| password 明文进入日志/fixture | 凭证泄漏 | 审计脚本强制脱敏；fixtures 使用假值；不记录 token、secret、SSH key |
| partial update 按 create schema 校验 | 修改昵称却被要求 email/password | SDK 使用独立 UpdateInput schema；Go hook验证合并后的 persisted record，而非原始 patch |
| `expand` 循环 relation | bundle 膨胀或 schema 初始化循环 | 使用受限深度的 response schema/`z.lazy`，只描述实际查询 expand，不把 expand 放入 persisted `models` map |
| File/FormData 与 persisted filename 不同 | media 写入误拒绝 | write schema 接受 File/FormData adapter；Go persisted schema只验证归一化后的 filename(s) |
| bundle 目标语法 Goja 不支持 | Go 启动时编译失败 | build 时运行真实 Goja compile test；采用验证过的 ES2015 target |
| Docker stage 使用旧 models.js | 本地通过、镜像运行旧 schema | Docker 先生成 bundle再 Go compile；单一输出路径 + checksum/assertion |
| 移除 virtual types 后 storage 写入失去类型 | auth/file payload 回归 | 保留显式 `@vanblog/sdk/storage` 类型和 Create/Update 工具类型，只移除 virtual/live-build 机制 |

## Rollback Strategy

- 每一 phase 单独提交和验收；若 consumer migration 出现问题，可暂时让 adapter 返回旧 storage 类型，但不得关闭 Go `safeParse` 或加入 DevMode skip。
- schema 收紧导致历史数据失败时，回退该字段的“收紧规则”到最近一个明确兼容分支，并保留失败 fixture；随后通过新的 forward-only PB data migration 清理数据。不要改写已有 migration。
- bundle/Docker 改造失败时，可恢复前一版生成顺序和已知可用的 embed bundle，但只能保留一个权威输出；不得长期恢复双副本。
- 涉及 Git 回退、reset、checkout 或 revert 时，必须先向用户确认；本计划不授权任何自动 Git rollback。

## Assumptions

- 当前 live schema endpoint `/api/vanblog/schema` 可在本地启动的 Vault/PocketBase 实例访问。
- `moments` 和 `bookmarks` 虽源于插件 migration，但已属于当前 11 个非系统 storage collections，因此进入统一 `models` map。
- 当前 IDE diagnostics 服务不可用；实现阶段必须以 `astro check`、TypeScript/model tests、`go test` 和 `go build` 补足，并在 IDE 可用时再确认无新增 diagnostics。
