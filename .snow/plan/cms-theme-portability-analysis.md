# CMS 主题可移植性分析与治理方案

## Context

VanBlog 当前同时存在两种容易被用户都称作“主题”的能力：

- “调色盘”是内置前端上的视觉配置，当前 `SiteSchema` 已包含 `theme/defaultTheme/customCss/customHead/customHtml/customScript` 等外观字段。
- “主题”是独立 Astro 前端。当前 Astro 的 live collection 只显式接入 `posts`，通过 `@vanblog/sdk` 读取 PocketBase。

同时，VanBlog 已有集中式 Zod 业务模型、拟议中的 admin-only npm schema registry，以及插件独立 manifest + collection 的雏形。真正的风险不在 schema 能否传给前端，而在主题是否能无边界地改变核心模型、写入数据，却没有所有权、依赖、迁移和退出协议。Typecho 式 lock-in 往往正来自“主题表面是展示层，实际上偷偷成为内容模型所有者”。

目标是建立一套用户可理解、机器可检查、可预演和可回滚的主题扩展模型：普通主题保持高度可移植；高级主题可以声明扩展，但必须显式暴露代价和退出路径。

## Analysis

- **Affected files（未来实施）**:
  - `sdk/src/models/site.ts`：当前站点身份、视觉、功能集成和运行配置混杂，需要在契约层拆分所有权。
  - `sdk/src/models/posts.ts`：核心文章模型；主题不得直接无声明地追加强依赖字段。
  - `app/src/live.config.ts`, `app/src/loaders/posts.ts`：当前 Astro 内容入口只声明 posts，未来应按授权后的 capability 生成只读 client/schema，而非给予管理 API。
  - `plugins/*/manifest.json`：已有声明式 route/nav 能力，可演进为统一扩展 manifest，但主题和插件的数据所有权必须不同。
  - `vault/pb_migrations/*`：当前插件 collection 由产品代码 migration 创建，down migration 会删数据；未来第三方扩展不能沿用“卸载即隐式删库”。
  - `.snow/plan/git-backed-schema-registry.md`：schema registry 可作为版本化契约传输层，但不能成为迁移执行或授权机制。
- **New files（未来建议）**:
  - 版本化 `theme-manifest.schema.json` 与 `migration-plan.schema.json`。
  - 主题安装记录、资源所有权账本、迁移运行记录和 backup catalog 对应的服务端模型。
  - manifest validator、schema diff classifier、preview orchestrator、transaction/rollback coordinator。
- **Dependencies**: PocketBase collection schema API、不可变主题 artifact、`@vanblog/schema` 契约包、对象/文件备份存储、Astro preview runtime。
- **Complexity**: complex。
- **Risk areas**: 核心字段污染、跨主题字段语义冲突、主题与插件争夺资源、不可逆数据转换、旧主题版本不可获取、预览副作用、凭据泄漏、AI 误判迁移、备份不可恢复。

## 产品结论

### 一句话心智模型

**内容属于站点，外观设置属于某个主题，主题扩展数据由主题托管但始终属于用户，插件数据属于插件；换主题默认只换渲染，不删任何内容。**

后台不要把所有东西都放在“主题设置”里。建议用户看到四层：

| 层 | 用户理解 | 典型数据 | 生命周期 | 默认可移植性 |
|---|---|---|---|---|
| 核心内容 | “我的站点内容” | posts、tags、categories、media、authors、站点身份、SEO canonical 字段 | 独立于主题/插件 | 所有主题必须能读取基础子集 |
| 主题设置 | “这个主题怎么显示” | 色彩、字体、布局、卡片密度、hero 图、组件开关 | 按 `themeId` 保存配置快照 | 切回该主题自动恢复；不应承载业务事实 |
| 主题数据 | “这个主题附带的高级内容结构” | portfolio projects、商品展示元数据、首页策展条目、主题专属 post extension | 停用时保留/只读；卸载时单独选择归档/导出/删除 | manifest 必须说明替代主题能否消费及导出格式 |
| 插件数据 | “某项独立功能的数据” | comments、moments、bookmarks、表单提交、分析数据 | 独立于主题；换主题不受影响 | 通过 capability/API 被多个主题消费 |

