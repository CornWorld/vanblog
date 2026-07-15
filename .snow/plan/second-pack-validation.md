# 第二个 Pack：验证 Pack 抽象闭环

## Context

当前 Pack 基建（discovery → metadata → route → schema builder → Goja validation → staging promotion → runtime source）已实施完成，但工作还停留在 **uncommitted dirty state**（12 modified + 6 untracked）。你自己在批判性分析里最尖锐的结论：**当前投入是为未来投资，但只靠 bookmarks 这一个内置 Pack，根本无法证明抽象可复用。**

本轮目标是**用第二个真实 Pack 验证整套基建**，而不是继续加抽象层。如果第二个 Pack 能自然接入，说明这次改动真正成功；如果还需要大量特殊处理，说明抽象不够好，必须回头改而不是继续扩展。

选 **moments** 作为验证 Pack 的理由：

- 原 `pack-minimal-closed-loop.md` 计划就是用 moments 作为首闭环第二个 Pack。
- moments 的 legacy UI/fragment 机制已在 `pack-layout-continuation-with-moments-removal.md` 中清理，但 `moments` collection/model/migration **仍保留**：`sdk/src/models/moments.ts`、PocketBase migration、`vault/pb_hooks/moments.pb.js` 的 author 自动填充 hook 都在。
- moments 的数据形状简单（content + author + visible），业务价值清晰（类似朋友圈/短动态），适合作为"非 bookmarks 特例"的验证对象。
- 它能同时验证：Astro 页面 composition、PB hook staging（author 自动填充）、Zod model 验证、nav 注册，覆盖面足够。

## 现状关键事实

- 当前 dirty files 与你分析中描述的 "Pack v1 基建" 完全对应（见 `git status`）。
- `packs/bookmarks/` 只有 4 个文件：`pack.json`、`pack.ts`、`pages/index.astro`、`hooks/bookmarks.pb.js`。这是 Pack 的参考最小形态。
- `sdk/src/models/moments.ts` 已存在并导出 `MomentSchema`，但**不在 `sdk/src/models/index.ts` 的 `models` map 里**——因为 moments 没有走 embedded validator。这是 Pack-side schema 的天然切入点。
- Astro `BaseLayout.astro:65` 已经消费 `virtual:vanblog/packs` 作为 nav，**不需要改 layout 代码**。
- Pack hook ESLint glob 已在 `eslint.config.js:40` 覆盖 `packs/*/hooks/**/*.pb.js`。
- `scripts/pack-schema-build.mjs` 是 builder，接受 pack directory，用 Vite 编译 `schema.ts` → `schema.js`，staging + rename 已经具备。
- `vault/internal/packcli/command.go` 提供 `vanblog pack build <dir>` CLI 入口（走 builder + Goja validate + atomic promote）。
- Go `pack.Builtins(root)` 扫描 `packs/*/pack.json`，`pack.DiscoverLocal` / `pack.RuntimeLoadableV0` 配合 `validation.ResolveModelSource` 已能从 Pack FS 读 `schema.js`。
- `vault/pb_hooks/moments.pb.js` **当前仍保留 `onRecordBeforeCreateRequest(..., "moments")` 的 author 自动填充 hook**——但文件在 `vault/pb_hooks/`，不是 Pack hooks。要迁到 `packs/moments/hooks/moments.pb.js` 才能验证 Pack hook staging。

## Analysis

- **Affected files**（修改）:
  - `packs/moments/pack.json`（新建）— Pack identity，`{"name":"moments","version":"1.0.0"}`。
  - `packs/moments/pack.ts`（新建）— Astro metadata：`title: '动态'`, `nav: { label: '动态', href: '/p/moments' }`。
  - `packs/moments/pages/index.astro`（新建）— 列表页，模仿 bookmarks `index.astro` 结构：查询 `moments` collection，按 `-created` 排序，只显示 `visible !== false`。
  - `packs/moments/hooks/moments.pb.js`（新建）— 从 `vault/pb_hooks/moments.pb.js` 迁移 author 自动填充 hook。
  - `packs/moments/schema.ts`（新建）— 导出 `models.moments = MomentSchema` 形态（CJS target，给 Vite builder 使用）。
  - `vault/pb_hooks/moments.pb.js`（删除或清空）— author hook 迁出后此处无遗留业务逻辑。
- **新建 Pack artifact（由 builder 生成，不手写）**:
  - `packs/moments/schema.js` — 由 `node scripts/pack-schema-build.mjs packs/moments` 产生，走 Goja 验证后 staging rename。
