// Package devseed populates the database with sample data using gofakeit.
//
// Usage:
//
//	go run . seed          # seed 50 posts
//	go run . seed --count 200
package devseed

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func Seed(app core.App, postCount int) error {
	if postCount <= 0 {
		postCount = 50
	}

	// Deterministic but varied: seed changes per run but sequences are reproducible.
	gofakeit.Seed(time.Now().UnixNano())

	catIDs := make(map[string]string)
	tagIDs := make(map[string]string)

	// ── Categories (via gofakeit) ──
	catNames := distinctHackerPhrases(5)
	for _, c := range catNames {
		id, err := ensureCategory(app, c, "category")
		if err != nil {
			return fmt.Errorf("category %q: %w", c, err)
		}
		catIDs[c] = id
	}

	// ── Tags (via gofakeit hacker abbreviations + common tech terms) ──
	tagNames := distinctHackerAbbreviations(12)
	for _, t := range tagNames {
		id, err := ensureTag(app, t)
		if err != nil {
			return fmt.Errorf("tag %q: %w", t, err)
		}
		tagIDs[t] = id
	}

	// ── Site config ──
	if err := ensureSite(app); err != nil {
		return fmt.Errorf("site: %w", err)
	}

	// ── Posts (via gofakeit) ──
	catList := catNames
	tagList := tagNames
	for i := 0; i < postCount; i++ {
		title := gofakeit.HackerPhrase()
		content := generatePost(gofakeit.New(uint64(time.Now().UnixNano()) + uint64(i)))
		cat := catList[rand.Intn(len(catList))]
		nTags := 2 + rand.Intn(4)
		var postTags []string
		for j := 0; j < nTags; j++ {
			postTags = append(postTags, tagList[rand.Intn(len(tagList))])
		}
		if _, err := ensurePost(app, title, content, catIDs[cat], lookups(tagIDs, dedup(postTags))); err != nil {
			return fmt.Errorf("post %q: %w", title, err)
		}
	}

	// ── Feature showcase: hard-coded post exercising all rendering features ──
	showcaseTitle := "📐 Feature Showcase — Markdown 全功能测试"
	showcaseContent := trim(`
## 代码高亮

Go 示例：

` + "```go" + `
func main() {
    ch := make(chan int, 10)
    for i := 0; i < 10; i++ {
        go func(n int) { ch <- n * n }(i)
    }
    fmt.Println(<-ch)
}
` + "```" + `

TypeScript 示例：

` + "```typescript" + `
interface Post {
  title: string;
  tags: string[];
  created: Date;
}

const posts: Post[] = await pb.collection('posts').getFullList({
  filter: 'status = "published" && deleted = false',
  sort: '-created',
});
` + "```" + `

Bash 示例：

` + "```bash" + `
docker run --rm -p 80:80 -p 443:443 \\
  -v $(pwd)/pb_data:/pb_data \\
  -v $(pwd)/caddy_data:/data/caddy \\
  ghcr.io/cornworld/vanblog:prod
` + "```" + `

## KaTeX 数学公式

内联公式：$E = mc^2$，行内 $f(x) = \int_{-\infty}^\infty \hat f(\xi) e^{2\pi i \xi x} d\xi$。

块级公式：

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
\begin{bmatrix}
ax + by \\
cx + dy
\end{bmatrix}
$$

概率密度函数：$P(X \leq x) = \frac{1}{\sigma\sqrt{2\pi}} \int_{-\infty}^x e^{-\frac{(t-\mu)^2}{2\sigma^2}} dt$

## Mermaid 图表

流程图：

` + "```mermaid" + `
graph LR
    A[浏览器] --> B[Caddy :443]
    B --> C{Astro SSR}
    C -->|/posts/*| D[renderMarkdown]
    C -->|/admin/*| E[ByteMD Editor]
    D --> F[PocketBase API]
    E --> F
    F --> G[(SQLite)]
` + "```" + `

时序图：

` + "```mermaid" + `
sequenceDiagram
    actor U as 用户
    participant A as Astro
    participant P as PocketBase
    U->>A: GET /posts/xxx
    A->>P: getOne('posts', id)
    P-->>A: { title, content, ... }
    A->>A: renderMarkdown(content)
    A-->>U: HTML
` + "```" + `

## GFM 扩展

任务列表：

- [x] Go 后端 PocketBase 集成
- [x] Astro Hybrid SSR 渲染
- [x] ByteMD 编辑器
- [ ] Waline 评论系统
- [ ] ARM 多架构支持

~~删除线~~ 和 **加粗** 以及 *斜体* 和 ` + "`" + `行内代码` + "`" + `。

## 表格

| 特性 | 状态 | 备注 |
|------|------|------|
| Markdown 渲染 | ✅ | Shiki 双主题 |
| 数学公式 | ✅ | KaTeX |
| 图表 | ✅ | Mermaid |
| 代码高亮 | ✅ | Shiki |
| RSS/Atom | ✅ | ` + "`/api/feed.xml`" + ` |
| Sitemap | ✅ | ` + "`/api/sitemap.xml`" + ` |
| 暗色模式 | ✅ | ` + "`.dark`" + ` class |

## 自定义容器

:::tip
这是一个提示框。PocketBase 单文件部署，SQLite 无需额外配置。
:::

:::warning
生产环境务必配置 **Caddy TLS** 和 **VANBLOG_EMAIL** 环境变量。
:::

:::info
Astro 6 支持 Hybrid 渲染模式，逐页控制 SSG/SSR。
:::

:::danger
不要直接暴露 PocketBase 的 8090 端口到公网！
:::

## 摘要分割测试

这一行**之前**的内容会出现在首页摘要中。摘要约 150 字，超出部分用 ` + "`...`" + ` 截断。

<!-- more -->

这一行之后的内容只在文章详情页显示。
`)

	// First category, second category, any tags
	scat := catList[0]
	stagIDs := lookups(tagIDs, []string{tagList[0], tagList[1], tagList[2]})
	if len(catList) > 1 {
		scat = catList[1]
	}
	if _, err := ensurePost(app, showcaseTitle, showcaseContent, catIDs[scat], stagIDs); err != nil {
		return fmt.Errorf("showcase post: %w", err)
	}

	return nil
}