“站点设置”还应从“主题设置”中分离：站点名称、域名、导航语义、SEO、评论提供方等属于核心或插件配置；颜色、排版和布局才属于调色盘/主题。`customScript/customHead` 应视为高风险集成能力，而非普通视觉配置。

### 调色盘与主题

- **调色盘**：当前内置前端的轻量 appearance profile。只改 design tokens 和受限展示选项，不创建 collection，不迁移内容，不声明后端权限。切换应即时、无备份要求。
- **主题**：可独立部署的 Astro presentation package。它至少声明核心 API 兼容范围和 routes；可能带主题设置；只有“高级扩展主题”才可申请主题数据资源。
- UI 中应使用两个明确入口：“外观 / 调色盘”和“前端 / 主题”，避免把它们展示成同一级皮肤选择器。

## 能力与依赖模型

### 能力等级

| 等级 | 能力 | 安装体验 | 可移植性承诺 |
|---|---|---|---|
| L0 展示主题 | 只读稳定 Core Content API + theme settings | 可直接预览/激活 | 高，切换无 schema 变化 |
| L1 集成主题 | 声明依赖插件及只读 capability，如 comments/search/moments | 缺依赖时引导安装或降级 | 中高，数据仍归插件 |
| L2 扩展主题 | 创建命名空间 collection 或 core entity sidecar extension | 强制 diff、备份、迁移确认 | 中，必须提供导出/停用策略 |
| L3 核心模型变更 | 修改核心 collection 字段、规则或语义 | 默认禁止第三方主题；仅可信产品 migration | 低，不应包装成普通主题能力 |

核心原则：主题需要“商品列表”时，优先依赖 commerce 插件，而不是自己创建 commerce collection。可复用、跨主题有业务意义的数据模型应晋升为插件；主题数据只用于该主题展示语义。判断问题是：“换掉所有前端后，这份数据仍然有独立业务价值吗？”有则应属于核心或插件，不属于主题。

### Machine-readable manifest 草案

```json
{
  "manifestVersion": 1,
  "id": "com.example.portfolio",
  "version": "2.1.0",
  "artifact": { "integrity": "sha512-...", "signature": "..." },
  "engines": {
    "vanblog": ">=1.8 <2",
    "schema": ">=3.2 <4",
    "astro": "^6"
  },
  "coreContent": {
    "reads": ["posts", "tags", "categories", "media", "siteIdentity"],
    "requiredFields": ["posts.title", "posts.content", "posts.pathname"],
    "optionalFields": ["posts.cover", "posts.excerpt"]
  },
  "themeSettings": {
    "schema": "./schemas/settings.json",
    "schemaVersion": 3,
    "migrations": ["settings:2->3"]
  },
  "dependencies": {
    "plugins": [{ "id": "org.vanblog.comments", "range": ">=2", "optional": true }],
    "capabilities": ["content.read", "media.read"]
  },
  "resources": {
    "collections": [{
      "logicalName": "projects",
      "physicalName": "theme__com_example_portfolio__projects",
      "schema": "./schemas/projects.json",
      "ownership": "theme",
      "onDeactivate": "retain-readonly",
      "onUninstall": "retain"
    }],
    "entityExtensions": [{
      "entity": "posts",
      "namespace": "com.example.portfolio",
      "schema": "./schemas/post-extension.json"
    }]
  },
  "migrations": {
    "plan": "./migrations/plan.json",
    "supportsRollbackTo": ["2.0.0"],
    "exporters": ["json", "csv"]
  },
  "fallbacks": {
    "missingOptionalPlugin": "hide-comments",
    "missingOptionalField": "omit-component"
  }
}
```

关键约束：

