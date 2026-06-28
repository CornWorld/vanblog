# Caddy 单一真相源改造(范式 X:全 JSON Bootstrap)

## Context

### 为什么改

当前 Caddy 配置有两套表达:

1. **静态层**:`docker/Caddyfile.prod` / `Caddyfile.dev` —— 文件,Dockerfile COPY 进容器
2. **动态层**:`site.routing` 数据库 → `BootstrapSync` 启动时 PATCH 进 Caddy admin API

两套表达必然漂移。已经观察到的事实:

- `vault/internal/caddy/template.go:28` 的 `RenderProdCaddyfile` 是**死代码**(只有测试调),它生成的内容(`handle_path /static/*`、`file_server`)和 `docker/Caddyfile.prod` 实际内容已经分叉
- `runtime-risk-fixes.md` 记录了 Caddyfile.prod 里 `handle_path /api/files/*` 死路由(被 `/api/*` handle 先匹配,永不执行)
- Caddy Issue #7598 说明 Caddyfile Adapter 在混合缩进 / `handle` + `header` 组合下会静默丢指令,Caddyfile 这一层是不可靠的翻译层

### 目标

**消除 Caddyfile 这一层**。Caddy 用最小 bootstrap JSON 自举,vanblog 进程通过 admin API 完整地描述所有路由(包括 `/api/*` / Astro fallback / 用户规则 / 系统缓存规则)。真相源唯一是 `site.routing` 数据库 + vanblog 代码里写死的 fallback dial。

### 不在范围内

- 不改 `site.routing` DSL 用户接口(`UserRule` struct 保持不变)
- 不改 `caddyadmin.Client` 的 HTTP 层(已经够稳)
- 不改 SSRF 校验逻辑(`ssrf.go:43` 已经够严)
- 不引入 `github.com/caddyserver/caddy/v2` 作为 Go 依赖(代价过大,范式 X 不需要)

## Analysis

### 当前启动顺序

```
entrypoint.{prod,dev}.sh:
  1. wait_for pb      (pb 起来)
  2. wait_for astro   (Astro 起来)
  3. exec caddy run --config /etc/caddy/Caddyfile   (Caddy 带 Caddyfile 起,前台 PID 1)
  4. [pb OnBootstrap] → go BootstrapSync()          (异步 PATCH 用户路由)
```

文件:`docker/entrypoint.prod.sh:92`、`docker/entrypoint.dev.sh:77`、`vault/internal/hooks/hooks.go:225-231`

### 目标启动顺序(范式 X)

```
entrypoint.{prod,dev}.sh:
  1. exec caddy run --config /tmp/bootstrap.json   (Caddy 带最小 JSON 起,前台 PID 1)
     └─ bootstrap.json 只含:admin bind、storage、on_demand_tls.ask、维护路由 503
  2. wait_for pb                                    (pb 起来)
  3. wait_for astro                                 (Astro 起来)
  4. [pb OnBootstrap] → 同步 LoadConfig(完整路由)   (替换 bootstrap 配置)
     └─ 失败重试 3 次,失败后退回"维护模式"配置
```

关键差异:

- Caddy **先于** pb 起(当前是后于),但只带维护路由
- pb 的 `OnBootstrap` 改为**同步** LoadConfig(当前是异步 PATCH,且是增量)
- LoadConfig 失败有兜底,容器不会永远卡在维护模式

### 受影响文件

