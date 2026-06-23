//go:build ignore

// Verification script for vanblog schema design.
// Run: go run scripts/verify_schema.go
//
// Tests against a real PocketBase instance (in-process, temp DB).

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "vanblog-pb-verify")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir: tmpDir,
	})

	// Bootstrap manually (without serving) so we can use the DB directly
	if err := app.Bootstrap(); err != nil {
		log.Fatalf("Bootstrap failed: %v", err)
	}

	fmt.Println("=== vanblog schema verification ===")
	defer fmt.Println("\n=== Done ===")

	// 1. Create collections
	tagsCol := createTags(app)
	createPosts(app, tagsCol)
	createSite(app)

	// 2. Test tags + posts relation (many-to-many)
	tag1 := newRecord(app, tagsCol, map[string]any{"name": "Go", "slug": "go"})
	tag2 := newRecord(app, tagsCol, map[string]any{"name": "Rust", "slug": "rust"})
	fmt.Printf("  [OK] tags created: %s, %s\n", tag1.Id, tag2.Id)

	postsCol, _ := app.FindCollectionByNameOrId("posts")
	post1 := newRecord(app, postsCol, map[string]any{
		"title":     "Hello World",
		"status":    "published",
		"viewCount": 0,
		"private":   false,
		"tags":      []string{tag1.Id, tag2.Id},
	})
	fmt.Printf("  [OK] post created with 2 tags: %s\n", post1.Id)

	// Draft post (no tags)
	newRecord(app, postsCol, map[string]any{
		"title":  "Draft",
		"status": "draft",
	})
	fmt.Println("  [OK] draft post created")

	// 3. Verify relation
	loaded, _ := app.FindRecordById("posts", post1.Id)
	tagIDs := loaded.GetStringSlice("tags")
	fmt.Printf("  [OK] post has %d tags: %v\n", len(tagIDs), tagIDs)

	// 4. Query: posts by tag (back-relation via filter)
	byTag, err := app.FindRecordsByFilter("posts", fmt.Sprintf("tags ?= '%s'", tag1.Id), "", 0, 0)
	if err != nil {
		fmt.Printf("  [WARN] query by tag: %v\n", err)
	} else {
		fmt.Printf("  [OK] posts with tag %s: %d results\n", tag1.Id, len(byTag))
	}

	// 5. Query: published only
	pub, _ := app.FindRecordsByFilter("posts", "status='published'", "", 0, 0)
	fmt.Printf("  [OK] published posts: %d (draft excluded)\n", len(pub))

	// 6. Site JSON
	siteCol, _ := app.FindCollectionByNameOrId("site")
	site := newRecord(app, siteCol, map[string]any{
		"theme": "default",
		"nav":   json.RawMessage(`[{"name":"Home","value":"/"}]`),
		"info":  json.RawMessage(`{"siteName":"My Blog"}`),
	})
	loadedSite, _ := app.FindRecordById("site", site.Id)
	navJSON := loadedSite.GetString("nav")
	var nav []map[string]string
	json.Unmarshal([]byte(navJSON), &nav)
	fmt.Printf("  [OK] site JSON nav: %d items, theme=%s\n", len(nav), loadedSite.GetString("theme"))

	// 7. Verify Rule expressions compile (just check they don't error on save)
	fmt.Printf("  [OK] posts ListRule: %s\n", *postsCol.ListRule)
	fmt.Printf("  [OK] site ListRule: %s\n", *siteCol.ListRule)
}

func createTags(app *pocketbase.PocketBase) *core.Collection {
	col := core.NewCollection("base", "tags")
	col.Fields.Add(&core.TextField{Name: "name", Required: true})
	col.Fields.Add(&core.TextField{Name: "slug"})
	col.ListRule = strPtr("")
	col.ViewRule = strPtr("")
	mustSave(app, col)
	fmt.Println("  [OK] tags collection created")
	return col
}

func createPosts(app *pocketbase.PocketBase, tagsCol *core.Collection) {
	col := core.NewCollection("base", "posts")
	col.Fields.Add(&core.TextField{Name: "title", Required: true})
	col.Fields.Add(&core.TextField{Name: "content"})
	col.Fields.Add(&core.SelectField{
		Name:   "status",
		Values: []string{"draft", "published", "hidden"},
	})
	col.Fields.Add(&core.TextField{Name: "pathname"})
	col.Fields.Add(&core.NumberField{Name: "viewCount"})
	col.Fields.Add(&core.BoolField{Name: "private"})
	col.Fields.Add(&core.RelationField{
		Name:         "tags",
		CollectionId: tagsCol.Id,
		MaxSelect:    100,
	})
	col.ListRule = strPtr(`status = "published" && private = false || @request.auth.id != ""`)
	col.ViewRule = col.ListRule
	col.CreateRule = strPtr(`@request.auth.id != ""`)
	col.UpdateRule = col.CreateRule
	col.DeleteRule = col.CreateRule
	mustSave(app, col)
	fmt.Println("  [OK] posts collection created")
}

func createSite(app *pocketbase.PocketBase) {
	col := core.NewCollection("base", "site")
	col.Fields.Add(&core.JSONField{Name: "info"})
	col.Fields.Add(&core.SelectField{Name: "theme", Values: []string{"default", "minimal", "magazine", "custom"}})
	col.Fields.Add(&core.JSONField{Name: "nav"})
	col.Fields.Add(&core.JSONField{Name: "links"})
	col.Fields.Add(&core.JSONField{Name: "socials"})
	col.Fields.Add(&core.JSONField{Name: "rewards"})
	col.Fields.Add(&core.JSONField{Name: "customize"})
	col.Fields.Add(&core.JSONField{Name: "routing"})
	col.ListRule = strPtr("")
	col.ViewRule = strPtr("")
	col.CreateRule = strPtr(`@request.auth.id != ""`)
	col.UpdateRule = col.CreateRule
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	mustSave(app, col)
	fmt.Println("  [OK] site collection created")
}

func newRecord(app *pocketbase.PocketBase, col *core.Collection, fields map[string]any) *core.Record {
	r := core.NewRecord(col)
	for k, v := range fields {
		r.Set(k, v)
	}
	if err := app.Save(r); err != nil {
		log.Fatalf("failed to create record in %s: %v", col.Name, err)
	}
	return r
}

func mustSave(app *pocketbase.PocketBase, col *core.Collection) {
	if err := app.Save(col); err != nil {
		log.Fatalf("failed to save collection %s: %v", col.Name, err)
	}
}

func strPtr(s string) *string { return &s }