- ID 使用反向域名或 registry scope，物理资源必须从 ID 派生命名空间，禁止占用 `posts_extra` 一类公共名字。
- `requiredFields` 只能指向当前 core schema 或主题拥有的 sidecar；主题不能把某个 optional core 字段悄悄升级为全站必填。
- 依赖区分 required/optional，并声明缺失时 fallback。循环依赖和依赖主题应禁止；主题只能依赖插件/capability。
- 权限按最小 capability 授予。前台主题永远不获得 admin token；admin-only registry 只在可信 build/install service 中使用，产出裁剪后的只读类型和客户端。
- artifact、manifest、schema、migration plan 都需签名/哈希绑定；版本不可变。

### 数据建模建议：Sidecar 优先

不要让主题直接向 `posts` collection 加 `accentColor/eventDate/productPrice`。使用一对一 sidecar：

```text
core posts
  id, title, content, pathname, status, ...

theme__com_example_event__post_ext
  postId -> posts.id
  eventDate
  venue
  ticketUrl
```

优点是核心 schema 稳定、字段所有权明确、卸载不需改 posts、冲突可隔离。代价是查询和编辑 UI 多一次 join。对于高频通用字段，应通过 RFC 晋升到 core；对于可跨主题复用的领域模型，应提取为插件。

## Schema Diff 与迁移协议

安装器必须比较四份状态：当前实例 schema、目标主题声明、已安装主题资源账本、插件资源账本。diff 不能只展示 JSON 文本，应分类：

- **无数据风险**：新增 optional setting、增加 optional collection 字段、增加索引。
- **兼容但有行为变化**：默认值变化、权限规则收紧、optional 变 required 且可回填、插件最低版本提升。
- **潜在丢失**：字段重命名但无映射、类型收窄、relation target 变化、删除字段/collection。
- **禁止自动执行**：改核心字段语义、跨 owner 删除资源、任意 migration script、需要联网外传数据、无可靠 rollback 的 destructive migration。

迁移 plan 必须是声明式操作 DAG，而不是主题任意 shell/JS：`createCollection`、`addField`、`copyField`、`transformEnum`、`backfillDefault`、`createIndex`、`changeRule`、`archiveResource`。每步包含 precondition、影响记录数、可逆性、inverse、校验 query 和超时。复杂转换可使用受限 WASM/沙箱，但必须声明输入输出、资源限制和确定性；V1 更稳妥的选择是只支持平台内置 transforms。

迁移状态机：`planned -> backed_up -> staged -> validated -> committed`，失败进入 `failed` 并自动恢复到 `backed_up`；每步幂等且记录 checksum。Schema npm package 只负责让 Astro 构建获得类型契约；运行时仍须针对实例的 schema fingerprint 做握手，避免“编译时新、数据库旧”。

## 生命周期流程

### 安装

1. 下载不可变 artifact，验证签名、integrity、manifest schema、版本兼容和 publisher trust。
2. 解析 capabilities/dependencies，生成 schema diff、数据影响统计和 lock-in 指标：新增 collection 数、专属字段数、required 插件、不可逆步骤。
3. 只构建隔离 preview，不改变生产 schema；L2 主题用数据库快照/clone 执行 dry-run migration。
4. 用户确认权限与 migration plan 后创建可恢复 backup，再执行 staged migration；安装完成但不自动激活。

产品文案应直接显示：“此主题只改变外观”或“此主题将创建 2 个专属内容类型；停用后数据保留，其他主题默认不显示”。不要用笼统的“高级权限”。

### 激活

1. 重新检查 runtime/schema fingerprint 和依赖健康。
2. 运行 smoke tests：主页、文章页、404、核心 API、可选依赖降级、关键 assets。
3. 原子切换流量指针；保留上一主题版本、配置和部署 artifact。
4. 进入观察窗口；错误率/健康检查越界自动切回旧前端。激活不应执行 destructive schema migration，migration 必须在此前完成。

### 切换

- 先加载目标主题自己的 setting snapshot，不把 A 主题的配置按同名 key 注入 B。
- 生成 compatibility report：核心内容覆盖、目标主题可消费的插件数据、会暂时不可见的主题数据。
- 源主题 `onDeactivate` 默认 `retain-readonly`；禁止切换时删字段/collection。
- preview 使用生产内容的只读快照，支持对照关键 routes 和 visual screenshot；用户确认后原子切流。
- “不可见”必须与“被删除”明确区分，并提供“主题数据”管理入口。

