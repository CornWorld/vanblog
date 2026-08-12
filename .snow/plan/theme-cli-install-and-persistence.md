# Theme CLI 安装 + 持久化(复刻 Pack 模式)

## Context

用户需求演进链:

1. 最初评估 theme.zip 上传被「`/var/lib/vanblog/themes` 非持久卷」阻塞。
2. 追溯后确认:该 symlink 是 commit `cafa300a` 的 **P0 bugfix**(运行时找不到 dist→500),**不是故意非持久**;`docker-compose.yml` 从未给 themes 加 volume(只有 pack_data)。
3. 用户决策:**不做 admin UI 上传**,先做**外部 CLI 安装**,且要**持久**(加 themes 卷)。
4. 用户指出:**pack 已有成熟的 CLI 模式**,themes 应复刻,而非另起炉灶。

**Pack 模式(要镜像的模板)**:

```
vanblog.sh pack <sub> → dc exec vanblog vanblog pack --packsDir=/var/lib/vanblog/packs "$@"
  ├─ vault/main.go: os.Args[1]=="pack" → packcli.Main(os.Args[2:])  (PB 初始化前早分派)
  ├─ vault/internal/packcli/: cobra CLI(list/status/plan/inspect/add/validate)
  ├─ 内置 /packs(只读) + 本地卷 /var/lib/vanblog/packs → Go 合并(locals 覆盖 builtins)
  └─ write_compose 挂 ${VANBLOG_DATA_PATH}/packs:/var/lib/vanblog/packs + VANBLOG_PACKS_DIR
```

## Analysis

### 现状(已核实)

- **theme host**(`app/src/theme-host/core.mjs`):单目录 `VANBLOG_THEMES_DIR`(默认 `/var/lib/vanblog/themes`),listAvailableThemes/loadTheme 只读一个目录。
- **Go Caddy**(`vault/internal/caddy/`):static_routes + themeWatcher 读 `VANBLOG_THEMES_DIR`(entrypoint.prod.sh L32 export)。themeWatcher 只 watch 这一个目录。
- **Go theme/palette**(`vault/internal/theme/routes.go`、`vault/internal/palette/routes.go`):读 `themes/<active>/theme.json`(recommendedPalette),路径基于 `VANBLOG_THEMES_DIR`。
- **关键验证**:theme 的 dist **自包含、可搬迁**(server entry.mjs 无 `@vanblog` 裸导入,`node_modules` 字样仅为打包元数据)→ drop-in 即可运行,`scripts/test-theme-switch.mjs` 已按 vanblog+base 双主题验证。

### 目标架构(镜像 Pack)

- **内置 themes**:`/build/themes`(镜像内,只读,构建时产生)→ 新 env `VANBLOG_THEMES_BUILTIN_DIR`。
- **用户 themes**:`/var/lib/vanblog/themes`(**挂载卷**,持久)→ `VANBLOG_THEMES_DIR`。
- **合并规则**:scan 两目录取并集,同名时**用户优先**;仅统计含 `dist/server/entry.mjs` 的 theme。
- **CLI**:`vanblog.sh pack theme <sub>` → 现有 `pack_cli "$@"` 透传 → `dc exec vanblog vanblog pack --packsDir=... theme --themesDir=/var/lib/vanblog/themes "$@"` → packcli 内新增 theme 子命令组。

### 受影响文件