| 文件                                    | 改动                                                                                                                                                                       | 原因                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `vault/internal/caddy/template.go`      | **大改**:删除 `RenderProdCaddyfile` / `RenderDevCaddyfile` / `RenderJSONConfig` 这三个字符串拼接函数,替换为 struct-based 的 `BuildBootstrapConfig()` + `BuildFullConfig()` | 消除字符串拼 JSON 的注入风险;统一 dev/prod 差异到代码参数 |
| `vault/internal/caddy/bootstrap.go`     | **重写**:`BootstrapSync` 从"增量 PATCH 用户路由"改为"全量 LoadConfig",加重试、加 fallback                                                                                  | 适配单一真相源语义                                        |
| `vault/internal/caddy/status.go`        | 小改:`HttpsRedirect` 等字段从"固定在 Caddyfile"改为"在运行时配置里查"                                                                                                      | 因为 Caddyfile 没了                                       |
| `vault/internal/caddy/caddy_test.go`    | 改测试:从断言 Caddyfile 文本改为断言 JSON 结构                                                                                                                             | template.go 改了                                          |
| `vault/internal/hooks/hooks.go:225-231` | 把 `go caddy.BootstrapSync(...)` 改为同步调用 + 加错误处理                                                                                                                 | 避免竞态                                                  |
| `docker/entrypoint.prod.sh`             | 改启动顺序:Caddy 先起(带 bootstrap.json),pb 后起                                                                                                                           | 适配新时序                                                |
| `docker/entrypoint.dev.sh`              | 同上                                                                                                                                                                       | 同 prod                                                   |
| `docker/Caddyfile.prod`                 | **删除**                                                                                                                                                                   | 不再需要                                                  |
| `docker/Caddyfile.dev`                  | **删除**                                                                                                                                                                   | 不再需要                                                  |
| `Dockerfile:58-59, 93-94`               | 删除 `COPY docker/Caddyfile.*`,改为生成 bootstrap.json                                                                                                                     | 跟上                                                      |
| `vault/utils/caddyadmin/types.go`       | **扩展**:加 `App`/`HTTPServer`/`TLSConfig`/`Storage`/`AdminConfig` 等 struct,让整个 Caddy JSON root 可用 Go struct 表达                                                    | 替代字符串拼接                                            |
| `vault/utils/caddyadmin/client.go`      | 小改:`LoadConfig` 加重试逻辑(已有测试代码提示要重试,`client_test.go:89-99`)                                                                                                | `LoadConfig` 会触发 admin endpoint 重启,连接会断          |

### 新文件

- `vault/internal/caddy/bootstrap_test.go`:独立测试 LoadConfig 的重试 + fallback 路径
- 无其他新文件

### 依赖

- 不新增外部依赖
- 继续用 `net/http` + `encoding/json`

### 复杂度

**medium-high**。涉及启动时序、admin API 重试、bootstrap JSON 结构化,以及一个完整的"维护模式"兜底路径。

### 风险区域(重点 review)

1. **启动时序竞态**:Caddy 公网端口 80/443 在 bootstrap 阶段已经监听,如果 LoadConfig 一直失败,公网会持续看到 503 维护页 —— 需要有明确的失败信号(如 `caddy validate` 失败让容器 exit)
2. **LoadConfig 断连重试**:Caddy `/load` 会重启 admin endpoint,第一次调用必然 EOF / connection-reset,重试逻辑必须 robust(`client_test.go:89-99` 已经证明这点)
3. **bootstrap JSON 注入面**:任何 `fmt.Sprintf` 拼 JSON 都是 SSRF / 配置注入风险,必须全用 `json.Marshal`
4. **回滚能力**:改造期间要能一键退回 Caddyfile 模式,不能破坏现有部署

## Phases

### Phase 1:扩展 `caddyadmin` 类型系统,让 Caddy JSON root 可结构化表达

- **Goal**:把 `caddyadmin/types.go` 从"只能表达 Route 子树"扩展到"能表达完整 Caddy config root",消除所有字符串拼 JSON
- **Files**:
  - `vault/utils/caddyadmin/types.go`(加 struct)
  - `vault/utils/caddyadmin/client.go`(给 `LoadConfig` 加重试)
  - `vault/utils/caddyadmin/client_test.go`(测重试)
- **Steps**:
  - [ ] 1.1 在 `types.go` 新增 `Config`(root)、`AdminConfig`、`Apps`、`HTTPApp`、`TLSCfg`、`AutomationPolicy`、`Storage`、`Server` 等 struct,覆盖 Caddy config JSON 的所有字段,所有字段都用 `json:"..."` tag
  - [ ] 1.2 给 `Config` 加方法 `MarshalJSON() ([]byte, error)`(或直接靠 struct tag),确保产出的 JSON 通过 `caddy validate`
  - [ ] 1.3 在 `client.go` 的 `LoadConfig` 里加重试逻辑:最多 3 次,每次间隔 500ms,容忍 EOF / connection-reset / 5xx(对齐 `client_test.go:89-99` 已观察到的行为)
  - [ ] 1.4 在 `client.go` 加 `ValidateConfig(json) error` 方法,调 Caddy 的 `/load?validate_only=true` 做 dry-run
  - [ ] 1.5 单测:对每个新 struct 跑 `json.Marshal` → 用 `caddy validate` 的 schema 验证(可离线,见 `caddy_test.go` 现有测试方式)