- **不动的东西**（刻意保留）:
  - `sdk/src/models/moments.ts` 已存在，schema.ts 引用它。
  - `sdk/src/models/index.ts` 的 `models` map 不动，因为 moments 仍不走 embedded validator。
  - `vault/pb_migrations/*_moments_collection.go` 不动，数据迁移与 Pack lifecycle 解耦。
  - `BaseLayout.astro`、`app/integrations/packs/index.mjs`、`resolver.mjs` 都不需要改，因为它们已经是通用机制。
- **Dependencies**: `@vanblog/sdk`（`MomentSchema`）、`vanblog:theme`（`Page`）、Astro Pack integration、PocketBase JSVM、Goja validation。
- **Complexity**: medium（4 个新文件 + 1 个 hook 迁移 + 1 次 builder 验证 + 回归）。
- **Risk areas**:
  - **Pack hook staging 与现有 `vault/pb_hooks/moments.pb.js` 重复注册**：如果 vault 端 hook 没清空，两处都注册 author 填充会导致冲突或重复写。**Mitigation**: 迁移后必须清空或删除 vault 端 hook。
  - **schema.ts 的 module 格式**：builder 用 Vite CJS，`schema.ts` 必须 `import { MomentSchema } from '@vanblog/sdk'` 后 `exports.models = { moments: MomentSchema }`（或等价 ESM `export const models = ...`，builder 编译为 CJS）。需要先跑一次 builder 才能确认格式正确。
  - **moments collection 在测试 PB 实例不存在**：如果 e2e 环境没有跑 moments migration，`/p/moments` 会拿不到数据——但不影响 route 本身，页面会渲染空态。这是可接受的。
  - **Go `pack.Builtins` 只扫描 `packs/` 一层**：新增 `packs/moments/` 会被自动发现，**无需改 Go 代码**——这是验证目标。如果失败则说明 discovery 实际上仍在硬编码 bookmarks。
  - **schema.ts import 路径**：`@vanblog/sdk` 在 Vite builder 中是否能正确 resolve。已有 `models.config.mjs` 走类似路径，但需要实测。

## Phases

### Phase 1: 提交当前 Pack v1 基建为独立 commit