### 卸载

拆成两个动作：

- **移除主题程序**：删除可执行 artifact/部署，保留 settings snapshot、资源账本和主题数据。默认动作。
- **清理主题数据**：单独危险操作，先导出 + 备份，再允许 archive 或 delete；展示记录数、引用关系、保留期限和不可逆说明。

若其他主题/插件引用资源，禁止删除并展示依赖链。不要像当前插件 down migration 注释所示那样，把“卸载”天然等同于删除 collection。

### 回滚

- **前端回滚**：原子切回上一主题 artifact + setting snapshot，不碰 schema，目标分钟级。
- **迁移回滚**：只对声明为 reversible 且验证 inverse 的 plan 自动执行。
- **数据恢复**：destructive 或跨版本不可逆变更从 backup 恢复到 clone，校验后再切换；不要直接覆盖生产库。
- 回滚点绑定 `{theme artifact, settings version, instance schema fingerprint, plugin versions, data backup id}`，而不是只记录主题版本。

## 避免隐式 Lock-in 的产品机制

- 主题详情页固定显示“数据影响”和“退出能力”，不藏在安装确认里。
- 每个专属字段/collection 在后台显示 owner、创建版本、记录数、最近使用主题、可导出格式。
- 提供 portability score，但不能只给模糊分数；同时列出事实：`0 core mutations / 2 namespaced collections / 1 required plugin / rollback supported`。
- 主题必须在没有专属数据时可渲染合理空状态；optional capability 缺失时不得白屏。
- 删除/重命名 manifest key 视为 breaking change。settings migration 与 content migration 分开版本化。
- 平台提供通用 JSON/NDJSON/CSV 导出和资源账本导出，即使主题作者消失，用户仍可取回数据。
- 主题作者不能声明“自己拥有”已有无 owner 资源；资源 adoption 必须由管理员显式映射。

## AI Agent 的安全角色

### AI 能做什么

- 读取 manifest、当前 schema、资源账本和记录统计，解释依赖与 lock-in 风险。
- 生成 machine-readable schema diff 的人类摘要，识别 rename 候选、字段映射候选和未使用资源。
- 基于平台允许的 migration primitives 草拟 migration plan 和 inverse plan。
- 在 clone/snapshot 上执行 dry-run，生成失败记录样本、数据覆盖率、约束冲突和预计耗时。
- 自动构建 preview、抓取关键 route、对比截图/DOM/HTTP 状态、检查 broken links 和空数据状态。
- 建议备份范围、恢复演练和 rollout/rollback 阈值；生成切换检查单。
- 辅助把明显跨主题的领域模型从主题数据重构为插件，但只输出建议或 PR，不直接改变生产所有权。

### AI 不能做什么

- 不能仅凭字段名可靠判断业务语义，例如 `price` 是展示文本还是交易金额。
- 不能保证任意自定义迁移可逆，也不能从成功 exit code 推断数据语义正确。
- 不能替用户决定可接受的数据丢失、合规保留、停机窗口或第三方信任。
- 不能持有/透传前端 admin token，不能绕过 capability gate，不能在 preview 中访问生产写权限。
- 不能自动批准 core schema mutation、跨 owner 删除、凭据迁移、外部数据上传和不可逆操作。
- 不能把 LLM 生成的自然语言当执行计划；执行输入必须通过 JSON Schema 校验、策略引擎、precondition 和用户批准。
- 不能保证视觉/业务完整性；截图和 smoke test 覆盖不到的路径仍需用户验收。

### Agent Guardrails

1. **Observe**：只读收集 manifest、fingerprint、统计；敏感字段只返回类型/计数，不返回值。
2. **Propose**：输出结构化 diff + plan + confidence + unresolved questions；所有映射有证据来源。
3. **Simulate**：只在隔离 clone 执行，网络默认关闭，固定资源/时间限制。
4. **Approve**：由确定性 policy engine 判定是否可自动；中高风险必须人工确认。
5. **Execute**：平台 migration runner 执行已签名 plan，AI 不直接获得数据库管理连接。
6. **Verify**：确定性校验优先，AI 只解释异常；不因 AI 判断“看起来正常”跳过 backup/rollback gate。