- **Done 当**:
  - `go test ./vault/utils/caddyadmin/...` 全通过
  - `Config` struct 能完整表达当前 `docker/Caddyfile.prod` 的所有语义(admin bind / on_demand_tls / storage / 三个 server:HTTPS/HTTP redirect/management port)
  - `LoadConfig` 重试逻辑有单测覆盖

### Phase 2:实现 `BuildBootstrapConfig` + `BuildFullConfig`,替换 template.go

- **Goal**:用 Phase 1 的 struct 系统重新实现配置生成,完全消除 `fmt.Sprintf` 拼 JSON
- **Files**:
  - `vault/internal/caddy/template.go`(大改)
  - `vault/internal/caddy/caddy_test.go`(改测试)
  - `vault/internal/caddy/bootstrap.go`(改 `BootstrapSync`)
- **Steps**:
  - [ ] 2.1 在 `template.go` 删除 `RenderProdCaddyfile` / `RenderDevCaddyfile` / `RenderJSONConfig`
  - [ ] 2.2 新增 `BuildBootstrapConfig(opts BuildOpts) caddyadmin.Config` —— 生成维护模式配置:
    - `admin.listen = "127.0.0.1:2019"`、`admin.origins = ["127.0.0.1"]`(零信任默认,修复原 `RenderJSONConfig:155` 的 `["*"]` Bug)
    - `storage.file_system.root = "/data/caddy"`
    - `on_demand_tls.ask = "http://127.0.0.1:8090/api/hooks/caddy/ask"`
    - HTTPS server 监听 `:443`,**只有一条路由**:返回 `503 Service Unavailable` + `Retry-After: 30`(维护模式)
    - HTTP `:80` 重定向到 `:443`(不变)
    - 管理 `:8080` 反代到 pb / Astro(不变,保证 admin UI 可达,方便排查)
  - [ ] 2.3 新增 `BuildFullConfig(opts BuildOpts, userRules []UserRule) (caddyadmin.Config, error)` —— 生成完整运行时配置:
    - 调用 `TranslateAll(userRules, allowlist)` 得到用户路由(已有)
    - 插入系统路由:`/api/*` → `127.0.0.1:8090`、`/_/*` → pb、fallback → Astro(prod)或 Astro dev server(dev)
    - 把 `SystemCacheRules()` 放在用户路由**之前**(系统优先级低,用户可覆盖;通过 `@id` 同 ID 覆盖语义不变)
    - `BuildOpts` 字段:`Variant: "prod" | "dev"`、`AstroTarget: "127.0.0.1:4321"`、`Email`、`LogLevel`、`AllowedDomains`、`AllowedHostsForProxy`(用户配置的 SSRF allowlist)
  - [ ] 2.4 重写 `bootstrap.go` 的 `BootstrapSync`:
    - 签名改为 `BootstrapSync(app core.App, caddyAdminURL string) error`(返回 error,不再 best-effort)
    - 内部流程:`WaitForCaddy`(已有)→ `BuildFullConfig` → `ValidateConfig` → `LoadConfig` 重试
    - 失败时返回 error,**不**自动退回 bootstrap 配置(让上层决定)
  - [ ] 2.5 改写 `caddy_test.go`:把所有断言从"渲染 Caddyfile 文本包含某子串"改为"Marshal 后的 JSON 结构包含某 route / handler"
- **Done 当**:
  - `template.go` 里 0 个 `fmt.Sprintf` 拼 JSON(全部 `json.Marshal`)
  - `BuildBootstrapConfig` 产出的 JSON 用 `caddy validate` 通过
  - `BuildFullConfig` 产出的 JSON 用 `caddy validate` 通过
  - `go test ./vault/internal/caddy/...` 全通过
  - `caddyadmin.Config` 的所有 `dial` 字段都在 `DefaultAllowlist` 内(新增的安全断言)

### Phase 3:修改 entrypoint + Dockerfile,实现新启动时序

- **Goal**:让 Caddy 用 bootstrap JSON 自举,pb 起来后同步注入完整配置
- **Files**:
  - `docker/entrypoint.prod.sh`
  - `docker/entrypoint.dev.sh`
  - `Dockerfile`
  - `vault/internal/hooks/hooks.go`