- **Goal**: 把 uncommitted 的 Pack v1 基建收成一个清晰 commit，与第二个 Pack 的验证改动隔离，便于事后 blame / rollback。
- **Files**: 当前 `git status` 中的所有 modified/untracked，但**不包括本轮 Phase 2 新建的 packs/moments/**。
- **Steps**:
  - [ ] 跑 `git diff` 与 `git diff --cached` 审视所有改动是否纯粹属于 Pack v1 基建，没有混入其它无关变更（`vault/pb_hooks/lib/vanblog-query.js` 这个改动看起来可疑，需要先看 diff 确认是否相关）。
  - [ ] 跑一次现有测试基线：`pnpm --filter vanblog-app test:packs` + `cd vault && go test ./internal/pack ./internal/packcli ./internal/validation`，确保基线绿。
  - [ ] 若所有改动确实属于 Pack v1 基建，则单 commit 提交：建议消息 `feat(pack): v1 registry, schema builder, validate-then-promote`。
  - [ ] 若发现混杂无关改动（如 `vanblog-query.js`），拆分 commit 或先与用户确认。
- **Done when**: `git status` 干净（只剩本轮还没开始的 packs/moments）；基线测试通过；commit message 准确反映 Pack v1 基建范围。

### Phase 2: 创建 moments Pack 并端到端验证

- **Goal**: 用 moments 走通 Pack 完整闭环：discovery → metadata → nav → public route → PB hook staging → schema builder → runtime validation。
- **Files**: `packs/moments/pack.json`, `packs/moments/pack.ts`, `packs/moments/pages/index.astro`, `packs/moments/hooks/moments.pb.js`, `packs/moments/schema.ts`, `vault/pb_hooks/moments.pb.js`（删除/清空）。
- **Steps**:
  - [ ] 创建 `packs/moments/pack.json` 与 `packs/moments/pack.ts`，完全复用 bookmarks 的形态。
  - [ ] 创建 `packs/moments/pages/index.astro`，参考 `packs/bookmarks/pages/index.astro`：`Astro.locals.pb.collection('moments').getList(1, 50, { sort: '-created' })`，过滤 `visible !== false`，用 `MomentSchema.safeParse` 验证。
  - [ ] 迁移 `vault/pb_hooks/moments.pb.js` 的 author hook 到 `packs/moments/hooks/moments.pb.js`，清空 vault 端文件（或删除，但需要确认没有其它 PB 入口在加载它）。
  - [ ] 创建 `packs/moments/schema.ts`：`import { MomentSchema } from '@vanblog/sdk'; export const models = { moments: MomentSchema };`（最终语法以 builder 输出 CJS `exports.models` 为准）。
  - [ ] 运行 `node scripts/pack-schema-build.mjs packs/moments` 生成 `packs/moments/schema.js`，确认 builder 通过。
  - [ ] 运行 `cd vault && go run . pack build packs/moments`（或对应的 CLI 路径），确认 Goja validation + atomic promotion 走通。
- **Done when**:
  - `pnpm --filter vanblog-app build` 通过，`/p/moments` 路由已被 Astro integration 自动注入。
  - `pnpm --filter vanblog-app test:packs` 通过，resolver 能 discover 双 Pack（bookmarks + moments），排序、nav、route 正确。
  - `cd vault && go test ./internal/pack ./internal/packcli ./internal/validation` 通过。
  - 启动 dev server（如果可行）或至少 SSR build 产物中能看到 moments 页面被编译。
  - **关键验证点**：无任何"为 moments 特殊处理"的代码改动；resolver/integration/validation 全部通用。

### Phase 3: 回归与文档

- **Goal**: 冻结双 Pack baseline，更新文档与 plan。
- **Files**: `docs/future-pack-architecture.md`, `.snow/plan/second-pack-validation.md`（本文件）。
- **Steps**:
  - [ ] 完整回归：`pnpm test:models:types`, `pnpm test:models:fixtures`, `pnpm --filter vanblog-app build`, `pnpm --filter vanblog-app test:e2e:cache`, `cd vault && go test ./... && go build ./... && go vet ./...`。
  - [ ] `docker buildx build --check .` 通过。
  - [ ] `git diff --check` 通过。
  - [ ] 更新 `docs/future-pack-architecture.md`：标注 moments Pack 已作为第二个 Pack 通过完整闭环验证。
  - [ ] 在本 plan 写 Completion Summary，**明确回答你批判性分析中的核心问题**：抽象是否真的可复用？还是 moments 也需要特殊处理？
- **Done when**: 所有测试通过；文档与实现一致；plan 明确记录 moments 接入是否"零特殊处理"。

## Risks & Mitigations

| Risk                                                         | Impact                              | Mitigation                                                                                                                |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 commit 把无关改动一起卷进去                          | 历史污染，回滚困难                  | 显式 `git diff` 审视每个文件；不确定的改动（如 `vanblog-query.js`）单独询问用户                                           |
| moments schema.ts import `@vanblog/sdk` 在 Vite builder 失败 | builder 报错，无法生成 schema.js    | 先看 `models.config.mjs` 的同链路写法；必要时在 schema.ts 中用 inline zod 定义，不依赖 sdk import（但不优先）             |
| vault 端 moments hook 与 Pack hook 同时注册                  | author 被写两次或 JSVM 报 duplicate | 迁移完成后必须删除/清空 `vault/pb_hooks/moments.pb.js`，并在测试中启动 PB 确认只装载一份                                  |
| 第二个 Pack 暴露 discovery 实际上是 bookmarks-only 的硬编码  | 验证失败，本轮核心目标无法达成      | 这是验证本身要暴露的问题；如发生，停下来与用户讨论是改基建还是换 Pack，而不是继续硬推                                     |
| moments collection 在测试 PB 不存在                          | e2e 页面空态                        | 可接受；route 存在 + SSR 不崩即可。不建议为验证临时建数据                                                                 |
| Pack hook glob ESLint 未覆盖新 Pack                          | lint 不一致                         | 已覆盖 `packs/*/hooks/**/*.pb.js`，无额外动作；但 Phase 2 中跑一次 `pnpm exec eslint packs/moments/hooks/**/*.pb.js` 证明 |

## Rollback Strategy

按 Phase 独立提交/回滚：

- Phase 1 的 Pack v1 基建 commit：如发现回归，`git revert <sha>`，不影响 moments。
- Phase 2 的 moments Pack：删除 `packs/moments/`、恢复 `vault/pb_hooks/moments.pb.js` 即可完全回滚，不涉及数据丢失。
- 不执行 moments collection down migration，不删除任何 PB data。
- 任何 Git 级 rollback 命令需用户明确授权。

## Completion Summary

**Status**: Completed
**Phases**: 3 / 3

### Results

- **Phase 1**: Pack v1 基建（12 modified + 6 untracked files）已收成独立 commit `abdc2d21 feat(pack): v1 registry, schema builder, validate-then-promote`。`vault/pb_hooks/lib/vanblog-query.js` 的注释路径修复（vanblog-query 的 `require` 路径）属于基建清理，一并打包，无其它无关改动混入。
- **Phase 2**: moments Pack 端到端闭环通过——`packs/moments/{pack.json, pack.ts, pages/index.astro, hooks/moments.pb.js, schema.ts}` 全部新建，author hook 从 `vault/pb_hooks/moments.pb.js` 迁出（vault 端文件清空为占位注释）。
- **Phase 3**: schema builder 复用验证通过——**同一个 `scripts/pack-schema-build.mjs` + 同一个 `vanblog pack build` CLI 路径同时服务 bookmarks 与 moments，零改动**。

### 关键验证结论

回答你批判性分析的核心问题：**现有抽象是否真的可复用？**

**是，零 Pack-kernel 特殊处理。** 具体：

| 层                                                 | 是否需要为 moments 改动 | 说明                                                             |
| -------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| Go `pack.Builtins(root)` discovery                 | ❌ 不需要               | 扫描 `packs/*/pack.json` 自动发现 moments                        |
| `app/integrations/packs/resolver.mjs`              | ❌ 不需要               | 通用 discover/resolve/route 注入逻辑                             |
| `app/integrations/packs/index.mjs`                 | ❌ 不需要               | 同一个 Astro integration 注入 `/p/moments`                       |
| `BaseLayout.astro` nav 消费                        | ❌ 不需要               | `virtual:vanblog/packs` 自动含 moments nav                       |
| `scripts/pack-schema-build.mjs` builder            | ❌ 不需要               | 同一个 Vite CJS builder                                          |
| `vanblog pack build <dir>` CLI                     | ❌ 不需要               | Goja validate + atomic promote 路径通用                          |
| `validation.PackSource` / `ResolveModelSource`     | ❌ 不需要               | 从 Pack FS 读 `schema.js` 的机制通用                             |
| ESLint Pack hook glob (`packs/*/hooks/**/*.pb.js`) | ❌ 不需要               | 自动覆盖新 Pack hook                                             |
| Dockerfile                                         | ✅ 需要补               | Pack schema artifact 在生产 Docker 没有构建步骤（见 Deviations） |

**只有 Dockerfile 需要补**——这不是 moments 特例，而是"任何带 schema.ts 的 Pack 都需要生产构建步骤"的通用缺口。已补：astro-build stage 循环 `packs/*/` 跑 schema builder，prod 镜像从 `/build/packs/` 拷贝到 `/packs/`。

### Deviations

1. **schema.js 作为 generated artifact 不进 git**：参照 `vault/internal/validation/models.js` 的先例，把 `packs/*/schema.js` 加入 `.gitignore`。理由：150KB CJS bundle，可由 `scripts/pack-schema-build.mjs` 重建；提交会带来仓库膨胀和 merge 冲突。
2. **Dockerfile 修改（超出原计划）**：发现 Pack schema artifact 在生产 Docker 构建链路缺失。修复方式是通用的（循环 + 复制），不是 moments 特例。这本身是本次验证暴露的真实价值——没有第二个 Pack，这个生产缺口永远不会被发现。
3. **vault 端 moments hook 处理**：按计划迁出 author hook，vault 端文件保留为空注释占位而非删除，因为 `pb_hooks/` 仍是系统 hook 目录，保留文件有助于未来读者理解迁移历史。

### Verification

- [x] `pnpm --filter vanblog-app test:packs`（10 tests pass）
- [x] `cd vault && go test ./internal/pack ./internal/packcli ./internal/validation`
- [x] `cd vault && go test ./...`
- [x] `cd vault && go vet ./...` + `go build ./...`
- [x] `pnpm test:models:types` + `pnpm test:models:fixtures`
- [x] `pnpm --filter vanblog-app build`（确认 `/p/moments` 路由注入、SSR 编译、nav 含"动态"链接）
- [x] `pnpm --filter vanblog-app test:e2e:cache`
- [x] `docker buildx build --check .`
- [x] `git diff --check`
- [x] `node scripts/pack-schema-build.mjs packs/moments` + `cd vault && go run . pack build ../packs/moments`（builder + Goja validation + atomic promotion 全通过）
- [x] ESLint baseline 一致：`pnpm exec eslint packs/moments/hooks/moments.pb.js` 与 bookmarks 同样的 JSVM-globals `no-undef` 预存行为（非本轮回归）

### Follow-up（不属于本轮）

1. Pack hooks ESLint override 应配置 PocketBase JSVM globals（`onRecordCreateRequest` 等），消除 `no-undef` false positive（对 bookmarks 和 moments 同等适用）。
2. 验证多 Pack schema 合并策略：当前 `ResolveModelSource` 只读第一个有 schema.js 的 Pack，未来需要合并多 Pack schema。
3. Pack 生命周期缺口仍未闭合：disable/upgrade/uninstall/version 冲突都没有设计——你的批判意见依然有效，但本轮已经证明了"最小复用"成立。