| 文件                                                     | 改动                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                                             | 删除 `ln -s /build/themes /var/lib/vanblog/themes`;保留 `/build/themes`(内置);确保 `/var/lib/vanblog/themes` 挂载点存在 |
| `docker-compose.yml`                                     | 加 `themes_data:/var/lib/vanblog/themes` volume                                                                         |
| `vanblog.sh`                                             | write_compose 加 themes 卷 + `VANBLOG_THEMES_DIR` env;加 `theme` 透传子命令 + 菜单项 + usage                            |
| `docker/entrypoint.prod.sh`                              | export `VANBLOG_THEMES_BUILTIN_DIR=/build/themes`(默认)                                                                 |
| `docker/entrypoint.dev.sh`                               | dev 环境同样注入双目录 env                                                                                              |
| `vault/main.go`                                          | **不改**(`pack` 早分派已存在,theme 作为 pack 子命令)                                                                    |
| `vault/internal/packcli/command.go`                      | 新增 `theme` 子命令组(list/install/remove),复用 cobra + pack.Add 原子拷贝                                               |
| `vault/internal/caddy/caddy.go`                          | BuildOpts 加 BuiltinThemesDir;themeWatcher 只 watch 用户目录                                                            |
| `vault/internal/caddy/static_routes.go`(+config_builder) | 扫描内置+用户两目录生成 file_server 路由                                                                                |
| `vault/internal/caddy/themes_watch.go`                   | watch 用户卷(内置只读无需 watch)                                                                                        |
| `vault/internal/theme/routes.go`                         | theme meta 从合并视图读取                                                                                               |
| `vault/internal/palette/routes.go`                       | recommendedPalette 从合并视图读取                                                                                       |
| `app/src/theme-host/core.mjs`                            | 加 builtinThemesDir;listAvailableThemes/loadTheme 合并(用户优先)                                                        |
| docs                                                     | theme-host-design §8.1/§9、theme-implementer-guide、执行计划完成标志                                                    |

### 关键设计决策

- **合并消费方共 4 处**(theme host/Go caddy/Go theme/Go palette),无法跨语言共享代码 → 统一规则文档化:**scan 两目录 → 并集 → 用户优先 → 只认 entry.mjs**。
- **install 输入 = 预构建 dist**(目录或 zip,含 `theme.json` + `dist/server/entry.mjs` + `dist/client/`),**不做容器内 build**(prod 镜像无 pnpm/workspace 工具链;且 dist 自包含已验证)。
- **CLI 子命令**:`list` / `install <source>` / `remove <name>`(lean;pack 的 status/plan/inspect 是 pack 生命周期概念,theme 无 migration/schema,不硬套)。
- 升级兼容:老部署的 symlink 在挂卷时被 Docker mount 遮蔽,需 Dockerfile 删掉 symlink;内置 themes 始终在 `/build/themes`,无数据迁移。

### 风险

- 4 处合并消费方逻辑漂移 → 规则单一文档化 + 各自单测覆盖「用户优先」case。
- 老容器升级挂卷 → Dockerfile 移除 symlink 是前提;`dc down` 后 `up` 重建即生效。
- 误删 `theme` 早分派块(时序敏感,教训同 pack) → 参照 packcli 模式复制,带注释。

## Phases

### Phase 1: 持久卷 + 内置/用户双目录分离(底层基建)

- **Goal**: `/var/lib/vanblog/themes` 变为持久卷(用户 themes),内置 themes 固定在 `/build/themes`,全部消费方走合并视图
- **Files**: `Dockerfile`、`docker-compose.yml`、`vanblog.sh`、`docker/entrypoint.prod.sh`、`docker/entrypoint.dev.sh`、`vault/internal/caddy/*`、`vault/internal/theme/routes.go`、`vault/internal/palette/routes.go`、`app/src/theme-host/core.mjs`
- **Steps**:
  - [ ] Dockerfile prod stage:删除 `ln -s /build/themes /var/lib/vanblog/themes`;保留 `/build/themes` 内置目录;`mkdir -p /var/lib/vanblog`(挂载点)
  - [ ] `docker-compose.yml` + `vanblog.sh write_compose`:加 `themes_data:/var/lib/vanblog/themes` 卷;write_compose 加 `VANBLOG_THEMES_DIR=/var/lib/vanblog/themes` env
  - [ ] `entrypoint.prod.sh` + `entrypoint.dev.sh`:export `VANBLOG_THEMES_BUILTIN_DIR=${VANBLOG_THEMES_BUILTIN_DIR:-/build/themes}`(与 VANBLOG_THEMES_DIR 并列)
  - [ ] Go caddy:BuildOpts + static_routes 扫描内置+用户两目录(用户优先);themeWatcher 改为只 watch 用户卷
  - [ ] Go theme/palette routes:从合并视图读 theme.json / recommendedPalette
  - [ ] theme host `core.mjs`:listAvailableThemes/loadTheme 合并两目录(用户优先)