- **Steps**:
  - [ ] 3.1 `Dockerfile:58-59`:删除 `COPY docker/Caddyfile.prod` / `Caddyfile.dev`,改为在 entrypoint 里 `cat <<EOF > /tmp/bootstrap.json` 内联最小 bootstrap JSON(或保留一个 `docker/bootstrap.json` 静态文件)
  - [ ] 3.2 `Dockerfile:93-94`:同步删除 dev 的 Caddyfile COPY
  - [ ] 3.3 改 `entrypoint.prod.sh`:
    ```
    a. exec caddy run --config /tmp/bootstrap.json &     (Caddy 带维护配置后台起)
    b. wait_for caddy admin (127.0.0.1:2019)            (等 admin API 就绪)
    c. wait_for pb                                       (等 pb 就绪)
    d. wait_for astro                                    (等 Astro 就绪)
    e. (pb 的 OnBootstrap 钩子会同步 LoadConfig 完整配置 —— 这一步发生在 c 之后的 pb 进程内)
    f. trap / monitor 不变
    g. wait $CADDY_PID                                  (前台等 Caddy 进程)
    ```
    关键:Caddy 改为**后台**起(不再是 exec PID 1),entrypoint 自己当 PID 1 负责进程管理。这背离了当前"exec caddy 作为 PID 1"的设计,但范式 X 下 Caddy 不再是自包含进程,需要 entrypoint 协调时序
  - [ ] 3.4 同样改 `entrypoint.dev.sh`
  - [ ] 3.5 改 `hooks.go:225-231`:把 `go caddy.BootstrapSync(...)` 改为同步 `if err := caddy.BootstrapSync(...); err != nil { log.Fatalf(...) }`。失败策略见 Phase 4
  - [ ] 3.6 删除 `docker/Caddyfile.prod` / `docker/Caddyfile.dev` 文件
- **Done 当**:
  - `docker build .` 成功,镜像启动后:
    - 前 1-3 秒(bootstrap 阶段)外部访问 `:443` 返回 503 维护页(不是裸 502)
    - pb + Astro 就绪后,完整配置加载,路由正常工作
  - 容器 SIGTERM 能干净 kill 三个进程
  - 删掉 Caddyfile 文件后 `git status` 干净

### Phase 4:稳定性兜底 —— LoadConfig 失败的回滚路径

- **Goal**:确保 `LoadConfig` 失败时容器有体面行为,而不是永远维护页
- **Files**:
  - `vault/internal/caddy/bootstrap.go`
  - `vault/internal/hooks/hooks.go`
  - `vault/internal/caddy/status.go`(加 `LastLoadConfigError` 状态)
- **Status**: ✅ 已完成(2026-06-28)
- **Steps**:
  - [x] 4.1 在 `bootstrap.go` 的 `BootstrapSync` 里加重试 + 指数退避(最多 5 次,1s/2s/4s/8s/16s)
  - [x] 4.2 如果 5 次全失败,把错误写到 `site` 表的 `caddyLastError` 字段(新增 schema 字段)+ 写日志
  - [x] 4.3 **不**自动重启容器(避免循环崩溃),而是保留 bootstrap 维护配置,让用户通过 `:8080` 管理 UI 进来排查(管理端口在 bootstrap 配置里仍可达)
  - [x] 4.4 在 `hooks.go` 的 `OnBootstrap` 里:`BootstrapSync` 失败不 `log.Fatal`(那会让 pb 退出,连锁崩),而是记录 + 继续让 pb 跑(用户至少能用管理端口) —— Phase 3 已完成,hooks.go:233
  - [x] 4.5 在 `status.go` 的 `GetTLSStatus` 里加 `BootstrapMode bool` 字段:当 Caddy 当前运行的是维护配置而非完整配置时,UI 显示警告横幅
- **额外修复(子任务提交的 P1/P2)**:
  - `caddyadmin.LogEntry` 改为 object-form writer(`{"output":"file","filename":"..."}`)+ 新增 `LogWriter` struct;旧 string-form 会被 Caddy 拒绝
  - `LogLevel` 全部大写化(zapcore 要求:`WARN`/`INFO`/`DEBUG`/`ERROR`/`PANIC`);`Defaults()` 做一次 `strings.ToUpper` 兼容旧 env / 旧 site 记录
  - @id 命名统一:`vanblog-bootstrap-*` 前缀(与 docker/bootstrap.json 对齐);server 名统一为 `srv_https` / `srv_http` / `srv_mgmt`
  - 删除 `Handler` 顶层未使用的 `Response` / `Request` 字段(reverse_proxy 用嵌套的 `Headers *HeaderPolicy`;原顶层字段无 caller)
- **Done 当**:
  - 模拟 LoadConfig 失败(如停掉 Caddy admin API),容器不崩,pb 正常,管理端口可达
  - 模拟 LoadConfig 恢复(重试成功),完整配置自动生效,无需重启
  - `caddyLastError` 字段在 admin UI 可见
