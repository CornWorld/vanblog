# 实施计划:模块详细设计

> **依据**:[`architecture-layering.md`](./architecture-layering.md) + [原项目源码](file:///Users/corn/Code/vanblog-upstream/packages/server/src/)
>
> 逐模块产出实施计划,每个模块包含:
>
> - pb 原生覆盖(不需要我们写)
> - Go 增量(具体函数签名 + 行数估计)
> - JSVM 扩展点(暴露什么给用户)
> - 依赖关系
> - 实现步骤

---

## 模块 0:`pb_migrations/` — Schema 初始化

### pb 原生覆盖

无 —— 必须手写 migration 创建 collections。

### Go 增量(~200 行)

**文件**:`pb_migrations/001_init_collections.go`(~150 行)

- 创建 10 个 collections(含字段 + 索引 + Rule)
- 来源:[`pb-schema-design.md`](./pb-schema-design.md) §2 的定义

**文件**:`pb_migrations/002_default_site.go`(~50 行)

- 插入 `site` 表 id=1 的默认行(空 nav/links/socials/rewards + 默认 theme=default + revisions.enabled=true + output/sync 关闭)

### JSVM 扩展点

无 —— migration 在启动时自动执行。

### 实现步骤

1. 用 pb Admin UI 手动创建 collections → 导出为 Go migration 代码
2. 调整 Rule 表达式(从 schema-design.md 复制)
3. 编写 002_default_site.go(硬编码默认 JSON)
4. 测试:从空数据库启动,验证 collections + site 行创建正确

### Done 当

- [ ] `go test ./pb_migrations/...` 通过
- [ ] 全新 SQLite 启动后,Admin UI 可见 10 个 collections
- [ ] `site` 表有且仅有 1 行,默认值正确

---

## 模块 1:`internal/caddy/` + `utils/caddyadmin/` — Caddy 集成

### pb 原生覆盖

无 —— pb 不涉及反代 / TLS / 路由。

### 分层:`utils/caddyadmin/`(通用工具)+ `internal/caddy/`(vanblog 业务)

**关键设计**:Caddy admin API 客户端是通用 HTTP 工具,与 vanblog 业务无关,独立成 `utils/caddyadmin/` 包。vanblog 的 `internal/caddy/` 调用它,加上业务层逻辑(路由翻译 / SSRF / 模板)。

```
vault/
  utils/
    caddyadmin/              # ★ 通用 Caddy admin API HTTP 客户端(与 vanblog 无关)
      client.go             # GET/POST/PATCH/DELETE /config/...
      types.go              # CaddyRoute / CaddyConfig / TLSPolicy 等 JSON 结构
      errors.go             # Caddy API 错误类型
      client_test.go        # 独立单元测试(mock HTTP server)
  internal/
    caddy/                   # ★ vanblog 业务层(调用 utils/caddyadmin)
      ssrf.go               # SSRF 白名单(vanblog 特有)
      translator.go         # site.routing DSL → caddy route(vanblog 特有)
      template.go           # prod/dev Caddyfile 模板(vanblog 特有)
      ask.go                # on-demand TLS ask 端点(vanblog 特有)
      bootstrap.go          # 启动时同步 site.routing(vanblog 特有)
```

### `utils/caddyadmin/`(~150 行,通用工具)

#### `utils/caddyadmin/client.go`(~100 行)

纯 HTTP 客户端,对应 Caddy admin API 的 REST 接口。

```go
package caddyadmin

type Client struct {
    baseURL    string           // "http://127.0.0.1:2019"
    httpClient *http.Client
}

func NewClient(baseURL string) *Client

// --- Config 全局 ---
func (c *Client) GetConfig() (json.RawMessage, error)              // GET /config
func (c *Client) LoadConfig(config json.RawMessage) error          // POST /load(原子替换)
func (c *Client) GetConfigPath(path string) (json.RawMessage, error) // GET /config/{path}
func (c *Client) PatchConfigPath(path string, value interface{}) error // PATCH /config/{path}
func (c *Client) DeleteConfigPath(path string) error               // DELETE /config/{path}

// --- TLS 管理 ---
func (c *Client) GetTLSSubjects() ([]string, error)                // GET .../tls/automation/policies/subjects
func (c *Client) UpdateTLSSubjects(domains []string) error         // PATCH .../tls/automation/policies/0/subjects
func (c *Client) GetAutocertDomains() ([]string, error)            // GET .../tls/certificates/automate
func (c *Client) UpdateAutocertDomains(domains []string) error     // PATCH .../tls/certificates/automate

// --- HTTP server ---
func (c *Client) SetHTTPRedirect(enable bool) error                // POST/DELETE listener_wrappers

// --- 路由管理(基于 @id)---
func (c *Client) AddRoute(route Route) error                       // POST .../routes/...
func (c *Client) RemoveRoute(id string) error                      // DELETE /id/{id}
func (c *Client) GetRoutes() ([]Route, error)                      // GET .../routes
```

#### `utils/caddyadmin/types.go`(~40 行)

Caddy JSON config 的 Go 结构体(只定义我们用到的部分)。

```go
type Route struct {
    ID    string `json:"@id,omitempty"`
    Match []MatchRule `json:"match,omitempty"`
    Handle []Handler `json:"handle,omitempty"`
}

type MatchRule struct {
    Path []string `json:"path,omitempty"`
    Host []string `json:"host,omitempty"`
}

type Handler struct {
    Handler   string `json:"handler"`  // reverse_proxy / static_response / rewrite / etc
    // reverse_proxy fields
    Upstreams []Upstream `json:"upstreams,omitempty"`
    // static_response fields
    StatusCode int `json:"status_code,omitempty"`
    Headers    map[string][]string `json:"headers,omitempty"`
}

type Upstream struct {
    Dial string `json:"dial"`
}
```

#### `utils/caddyadmin/errors.go`(~10 行)

```go
type APIError struct {
    StatusCode int
    Body       string
}
func (e *APIError) Error() string
```

### `internal/caddy/`(~200 行,vanblog 业务层)

#### `internal/caddy/ssrf.go`(~60 行)

SSRF 白名单校验(vanblog 特有,通用包不管)。

```go
var DefaultAllowlist = []string{
    "127.0.0.1", "localhost",
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "::1/128", "fc00::/7",
}

// ValidateTarget 校验用户配置的 proxy target 是否安全
func ValidateTarget(rawURL string, allowlist []string) error
```

#### `internal/caddy/translator.go`(~80 行)

`site.routing` DSL → `caddyadmin.Route` 翻译(vanblog 特有)。

```go
type UserRule struct {
    ID       string `json:"id"`
    Type     string `json:"type"`     // proxy/redirect/rewrite/block
    From     string `json:"from"`     // glob: /api/internal/*
    To       string `json:"to"`
    Code     int    `json:"code"`
    Headers  map[string]string `json:"headers"`
}

// Translate 把用户规则翻译为 Caddy route
func Translate(rule UserRule) (caddyadmin.Route, error)

// TranslateAll 批量翻译 + 保留路径冲突检测
func TranslateAll(rules []UserRule, reservedPaths []string) ([]caddyadmin.Route, error)
```

#### `internal/caddy/template.go`(~30 行)

```go
func RenderProdCaddyfile(opts TemplateOpts) string
func RenderDevCaddyfile(opts TemplateOpts) string
```

#### `internal/caddy/ask.go`(~15 行)

```go
func AskHandler(allowedDomains []string, domain string) bool
```

#### `internal/caddy/bootstrap.go`(~15 行)

```go
func SyncRoutes(client *caddyadmin.Client, rules []UserRule) error
```

### JSVM 扩展点

```javascript
vanblog.caddy.addRoute({
  id: "my-proxy",
  type: "proxy",
  from: "/my/*",
  to: "http://localhost:3000",
});
vanblog.caddy.removeRoute("my-proxy");
vanblog.caddy.getRoutes();
```

### 依赖

- `utils/caddyadmin`:无外部依赖(纯 net/http + encoding/json)
- `internal/caddy`:依赖 `utils/caddyadmin`

### 实现步骤

1. `utils/caddyadmin/client.go`:实现通用 HTTP 客户端(对照 Caddy admin API 文档)
2. `utils/caddyadmin/client_test.go`:用 `httptest.NewServer` mock Caddy,测试所有方法
3. `internal/caddy/ssrf.go`:白名单 + 云元数据防护
4. `internal/caddy/translator.go`:DSL 翻译 + 保留路径校验
5. `internal/caddy/template.go`:prod/dev Caddyfile 模板
6. `internal/caddy/ask.go` + `bootstrap.go`:端点 + 启动同步

### Done 当

- [ ] `utils/caddyadmin` 单元测试全通过(mock HTTP)
- [ ] `internal/caddy` SSRF 校验拒绝 169.254.169.254 / 公网 IP
- [ ] translator 正确翻译 proxy/redirect/rewrite/block
- [ ] translator 拒绝保留路径冲突
- [ ] 集成测试:启动 Caddy → bootstrap 同步 → 路由生效

---

## 模块 2:`internal/revisions/` — 文章历史版本

### pb 原生覆盖

无 —— pb 没有 record 历史版本功能。

### Go 增量(~100 行)

#### `internal/revisions/snapshot.go`(~40 行)

```go
// Snapshot 在 posts 更新前,把旧版本写入 revisions 表
// 作为 OnRecordBeforeUpdate("posts") hook 的实现
func Snapshot(app *pocketbase.PocketBase, oldRecord *core.Record) error
```

#### `internal/revisions/diff.go`(~30 行)

```go
// ComputeDiff 用 go-diff 计算两个版本的 unified diff
// 用于加速前端渲染(可选,存入 revisions.diff 字段)
func ComputeDiff(old, new string) string
```

#### `internal/revisions/restore.go`(~30 行)

```go
// Restore 把某个 revision 的 snapshot 写回 posts
// 会再次触发 OnRecordBeforeUpdate → 产生新 revision(reason="restore")
// 学习 git:revert 也是一次 commit
func Restore(app *pocketbase.PocketBase, revisionId string) error
```

### JSVM 扩展点

```javascript
// 用户自定义:某些文章不记录历史
onRecordBeforeUpdate((e) => {
  if (e.record.get("category") === "ephemeral") {
    e.skipRevision = true; // 跳过快照(如果暴露此标志)
  }
}, "posts");
```

### 依赖

- `github.com/sergi/go-diff`(diff 计算)

### Done 当

- [ ] 更新 posts → revisions 表自动写入旧版本
- [ ] 恢复操作 → 产生 reason="restore" 的新 revision
- [ ] 前端能列出历史 + 一键恢复

---

## 模块 3:`internal/migration/` — 迁移工具

### pb 原生覆盖

无 —— 这是 Vanblog 特有的 JSON 格式转换。

### Go 增量(~250 行)

#### `internal/migration/types.go`(~40 行)

原项目导出 JSON 的 Go 结构体定义。

```go
type LegacyBackup struct {
    Articles   []LegacyArticle `json:"articles"`
    Drafts     []LegacyDraft   `json:"drafts"`
    Categories []LegacyCategory `json:"categories"`
    Tags       []string         `json:"tags"`
    Meta       LegacyMeta       `json:"meta"`
    User       LegacyUser       `json:"user"`
    Viewer     []LegacyViewer   `json:"viewer"`
    Visit      []LegacyVisit    `json:"visit"`
    Static     []LegacyStatic   `json:"static"`
    Setting    LegacySetting    `json:"setting"`
}
```

#### `internal/migration/mapper.go`(~80 行)

字段映射函数(每个原表 → 新 collection 的转换)。

```go
func MapArticleToPost(a LegacyArticle) *Post
func MapDraftToPost(d LegacyDraft) *Post
func MapCategory(c LegacyCategory) *Category
func ExtractTags(articles, drafts) []*Tag
func MapMetaToSite(m LegacyMeta) *Site
func MapStaticToMedia(s LegacyStatic) *Media
```

#### `internal/migration/import.go`(~80 行)

核心导入逻辑(事务 + 批量)。

```go
type Result struct {
    Success int
    Failed  int
    Errors  []string
}

func Import(app *pocketbase.PocketBase, jsonData []byte) (Result, error)
// 内部:
// 1. json.Unmarshal → LegacyBackup
// 2. dao.RunInTransaction:
//    - articles + drafts → posts(合并,oldId 偏移)
//    - tags 去重 → tags 表 + posts.tags relation
//    - meta → site(单行 JSON)
//    - static → media(不下载文件)
//    - viewer + visit → visits(合并)
//    - 不兼容数据 → 迁移档案 post
```

#### `internal/migration/archive.go`(~50 行)

不兼容数据打包为迁移档案 post。

```go
func BuildMigrationArchive(data LegacyBackup) *Post
// 把 pipeline_scripts / picgo_config / custom_pages / caddy_settings / legacy_meta
// 等不兼容数据序列化为 JSON,作为 media 附件存入一条 status="hidden" 的 post
```

### JSVM 扩展点

```javascript
// 只是入口,不做逻辑
routerAdd("POST", "/api/migrate/import", (c) => {
  const result = vanblog.migration.import(c.request.body);
  return c.json(200, result);
});
```

### 依赖

- 无外部库(标准库 encoding/json)

### Done 当

- [ ] 原项目导出的 temp.json 能成功导入
- [ ] 导入后文章数 = articles.length + drafts.length
- [ ] 不兼容数据出现在迁移档案 post 里
- [ ] 失败时事务回滚,数据库不变

---

## 模块 4:`internal/article/` — 文章业务逻辑

### pb 原生覆盖

~80% —— CRUD / 分页 / 过滤 / 排序 = pb 自动 API。

### Go 增量(~120 行)

#### `internal/article/wordcount.go`(~20 行)

```go
// CountWords 统计文章字数(中文按字,英文按词)
func CountWords(content string) int
```

#### `internal/article/timeline.go`(~40 行)

```go
type TimelineEntry struct {
    Year  int
    Count int
    Months map[int]int
}

// GetTimeline 按年-月聚合已发布文章
func GetTimeline(app *pocketbase.PocketBase) ([]TimelineEntry, error)
```

#### `internal/article/search.go`(~40 行)

```go
type SearchResult struct {
    ID    string
    Title string
    Path  string
}

// Search 全文搜索(title + content + tags)
// v1 用 LIKE,v2 考虑 SQLite FTS5
func Search(app *pocketbase.PocketBase, query string, limit int) ([]SearchResult, error)
```

#### `internal/article/publish.go`(~20 行)

```go
// Publish 草稿 → 已发布(status 字段更新)
// 如果是已存在文章的修改,触发 revisions.Snapshot
func Publish(app *pocketbase.PocketBase, draftId string) error
```

### JSVM 扩展点

```javascript
vanblog.article.getTimeline();
vanblog.article.search("关键词", { limit: 10 });
vanblog.article.publish("DRAFT_ID");
```

### Done 当

- [ ] 时间线聚合正确(按年-月)
- [ ] 搜索能命中 title / content / tags
- [ ] 草稿发布后 status 变为 published

---

## 模块 5:`internal/media/` — 图床

### pb 原生覆盖

~90% —— FileField 覆盖上传 / 存储(本地+S3)/ thumbs / MIME 校验 / 大小限制。

### Go 增量(~80 行)

#### `internal/media/dedup.go`(~40 行)

```go
// CheckDuplicate 按 MD5 sign 查重
// 如果已存在,返回已有记录(跳过上传)
func CheckDuplicate(app *pocketbase.PocketBase, fileContent []byte) (*MediaRecord, error)
```

#### `internal/media/scan.go`(~40 行)

```go
// ScanArticleImages 扫描文章中的 <img src="..."> 链接
// 回填到 media 表(原项目 static.provider.ts 的 scanLinksOfArticles)
func ScanArticleImages(app *pocketbase.PocketBase, postId string) error
```

### JSVM 扩展点

```javascript
// 上传后的自定义处理(如额外生成 favicon size)
onRecordAfterCreate((e) => {
  if (e.record.get("staticType") === "favicon") {
    vanblog.media.generateThumb(e.record.id, "32x32");
  }
}, "media");
```

### Done 当

- [ ] 上传相同文件 → 返回已有记录(MD5 查重)
- [ ] S3 存储后端可配(pb Settings → Storage)

---

## 模块 6:`internal/visits/` — 访问计数

### pb 原生覆盖

~50% —— visits 表的 CRUD 是自动的,但计数聚合需要手写。

### Go 增量(~80 行)

#### `internal/visits/counter.go`(~30 行)

```go
// Increment 原子递增文章访问数
// SQL: UPDATE posts SET viewCount = viewCount + 1 WHERE id = ?
func Increment(app *pocketbase.PocketBase, postId string) error
```

#### `internal/visits/aggregate.go`(~50 行)

```go
type DailySummary struct {
    Date    string
    Views   int
    Uniques int
}

// AggregateDaily 生成全站每日聚合行(path="")
// 作为 cronAdd 每日执行
func AggregateDaily(app *pocketbase.PocketBase) error

// GetDailySummary 查询某日统计
func GetDailySummary(app *pocketbase.PocketBase, date string) (DailySummary, error)
```

### JSVM 扩展点

```javascript
vanblog.visits.getDailySummary("2024-01-01");
```

### Done 当

- [ ] 前台访问 → visits 表写入 + posts.viewCount 递增
- [ ] 每日 cron 生成全站聚合行

---

## 模块 7:`internal/markdown/` — Markdown 渲染

### pb 原生覆盖

无 —— pb 不做 markdown 渲染。

### Go 增量(~80 行)

#### `internal/markdown/render.go`(~80 行)

```go
// Render 把 markdown 渲染为 HTML
// 扩展:GFM(表格/任务列表/删除线)+ 代码高亮(chroma)+ 数学公式(katex)
func Render(md string) (string, error)

// RenderExcerpt 渲染摘要(<!-- more --> 之前的内容)
func RenderExcerpt(md string) (string, error)
```

**Go 库**:

- `github.com/yuin/goldmark` — 核心
- `github.com/yuin/goldmark-highlighting` — 代码高亮
- 自定义 katex 扩展(或前端 KaTeX auto-render)

### JSVM 扩展点

```javascript
const html = vanblog.markdown.render("**hello**");
```

### Done 当

- [ ] GFM 表格 / 任务列表 / 代码高亮正确渲染
- [ ] `<!-- more -->` 分割摘要

---

## 模块 8:`internal/rss/` + `internal/sitemap/` — Feed 生成

### pb 原生覆盖

无。

### Go 增量(~150 行)

#### `internal/rss/generator.go`(~100 行)

```go
type FeedItem struct {
    Title       string
    Link        string
    Description string
    PubDate     time.Time
    Categories  []string
}

// GenerateRSS 生成 RSS 2.0 XML
func GenerateRSS(app *pocketbase.PocketBase, siteURL string) ([]byte, error)

// GenerateAtom 生成 Atom XML
func GenerateAtom(app *pocketbase.PocketBase, siteURL string) ([]byte, error)
```

#### `internal/sitemap/generator.go`(~50 行)

```go
// GenerateSitemap 生成 sitemap.xml
func GenerateSitemap(app *pocketbase.PocketBase, siteURL string) ([]byte, error)
```

### 实现细节

- 作为 pb 自定义路由暴露(`/feed.xml` / `/atom.xml` / `/sitemap.xml`)
- 或写入静态文件(配合 `site.output`)

### Done 当

- [ ] RSS reader(Feedly / NetNewsWire)能订阅
- [ ] Google Search Console 能提交 sitemap

---

## 模块 9:`internal/hooks/` — JSVM 绑定层

### Go 增量(~150 行)

每个 `bind_*.go` 文件把对应模块的函数注册到 JSVM 的 `vanblog.*` 命名空间。

#### `internal/hooks/register.go`(~30 行)

```go
// Register 在 pb 启动时注册所有 vanblog.* JSVM 绑定
func Register(app *pocketbase.PocketBase) {
    app.OnServe().BindFunc(func(se *core.ServeEvent) error {
        // 获取 JSVM 实例,注册 vanblog 命名空间
        // 调用各 bind_*.go 的注册函数
        return se.Next()
    })
}
```

#### 各 `bind_*.go`(每个 ~20 行)

```go
// bind_article.go
func BindArticle(vm *goja.Runtime, app *pocketbase.PocketBase)

// bind_caddy.go
func BindCaddy(vm *goja.Runtime, client *caddy.Client)

// bind_migration.go
func BindMigration(vm *goja.Runtime, app *pocketbase.PocketBase)

// bind_revisions.go
func BindRevisions(vm *goja.Runtime, app *pocketbase.PocketBase)

// bind_visits.go
func BindVisits(vm *goja.Runtime, app *pocketbase.PocketBase)

// bind_markdown.go
func BindMarkdown(vm *goja.Runtime)
```

### Done 当

- [ ] JSVM 里 `vanblog.article.search("test")` 能调用 Go 实现
- [ ] TypeScript 声明文件 `pb_hooks/lib/vanblog.js` 与实际绑定一致

---

## 实现顺序(依赖关系)

```
Phase 1: 基础设施(无依赖)
  ├── pb_migrations(schema)
  ├── caddy/client + ssrf + template
  └── markdown/render

Phase 2: 业务模块(依赖 schema)
  ├── article(wordcount + timeline + search + publish)
  ├── media(dedup + scan)
  ├── visits(counter + aggregate)
  └── revisions(snapshot + diff + restore)

Phase 3: 集成层(依赖 Phase 1+2)
  ├── caddy/translator + bootstrap(依赖 schema 的 site.routing)
  ├── migration/import + archive(依赖 schema 全部表)
  ├── rss + sitemap(依赖 article)
  └── hooks/register(依赖所有模块)

Phase 4: JSVM 扩展点 + 示例
  └── pb_hooks/example_hooks.pb.js + lib/vanblog.js
```

---

## 总计 Go 代码量(修正后)

| 模块             | 行数      | 累计 |
| ---------------- | --------- | ---- |
| pb_migrations    | ~200      | 200  |
| utils/caddyadmin | ~150      | 350  |
| internal/caddy   | ~200      | 550  |
| revisions        | ~100      | 650  |
| migration        | ~250      | 900  |
| article          | ~120      | 1020 |
| media            | ~80       | 1100 |
| visits           | ~80       | 1180 |
| markdown         | ~80       | 1260 |
| rss + sitemap    | ~150      | 1410 |
| hooks 绑定       | ~150      | 1560 |
| main.go          | ~30       | 1590 |
| **总计**         | **~1590** |      |

> 比之前估算的 ~940 行多,主要因为 caddy 模块从 80 → 350(新增路由翻译 + SSRF + 模板渲染,原项目没有)和 migration 工具(150 → 250,含归档)。