- **Done when**: `go build ./...` + `go test ./vault/...` 通过;`node --check app/src/theme-host/core.mjs` 通过;合并逻辑单测覆盖「同名用户优先」;bash -n vanblog.sh 通过

### Phase 2: `theme` 子命令组并入现有 `vanblog pack` CLI(不新建 CLI)

- **Goal**: `vanblog.sh pack theme install/list/remove` 经现有透传 → 容器内 `vanblog pack theme ...`,写持久卷
- **Files**: `vault/internal/packcli/command.go`(扩展)、`vanblog.sh`(仅 usage/菜单)
- **Steps**:
  - [ ] 在 `packcli` 的 cobra root 下新增 `theme` 子命令组,flags `--themesDir`(默认读 `VANBLOG_THEMES_DIR` env 或 `/var/lib/vanblog/themes`)、`--builtinThemesDir`(默认 `/build/themes`)
    - `theme list`:合并视图列出(内置标注 `[builtin]`,用户标注 `[user]`)
    - `theme install <dir|zip>`:校验(theme.json + dist/server/entry.mjs + dist/client)→ **复用 pack.Add 的原子 staged copy** 到 `--themesDir/<name>/` → 提示生效方式
    - `theme remove <name>`:仅能删用户 theme;拒绝删内置 / 拒绝删当前 `site.activeTheme`(从 PB 读)
  - [ ] `vanblog.sh`:不新增透传函数(现有 `pack_cli "$@"` 已路由 `vanblog.sh pack theme ...`);仅 usage 加 `pack theme list/install/remove`、菜单「Pack 管理」内可达
- **Done when**: `dc exec vanblog vanblog pack theme --themesDir=/var/lib/vanblog/themes list` 列出 base/vanblog;`pack theme install <预构建zip>` 后 theme host + Caddy 自动发现(themeWatcher resync);`pack theme remove` 正确拒绝内置/活动主题

### Phase 3: 验证 + 文档

- **Goal**: 全链路验证 + 文档同步
- **Files**: 测试 + `docs/theme-host-design.md`、`docs/theme-implementer-guide.md`、`docs/theme-host-execution-plan.md`
- **Steps**:
  - [ ] 单测:`themecli` install 校验/原子性/remove 防护;Go 合并解析(用户优先);theme host 合并
  - [ ] 构建门禁:`cd vault && go build ./... && go test ./...`;`node --check`;`bash -n vanblog.sh`;theme `astro check`
  - [ ] 文档:theme-host-design §8.1 安装方式标注「本地上传 → 已改为 CLI 安装」+ §9 状态更新;theme-implementer-guide 加 CLI 安装章节;执行计划完成标志补充
  - [ ] (若容器可用)`scripts/test-theme-switch.mjs` 冒烟:CLI 装主题 → 切换 → 静态资源 200
- **Done when**: 构建+单测全绿;文档无过期表述;CLI 安装闭环演示通过

## Risks & Mitigations

| 风险                                      | 影响 | 缓解                                                                  |
| ----------------------------------------- | ---- | --------------------------------------------------------------------- |
| 4 处合并消费方漂移                        | 中   | 统一规则文档化 + 每处「用户优先」单测                                 |
| 老容器升级挂卷后 themes 不可见            | 中   | Dockerfile 删 symlink + `dc down`/`up` 重建;文档注明升级步骤          |
| packcli 新增 theme 组破坏现有 pack 子命令 | 中   | cobra 子命令互不干扰;pack 侧单测全保留                                |
| install 输入含恶意 zip                    | 中   | 只解压 zip;校验 theme.json name 无路径穿越;目标限制在 themesDir       |
| remove 活动主题导致 404                   | 中   | CLI 从 PB 读 activeTheme 拒绝删除;theme host 已有「不可用则回退」保护 |