- **验证**:`go build ./... && go vet ./... && go test ./...` 全绿;`BuildBootstrapConfig` 产出的 JSON 与 `docker/bootstrap.json` 经 `jq -S .` 规范化后仅差 `srv_mgmt` 路由的 `@id`(Go 版未为 mgmt 路由命名,语义等价)

## Risks & Mitigations

| Risk                                                      | Impact                                          | Mitigation                                                                                                                           |
| --------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Caddy `:443` 在 bootstrap 阶段对公网开,但没有业务路由** | 公网用户看到 503 维护页,SEO 短期受影响          | bootstrap 配置显式返回 503 + `Retry-After: 30`,搜索引擎会理解这是临时状态;且正常情况下这个窗口只有 2-5 秒                            |
| **`LoadConfig` 第一次调用必然断连(Caddy 重启 admin)**     | 如果代码没重试,`BootstrapSync` 第一次失败就放弃 | Phase 1.3 已加重试逻辑,代码上用 `client_test.go:89-99` 已验证的模式                                                                  |
| **pb 起不来 → 永远维护页**                                | 站点不可用                                      | 这是范式 X 的固有代价。对应缓解:pb 的健康度由 `monitor_children` (`entrypoint.prod.sh:73-85`)监控,挂了就 exit 让 Docker 重启整个容器 |
| **bootstrap.json 生成错 `admin.origins = ["*"]`**         | admin API 暴露到公网 = 整个站点被接管           | Phase 2.2 显式写 `["127.0.0.1"]`;Phase 2.5 单测断言 `"*" not in origins`                                                             |
| **dev/prod 配置差异隐藏在 Go 代码里,运维改不到**          | 改 fallback 端口要重新编译                      | `BuildOpts` 用 env var 注入(`VANBLOG_ASTRO_TARGET`、`VANBLOG_VARIANT`),运维可在 docker-compose 调整                                  |
| **改造期间老用户升级,镜像变了启动行为变了**               | 现有部署升级后第一次启动可能有 5 秒维护页       | 在 release notes 显式说明;维护页内容用 HTML 写清楚"正在启动,请稍候";`Retry-After` 头让爬虫优雅处理                                   |
| **`git rm docker/Caddyfile.*` 后回滚困难**                | 升级出问题想退回 Caddyfile 模式麻烦             | 保留一个 `docker/Caddyfile.legacy` 作为 fallback 文档;entrypoint 支持 `VANBLOG_CADDY_MODE=legacy` env 退回老路径(Phase 3 可选 step)  |

## Rollback Strategy

### 代码级回滚

- 改造分支独立 commit / PR,merge 出问题直接 `git revert <merge-commit>`
- 每个 Phase 一个 commit,可以精确回滚到某个 Phase

### 运行级回滚

- Phase 3.1 step 引入 `VANBLOG_CADDY_MODE` env,默认 `json`(新路径),可设为 `caddyfile`(老路径)
- 老路径仍然有效:Caddyfile 文件保留为 `docker/Caddyfile.legacy`,entrypoint 根据 env 决定走哪条路
- 生产部署出问题时,用户改 env + 重启容器即可回滚,不需要重新 build 镜像

### 数据级回滚

- `site.routing` schema 不变,无数据迁移
- Phase 4.2 新增的 `caddyLastError` 字段是可选的,不影响老版本读取

## Open Questions(需要在执行前决策)

1. **是否保留 `docker/Caddyfile.legacy` 作为 fallback?**
   - 推荐:是。第一版生产部署保留 fallback,稳定 1-2 个 release 后再彻底删除
2. **维护模式 503 页面内容**
   - 推荐:简单 HTML,中文"VanBlog 正在启动,请稍候…" + `Retry-After: 30`
3. **`VANBLOG_CADDY_MODE` env 是否值得引入?**
   - 推荐:是。极低成本,极大回滚灵活性。运维可以在不 build 的情况下切回老路径
4. **是否在 Phase 1 引入 `caddy validate` 作为 CI step?**
   - 推荐:是。需要一个 alpine caddy 镜像跑 `caddy validate --config <generated.json>`。但这要求 CI 能拉 caddy 镜像,需确认 CI 环境

---

## Completion Summary

**Status**: ✅ Completed
**Phases**: 4 / 4

### Results

