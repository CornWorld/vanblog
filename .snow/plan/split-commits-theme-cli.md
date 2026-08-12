# 拆分提交:Theme CLI 安装 + 持久化(内置/用户双目录合并)

## Context

工作区已实现「Theme CLI 安装 + 持久化」完整功能(复刻 Pack 模式),17 个改动文件 + 4 个未跟踪新文件全部混在一个工作区。用户要求:**先 review,再把改动按逻辑拆分成独立提交**。

代码内容已完成并通过验证(见下),本次任务是**只做提交拆分,不改业务代码**(除 review 发现的一个可选测试覆盖率回退修复)。

## Review 结论

### 改动全貌(已通读完整 diff)

| 层面 | 文件 | 改动 |
| ---- | ---- | ---- |
| 镜像/编排 | `Dockerfile` | 删除 `/build/themes → /var/lib/vanblog/themes` symlink;内置 themes 留 `/build/themes`(只读) |
| | `docker-compose.yml` | 加 `themes_data` 卷 + `VANBLOG_THEMES_DIR` env |
| | `vanblog.sh` | write_compose 加 themes bind 卷 + env + `pack theme` usage |
| | `docker/entrypoint.prod.sh` | export `VANBLOG_THEMES_BUILTIN_DIR=/build/themes` |
| | `docker/entrypoint.dev.sh` | dev 同款注入双目录 env |
| 脚本 | `scripts/lib/common.sh` | dev 容器挂同款数据卷(pb/caddy/themes/pack `vanblog_dev_*`);clean 时一并清卷 |
| | `scripts/test-theme-switch.mjs` | 注释:base 即测试第二主题 |
| Go 消费方 | `vault/internal/caddy/{bootstrap,config_builder,static_routes}.go` | BuildOpts.BuiltinThemesDir;buildStaticRoutes 扫描内置+用户,用户优先,排序确定 |
| | `vault/internal/theme/routes.go` | `roots()`+`ResolveDir()` 合并视图;serveThemes 读合并 |
| | `vault/internal/palette/routes.go` | readRecommendedPalette 经 `theme.ResolveDir` |
| JS 消费方 | `app/src/theme-host/core.mjs` | resolveThemeDir/listAvailableThemes/loadTheme 合并(用户优先) |
| 新 CLI | `vault/internal/packcli/theme.go`(+test) | `pack theme list/install/remove`,原子 staged copy、zip 防穿越、remove 防删内置/活动 |
| | `vault/internal/packcli/command.go` | 注册 theme 子命令组 |
| 文档 | `docs/theme-host-design.md`、`docs/theme-implementer-guide.md` | §8.1 安装方式表、§9 状态对齐、§10.4 CLI 安装章节 |
| 计划 | `.snow/plan/theme-cli-install-and-persistence.md`、`.snow/plan/fix-docs-status-and-evaluate-feats.md` | 已完成的两份执行计划 |

### 质量判断

- **规则统一**:4 处消费方(theme host / Caddy / theme API / palette)全部「内置+用户,用户优先,只认 entry.mjs」,逻辑一致(JS 用 first-wins、Go 用 last-wins,方向相反但结果等价,无 bug)。
- **安全**:install 原子 staged copy + rename;zip 穿越防护 + 拒绝 symlink;remove 防删内置/活动主题(经 PB HTTP 读 activeTheme)。
- **门禁**:`go build ./...`、`go vet` 受影响包、4 个包单测、`node --check core.mjs`、`bash -n`(vanblog.sh/common.sh/两个 entrypoint)全部通过。
- 计划文档记录 **真实容器 E2E 20/20 通过**(含重启持久、watcher resync Caddy、用户覆盖内置)。

### Findings(无阻塞级 bug,记录为主)

1. **【值得注意】`static_routes_test.go` 覆盖率回退**:从 5 个测试缩减为 1 个(`MergeUserWins`)。被删的 `TestBuildStaticRoutes_Full`(admin 3 路由 + _astro 顺序 + rewrite strip)、`MissingDirs`、`AdminOnly`、`ManagementServerIncludesStaticRoutes`、`StaticRouteJSON` 对应的行为**并未消失**,只是不再被覆盖。建议在本轮拆分中补一个「合并感知的 Full 测试」(admin + 双主题 + _astro 在 broad 前),或至少保留 MissingDirs/AdminOnly。
2. **轻微**:`removeTheme` 触发对 `127.0.0.1:8090` 的 HTTP 探测(3s 超时),单测变慢但无害(测试环境 PB 不可达→ok=false 直接 proceed)。
3. **轻微**:`theme.ResolveDir` 只认 `theme.json` 不认 `entry.mjs`,与 `serveThemes` 判定不一致——对 recommendedPalette 是 best-effort,实际无害。
4. **轻微**:`serveThemes` 结果顺序来自 map 遍历,非确定性;`packcli listThemes` 则已排序。API 无序无碍,仅一致性小瑕疵。
5. **行为变化(有意)**:旧 `serveThemes` 读目录失败返回 500,新逻辑改为跳过不可读 root 返回空列表 200(与 `listThemes`、`buildStaticRoutes` 一致,更优雅)。