## 常见 CMS 模式对比

| 系统 | 常见模式 | 可移植性特点 | 对 VanBlog 的启示 |
|---|---|---|---|
| WordPress | Theme Mods/Customizer 与 options 保存外观；custom post type/fields 理论上应由插件提供，但主题常注册 CPT/依赖 ACF | 核心 posts 可移植，主题绑定 CPT、shortcode、page builder 时 lock-in 很高 | 坚持“功能进插件、展示进主题”，禁止主题无声明注册业务内容类型；不要复制其事实上的松散边界 |
| Typecho | 主题可定义自定义字段，值附着文章；主题作者常直接读取约定 key | 简单灵活，但字段无统一语义、owner、迁移和退出协议，换主题后数据仍在却不可见 | sidecar + namespace + manifest + compatibility report，正面解决“数据还在但用户不知道为何消失” |
| Ghost | 内容模型较固定；主题主要消费稳定 Content API，并在 `package.json` 声明少量 custom settings（官方限制类型与数量，强调视觉用途/fallback） | 主题切换通常安全，代价是领域扩展能力弱 | L0 默认采用 Ghost 式窄接口；设置限定为视觉/文案，功能集成和领域数据不要塞进 settings |
| Shopify | 主题 settings/sections/templates 与 store 业务数据分离；metafields/metaobjects 和 app-owned data 提供扩展；卸载 app 后数据/展示可能断开 | 商业核心稳定，扩展所有权较清晰，但 app block/metafield 仍可能形成依赖 | 采用 owner namespace、app/plugin capability、模板对缺失扩展降级；主题只引用，不拥有交易领域数据 |
| Headless CMS | 前端与内容模型天然分离；环境迁移、schema-as-code、API versioning 常见，但前端常对某一模型强耦合 | 换前端容易，换模型仍困难；schema diff 与 content migration 是主要成本 | Astro 主题应针对稳定 Core Content API；实例 schema registry 提升类型安全，但必须配套 runtime negotiation 和 migration governance |

推荐组合不是照搬单一产品：以 Ghost 的主题边界为默认，以 Shopify 的 owner/capability 模型承载高级扩展，以 headless CMS 的 schema diff/environment preview 做安全交付，并明确避免 WordPress/Typecho 的主题隐式拥有业务内容。

## Phases

### Phase 1: 固化产品边界与契约
- **Goal**: 定义四层数据所有权、主题能力等级和不可突破的核心规则。
- **Files**: 产品规格；未来的 `theme-manifest.schema.json`、核心 API/version 文档。
- **Steps**:
  - [ ] 将站点身份/核心配置、调色盘、主题 settings、插件配置在模型与 UI 术语上分开。
  - [ ] 定义 L0-L3 capability policy、稳定 Core Content API 和 sidecar 优先规则。
  - [ ] 定义 manifest 字段、命名空间、依赖/fallback、artifact 签名和 schema fingerprint。
  - [ ] 定义 portability facts/score 以及主题市场披露规范。
- **Done when**: manifest fixtures 可由 JSON Schema 验证；权限矩阵和用户术语经产品评审；契约包 build 通过且无 diagnostics errors。

### Phase 2: 建立 Diff、迁移与资源账本
- **Goal**: 所有主题持久化副作用都可枚举、预演、审计和恢复。
- **Files**: schema diff classifier、resource ownership ledger、migration plan schema/runner、backup catalog。
- **Steps**:
  - [ ] 建立 owner-aware 资源账本和当前实例 schema fingerprint。
  - [ ] 实现 diff 风险分类、记录影响统计、跨 owner/核心 mutation policy gate。
  - [ ] 实现声明式幂等 migration primitives、precondition/inverse/validation 和运行日志。
  - [ ] 实现数据库与媒体备份、恢复到 clone 的演练，并验证备份可读性。
- **Done when**: 新增、升级、失败中断、重复执行、逆向恢复测试通过；构建通过且无 diagnostics errors。