func generatePost(f *gofakeit.Faker) string {
	var b strings.Builder

	b.WriteString(f.LoremIpsumParagraph(1, 3, 8, "\n\n"))
	b.WriteString("\n\n## " + f.HackerPhrase() + "\n\n")
	b.WriteString(f.LoremIpsumParagraph(2, 5, 12, "\n\n"))

	// Code block
	lang := pick(f, []string{"go", "typescript", "bash", "python", "rust"})
	b.WriteString("\n\n```" + lang + "\n")
	for i := 0; i < 3+f.IntN(5); i++ {
		b.WriteString(f.HackerPhrase() + " // " + f.HackerVerb() + "\n")
	}
	b.WriteString("```\n\n")
	b.WriteString(f.LoremIpsumParagraph(1, 4, 10, "\n\n"))

	// Table
	b.WriteString("\n\n| " + f.HackerNoun() + " | " + f.HackerNoun() + " | " + f.HackerNoun() + " |\n")
	b.WriteString("|------|------|------|\n")
	for i := 0; i < 3; i++ {
		b.WriteString("| " + f.HackerAbbreviation() + " | " + f.HackerAdjective() + " | " + fmt.Sprintf("%d", f.IntN(9999)) + " |\n")
	}

	b.WriteString("\n\n:::tip\n" + f.HackerPhrase() + "\n:::\n\n")
	b.WriteString(f.LoremIpsumParagraph(1, 3, 8, "\n\n"))

	// Second heading + list
	b.WriteString("\n\n## " + f.HackerPhrase() + "\n\n")
	for i := 0; i < 4; i++ {
		b.WriteString("- **" + f.HackerAbbreviation() + "**: " + f.HackerPhrase() + "\n")
	}

	// First post gets a <!-- more --> break
	// (caller controls this via the loop index)

	return b.String()
}