## Rollback Strategy

- 代码回滚:`git revert` 对应提交。卷/内置分离失败 → 恢复「挂卷 + 无 symlink」;任何 symlink 版本都是历史债务,不回退到它。
- 数据面:用户主题在卷上,删除/回滚不影响;内置 themes 在镜像,重建即恢复。
- 兼容:老部署没有 themes_data 卷时,`VANBLOG_THEMES_BUILTIN_DIR=/build/themes` 仍让内置 themes 可用,`VANBLOG_THEMES_DIR` 为空卷只影响用户安装。

## Completion Summary

**Status**: Completed
**Phases**: 3 / 3

### Results

- **Phase 1(持久卷 + 双目录分离)**:prod **和 dev 都无 symlink**(dev 是 prod 平替);compose/vanblog.sh 加 `themes_data:/var/lib/vanblog/themes` 卷 + `VANBLOG_THEMES_DIR` env;entrypoint 注入 `VANBLOG_THEMES_BUILTIN_DIR`;dev 脚本(`common.sh start_dev_container`)也挂同款数据卷(pb/caddy/themes/pack,`vanblog_dev_*`);4 处消费方合并(theme host `core.mjs` / Caddy `buildStaticRoutes` / theme `serveThemes` / palette `readRecommendedPalette`),规则统一「内置+用户,用户优先」。
- **Phase 2(theme 并入 pack CLI)**:`vault/internal/packcli/theme.go` 新增 `theme` 子命令组(list/install/remove),复用 cobra + 原子 staged copy(支持 dir + zip + 包装文件夹);`vanblog.sh` usage 加 `pack theme ...`;不新建 CLI、不改 main.go。
- **Phase 3(验证 + 文档)**:packcli 单测(合并/校验/原子/删除防护)+ Caddy 合并单测(`static_routes_test.go`);go build/vet/全测试 + theme host lifecycle 23/23 + bash -n 全绿;theme-host-design §8.1/§9 + theme-implementer-guide §10 同步。

### Verification

- [x] `go build ./...` + `go test ./...`(16 包)通过
- [x] `go vet` 受影响包通过
- [x] `node --check core.mjs` + `node app/test/lifecycle.test.mjs` 23/23
- [x] `bash -n vanblog.sh entrypoint.*` 通过
- [x] theme CLI 功能实测:list(内置/用户)、install(dir+zip)、remove(拒绝内置)全过
- [x] **真实容器 E2E 20/20 通过**(`vanblog:theme-cli-e2e` 镜像 + compose themes_data 卷):容器启动/health、list 合并视图、用户覆盖内置、新主题安装、themeWatcher resync Caddy(静态路由出现)、`/api/themes` 合并视图、重启后持久、remove 用户主题、remove 内置被拒
- [x] 文档无 markdown 破损

### E2E 发现的 bug(已修复)

**`pack theme install` 复制整个 theme 项目目录**(含 pnpm workspace 的 `node_modules` 符号链接)→ 被 copyTree 的 symlink 拒绝,所有安装失败。修复:`stageRuntimeFiles` 只复制运行时必需的 `theme.json` + `dist/`(build 期 src/node_modules/astro.config 无用且带 symlink;public/ 已并入 dist/client)。这暴露了「假主题」单测覆盖不到的差距——真实容器测试的必要性得到验证。

### 决策记录(交付给用户)

- theme ≠ pack(独立 SSR app vs 叠加资源包),但 **CLI 面复用 pack**(不新建 `vanblog theme`);未来可泛化为 `van` CLI(发音近「玩」)。
- **安装输入 = 预构建 dist**,不做容器内 build(dist 自包含已验证)。
- **persistence 修复**:非持久 symlink 确认是实现债务(`cafa300a` P0 bugfix),现改为用户卷。
- 4 项剩余 feat 最终处置:theme 安装 → CLI 实现;palette prompt → 去语义化;marketplace → 远期;minimal → base 已满足。