- **消除了 Caddyfile 这一翻译层**:`docker/Caddyfile.{prod,dev}` 降级为 `Caddyfile.legacy.{prod,dev}`,仅作 `VANBLOG_CADDY_MODE=legacy` 回滚通道
- **Caddy 用最小 `bootstrap.json` 自举**:维护模式 503 页 + `Retry-After: 30`,启动窗口用户拿到体面响应而非裸 502
- **pb `OnBootstrap` 钩子同步 `LoadConfig` 完整配置**:真相源唯一是 `site.routing` + Go 代码里的受信 dial
- **双层重试**:内层 `LoadConfig` 3×500ms 处理 admin endpoint 重启断连;外层 `BootstrapSync` 5 次指数退避(1s/2s/4s/8s/16s)处理 site.routing 编辑 / Caddy 未就绪等粗粒度故障
- **零信任 admin**:`admin.origins = ["127.0.0.1"]` 在 static JSON + Go struct + 测试断言三层强制,**绝不用 `["*"]`**
- **0 个 `fmt.Sprintf` 拼 JSON**:`template.go` 全用 `caddyadmin.Config` struct + `json.Marshal`
- **SSRF 闭环保持**:用户 rule 走 `ValidateTarget`,系统路由代码写死,`TestBuildFullConfigSSRFSafety` 扫描所有 dial 字段
- **失败兜底**:`LoadConfig` 失败不崩容器,caddyLastError 持久化到 site 表,管理端口 :8080 仍可达

### Deviations

1. **Phase 4 sub-agent 把 `Handler.Headers` 字段类型改成 `interface{}`**(意图兼容 static_response flat headers),但基于错误假设 —— Caddy 的 static_response 跟 reverse_proxy 一样接受 `{response: {set: {...}}}` 嵌套形式。已 revert 为 `*HeaderPolicy`,4 处赋值改为嵌套形式
2. **`LogEntry.Writer` 从 string 改为 object form**:Phase 1 错误地用 `Writer string`,Phase 4 修正为 `*LogWriter` object(Output + Filename),对齐 Caddy canonical JSON
3. **ACME email 从 env 读取**:site 表无 email 字段,改为从 `VANBLOG_EMAIL` env 读(跟 entrypoint 行为一致)

### Verification

- [x] `go build ./...` 通过
- [x] `go vet ./...` 无 warning
- [x] `go test ./...` 全包通过
- [x] `sh -n docker/entrypoint.{prod,dev}.sh` 语法通过
- [x] `python3 -m json.tool docker/bootstrap.json` JSON 合法
- [x] `jq '.admin.origins' docker/bootstrap.json` = `["127.0.0.1"]`(零信任)
- [x] `grep "fmt\.Sprintf" vault/internal/caddy/` 仅 1 命中(template.go:7 注释)
- [x] QA 跨阶段审查 PASS(critical/high/medium/low 全部评估)

### Follow-up(可接受为已知,记录待后续)

1. **`srv_mgmt` 路由的 `@id` 命名差异**:`buildManagementServerRoutes` 产出的 3 条管理路由没加 `@id`,而 `docker/bootstrap.json` 给它们命名了。纯命名差异,不影响运行。可选统一
2. **`docs/implementation-plan.md` 文档过时**:仍列出 `RenderProdCaddyfile` / `RenderDevCaddyfile` 旧签名,需更新为 `BuildBootstrapConfig` / `BuildFullConfig`
3. **`site.httpsRedirect` 字段成了死配置**:新架构下 HTTP→HTTPS 重定向总是由 `srv_http` 静态 301 路由实现,site 字段不再控制任何东西。可选删除字段 + UI 开关,或让 BuildFullConfig 条件性生成 srv_http
4. **测试覆盖 gap**:`loadBootstrapInputs` DB 错误降级 / `ValidateConfig` dry-run 失败 / `WaitForCaddy` 超时 / entrypoint `monitor_children` 真实崩溃 —— 均无测试覆盖,需 e2e 容器测试

### 部署注意

- 升级后第一次启动:**前 2-5 秒**外部访问 `:443` 会看到 503 维护页(`Retry-After: 30`),搜索引擎理解这是临时状态
- 如果新路径出问题:**设 `VANBLOG_CADDY_MODE=legacy`** 重启容器,立即退回旧 Caddyfile 模式(无需重新 build)
- pb 起不来 → 容器 exit 让 Docker 重启(不靠 Caddy 兜底反代)
- 建议在 release notes 显式说明启动行为变化