func ensureCategory(app core.App, name, ctype string) (string, error) {
	col, err := app.FindCollectionByNameOrId("categories")
	if err != nil {
		return "", err
	}
	rec, err := app.FindFirstRecordByFilter("categories", "name={:n}", dbx.Params{"n": name})
	if err == nil {
		return rec.Id, nil
	}
	rec = core.NewRecord(col)
	rec.Set("name", name)
	rec.Set("type", ctype)
	if err := app.Save(rec); err != nil {
		return "", err
	}
	return rec.Id, nil
}

func ensureTag(app core.App, name string) (string, error) {
	col, err := app.FindCollectionByNameOrId("tags")
	if err != nil {
		return "", err
	}
	rec, err := app.FindFirstRecordByFilter("tags", "name={:n}", dbx.Params{"n": name})
	if err == nil {
		return rec.Id, nil
	}
	rec = core.NewRecord(col)
	rec.Set("name", name)
	rec.Set("slug", strings.ToLower(strings.ReplaceAll(name, " ", "-")))
	if err := app.Save(rec); err != nil {
		return "", err
	}
	return rec.Id, nil
}

func ensurePost(app core.App, title, content, categoryID string, tagIDs []string) (string, error) {
	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		return "", err
	}
	rec, err := app.FindFirstRecordByFilter("posts", "title={:t}", dbx.Params{"t": title})
	if err == nil {
		return rec.Id, nil
	}
	daysAgo := rand.Intn(365)
	now := time.Now().Add(-time.Duration(daysAgo) * 24 * time.Hour)
	now = now.Add(-time.Duration(rand.Intn(1440)) * time.Minute)

	rec = core.NewRecord(col)
	rec.Set("title", title)
	rec.Set("content", content)
	rec.Set("status", "published")
	rec.Set("category", categoryID)
	rec.Set("tags", tagIDs)
	rec.Set("created", now)
	rec.Set("updated", now)
	rec.Set("deleted", false)
	rec.Set("pathname", "/"+gofakeit.UrlSlug(rand.Intn(5)+2))
	if err := app.Save(rec); err != nil {
		return "", err
	}
	return rec.Id, nil
}

func ensureSite(app core.App) error {
	col, err := app.FindCollectionByNameOrId("site")
	if err != nil {
		return err
	}
	rec, err := app.FindFirstRecordByFilter("site", "id!=''")
	if err == nil {
		if rec.GetString("siteName") == "" {
			rec.Set("siteName", gofakeit.AppName())
		}
		if rec.GetString("siteDesc") == "" {
			rec.Set("siteDesc", gofakeit.HackerPhrase())
		}
		if rec.GetString("author") == "" {
			rec.Set("author", gofakeit.Name())
		}
		return app.Save(rec)
	}
	rec = core.NewRecord(col)
	rec.Set("siteName", gofakeit.AppName())
	rec.Set("siteDesc", gofakeit.HackerPhrase())
	rec.Set("author", gofakeit.Name())
	return app.Save(rec)
}

func distinctHackerPhrases(n int) []string {
	seen := map[string]bool{}
	var out []string
	for len(out) < n {
		p := gofakeit.HackerPhrase()
		if !seen[p] {
			seen[p] = true
			out = append(out, p)
		}
	}
	return out
}

func distinctHackerAbbreviations(n int) []string {
	seen := map[string]bool{}
	var out []string
	for len(out) < n {
		a := gofakeit.HackerAbbreviation()
		if !seen[a] {
			seen[a] = true
			out = append(out, a)
		}
	}
	return out
}

func lookups(m map[string]string, keys []string) []string {
	var out []string
	for _, k := range keys {
		if v, ok := m[k]; ok {
			out = append(out, v)
		}
	}
	return out
}

func pick[T any](f *gofakeit.Faker, items []T) T {
	return items[f.IntN(len(items))]
}

func dedup(items []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range items {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

func trim(s string) string {
	return strings.TrimSpace(s)
}