### Phase 3: 实现安全主题生命周期
- **Goal**: 安装、预览、激活、切换、卸载和回滚均遵循明确状态机。
- **Files**: theme installer、preview orchestrator、deployment switcher、admin theme/data management UI。
- **Steps**:
  - [ ] 安装前完成 artifact/依赖/capability/diff 检查，并在 clone 上 dry-run。
  - [ ] 构建只读 preview 与 route/asset/content smoke tests，激活使用原子流量切换。
  - [ ] 切换保留源主题数据与 settings snapshot，展示不可见数据 compatibility report。
  - [ ] 将“移除程序”和“清理数据”拆开，提供 export/archive/delete 与依赖阻断。
  - [ ] 绑定完整 rollback point，并演练自动前端回滚和人工数据恢复。
- **Done when**: 生命周期 E2E、故障注入、并发操作和恢复演练通过；项目 build 通过且无 diagnostics errors。

### Phase 4: 接入受限 AI 辅助与生态治理
- **Goal**: AI 提升理解和迁移效率，但不成为授权或生产执行主体。
- **Files**: agent read model、plan proposal schema、simulation reports、policy/audit integration、主题开发者工具。
- **Steps**:
  - [ ] 为 agent 提供脱敏只读 manifest/schema/stats API，并拒绝 admin credential 下发。
  - [ ] 让 AI 只生成可验证 plan proposal，执行前经过 deterministic validator/policy/user approval。
  - [ ] 自动生成 preview 检查和异常解释，保留证据、置信度与未解决问题。
  - [ ] 发布主题 lint/portability 工具和官方 L0/L1/L2 示例，推动领域数据进入插件。
- **Done when**: prompt injection、越权、跨 owner 删除、不可逆 plan 和敏感数据泄露测试 fail closed；build 与安全测试通过且无 diagnostics errors。

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| schema registry 被误当成授权 | 前端获得过多实例结构或 admin 能力 | registry 仅供可信 build service；前台使用裁剪后的只读 contract/capability token |
| sidecar 查询复杂度和性能 | 主题开发体验下降 | SDK 提供 typed extension join/batch loader；对通用字段建立晋升流程 |
| 主题作者滥用 L2 | 生态再次形成 lock-in | 市场默认突出 L0/L1；L2 强披露、审核、portability facts 和导出要求 |
| 卸载误删数据 | 不可恢复损失 | 默认 retain；程序与数据分离；强制备份、记录数确认、依赖阻断、恢复演练 |
| migration rollback 名义可用但实际失效 | 故障时扩大损失 | inverse dry-run + checksum + clone restore；破坏性变更只承诺 backup restore |
| 旧 artifact/依赖消失 | 无法回滚前端 | 已激活版本本地保留不可变 artifact、lockfile 和 integrity；回滚点固定依赖版本 |
| AI 自信地误配字段 | 语义损坏 | AI 只提案；低置信映射标红；确定性校验与人工批准是执行门禁 |
| preview 污染生产 | 隐式写入/外部副作用 | snapshot/clone、只读 token、网络默认关闭、webhook/email/payment stub |

## Rollback Strategy

该分析阶段不修改源码，无需代码回滚。未来实现必须把回滚设计为产品能力而非部署脚本：始终保留上一主题 artifact/settings；任何 L2 migration 前创建并验证 backup；前端切换与 schema commit 分离；不可逆 migration 通过 restore-to-clone、验证、再原子切换完成恢复。卸载默认不执行 down migration，主题数据删除只能作为独立、明确、可审计的操作。

## Assumptions

- PocketBase 仍是实例内容与 schema 的事实来源。
- admin-only npm registry 分发的是实例或平台 schema 契约，不向匿名前端提供管理员凭据。
- 独立 Astro 主题由可信服务构建/部署，浏览器运行时只拿到最小只读权限。
- V1 可以只开放 L0/L1；L2 应在资源账本、diff、backup/restore 和 lifecycle state machine 完成后再开放。
- IDE diagnostics 当前不可用；本次仅分析且未执行 build，因为没有源码修改。
