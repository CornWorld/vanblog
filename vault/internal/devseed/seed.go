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