## Phases(提交拆分,每提交独立可构建)

> 提交信息采用仓库既有 conventional-commit + 中文描述风格。每提交后用 `git status` 核对暂存区为空、用门禁验证该提交可独立构建。

### Phase 1: 基础设施提交(镜像/编排/脚本)
- **提交**: `feat(infra): make themes a persistent user volume, keep builtins read-only at /build/themes`
- **文件**: `Dockerfile`、`docker-compose.yml`、`docker/entrypoint.dev.sh`、`docker/entrypoint.prod.sh`、`vanblog.sh`、`scripts/lib/common.sh`
- **步骤**:
  - [ ] `git add` 上述 6 个文件 → commit
- **Done when**: `bash -n` 全过;diff 已移除;compose/entrypoint/脚本三处 themes 卷与 env 齐全

### Phase 2: Go 运行时消费方提交
- **提交**: `feat(vault): merge builtin+user themes in caddy static routes and theme/palette APIs`
- **文件**: `vault/internal/caddy/bootstrap.go`、`vault/internal/caddy/config_builder.go`、`vault/internal/caddy/static_routes.go`、`vault/internal/caddy/static_routes_test.go`、`vault/internal/theme/routes.go`、`vault/internal/palette/routes.go`
- **步骤**:
  - [ ] `git add` 上述 6 个文件 → commit
- **Done when**: `cd vault && go build ./... && go test ./internal/caddy/ ./internal/palette/ ./internal/theme/` 通过

### Phase 3: JS theme host 提交
- **提交**: `feat(theme-host): merge builtin+user theme roots in the JS theme host`
- **文件**: `app/src/theme-host/core.mjs`
- **步骤**:
  - [ ] `git add app/src/theme-host/core.mjs` → commit
- **Done when**: `node --check app/src/theme-host/core.mjs` 通过

### Phase 4: pack CLI theme 子命令提交
- **提交**: `feat(packcli): add theme list/install/remove subcommand (prebuilt dir/zip, atomic)`
- **文件**: `vault/internal/packcli/command.go`、`vault/internal/packcli/theme.go`、`vault/internal/packcli/theme_test.go`
- **步骤**:
  - [ ] `git add` 上述 3 个文件 → commit
- **Done when**: `cd vault && go build ./... && go test ./internal/packcli/` 通过

### Phase 5: 文档提交
- **提交**: `docs(theme): sync §8/§9 status and add CLI install guide (base is the 2nd test theme)`
- **文件**: `docs/theme-host-design.md`、`docs/theme-implementer-guide.md`、`scripts/test-theme-switch.mjs`
- **步骤**:
  - [ ] `git add` 上述 3 个文件 → commit
- **Done when**: markdown 结构无破损;`git diff --stat` 对应文件无残留

### Phase 6: 计划文档提交
- **提交**: `docs(plan): record theme CLI install/persistence + docs-status plans`
- **文件**: `.snow/plan/theme-cli-install-and-persistence.md`、`.snow/plan/fix-docs-status-and-evaluate-feats.md`、`.snow/plan/split-commits-theme-cli.md`
- **步骤**:
  - [ ] `git add` 上述 3 个文件 → commit
- **Done when**: `.snow/plan/` 全部入版本库(与既有 `docs(plan)` 历史一致)

### Phase 7(可选,由用户决定): 恢复 static_routes 测试覆盖率
- 若用户要求,补回合并感知的 Full 测试(admin 路由 + _astro 顺序 + rewrite strip + mgmt server),作为独立 commit 追加
- **Done when**: `go test ./internal/caddy/` 覆盖回到 5 个测试以上

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
| ---- | ---- | ---- |
| 中间提交不可独立构建 | 高 | 每个提交后跑对应门禁(go build/test、node --check、bash -n) |
| `git add` 误带文件/漏文件 | 中 | 每提交用 `git status` + `git diff --cached --stat` 核对 |
| 提交顺序破坏依赖 | 低 | 严格 A(infra)→B(Go)→C(JS)→D(CLI)→E(docs)→F(plan) 顺序 |

## Rollback Strategy

- 全部为已有改动的提交化,无数据面操作;任一提交出问题用 `git reset --soft HEAD~1` 或 `git commit --amend` 修复,不涉及代码回滚。
- 若需整体放弃:分支 `main-go` 无未推送提交,`git reset --hard origin/main-go` 可回到干净的已推送状态(改动仍在工作区,不丢失)。

## Completion Summary(执行后填写)

**Status**: 待执行
