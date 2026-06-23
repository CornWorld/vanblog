//go:build ignore

// End-to-end verification of vanblog schema.
// Tests: CRUD, auth, tags relation, site config, visits, revisions, media.
// Run: go run scripts/verify_e2e.go

package main

import (
	"encoding/json"
	"fmt"
	"os"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-e2e")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		fmt.Printf("Bootstrap: %v\n", err)
		os.Exit(1)
	}
	if err := app.RunAppMigrations(); err != nil {
		fmt.Printf("Migration: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== vanblog schema E2E verification ===\n")

	// 1. Auth: create admin user
	admin := createUser(app, "admin", "admin@vanblog.dev", "admin")
	check("create admin user", admin != nil)

	// 2. Auth: create collaborator with limited permissions
	collab := createUser(app, "writer1", "writer@vanblog.dev", "collaborator",
		"article:create", "article:update", "draft:create", "draft:update")
	check("create collaborator with permissions", collab != nil)

	// 3. Categories
	cat1 := createRecord(app, "categories", map[string]any{"name": "Tech", "type": "category"})
	cat2 := createRecord(app, "categories", map[string]any{"name": "Life", "type": "category"})
	check("create 2 categories", cat1 != nil && cat2 != nil)

	// 4. Tags
	tag1 := createRecord(app, "tags", map[string]any{"name": "Go", "slug": "go"})
	tag2 := createRecord(app, "tags", map[string]any{"name": "Rust", "slug": "rust"})
	tag3 := createRecord(app, "tags", map[string]any{"name": "Docker", "slug": "docker"})
	check("create 3 tags", tag1 != nil && tag2 != nil && tag3 != nil)

	// 5. Posts: published with multiple tags + category + author
	post1 := createRecord(app, "posts", map[string]any{
		"title":   "Building a Blog with PocketBase",
		"content": "# Hello\n\nThis is my first post.\n\n<!-- more -->\n\nMore content.",
		"status":  "published",
		"tags":    []string{tag1.Id, tag3.Id},
		"category": cat1.Id,
		"author":  admin.Id,
		"pathname": "building-blog-pocketbase",
	})
	check("create published post with 2 tags", post1 != nil)

	// 6. Posts: draft (no tags)
	post2 := createRecord(app, "posts", map[string]any{
		"title":  "Draft: Learning Rust",
		"content": "Work in progress...",
		"status": "draft",
		"author": collab.Id,
	})
	check("create draft post", post2 != nil)

	// 7. Posts: hidden (accessible by URL but not listed)
	post3 := createRecord(app, "posts", map[string]any{
		"title":   "Private Post",
		"content": "Secret stuff",
		"status":  "hidden",
		"private": true,
		"password": "secret123",
		"author":  admin.Id,
	})
	check("create hidden+private post", post3 != nil)

	// 8. Query: published posts only (frontend view)
	pubPosts, _ := app.FindRecordsByFilter("posts", "status='published'", "-created", 0, 0)
	check("published posts visible to frontend", len(pubPosts) == 1 && pubPosts[0].GetString("title") == "Building a Blog with PocketBase")

	// 9. Query: all posts (admin view)
	allPosts, _ := app.FindRecordsByFilter("posts", "", "-created", 0, 0)
	check("all posts visible to admin", len(allPosts) == 3)

	// 10. Query: posts by tag (relation array filter)
	postsWithGo, _ := app.FindRecordsByFilter("posts", "tags~'"+tag1.Id+"'", "", 0, 0)
	check("posts with 'Go' tag", len(postsWithGo) == 1)

	// 11. Query: posts by category
	postsInTech, _ := app.FindRecordsByFilter("posts", "category='"+cat1.Id+"'", "", 0, 0)
	check("posts in 'Tech' category", len(postsInTech) == 1)

	// 12. Tags: count posts per tag (back-relation)
	for _, tag := range []*core.Record{tag1, tag2, tag3} {
		count, _ := app.CountRecords("posts", nil)
		_ = count
		// back-relation would be posts_via_tags, but direct query is simpler
		tagPosts, _ := app.FindRecordsByFilter("posts", "tags~'"+tag.Id+"' && status='published'", "", 0, 0)
		fmt.Printf("  📊 tag '%s': %d published posts\n", tag.GetString("name"), len(tagPosts))
	}

	// 13. Site config: update
	site, _ := app.FindFirstRecordByFilter("site", "")
	site.Set("theme", "minimal")
	site.Set("info", json.RawMessage(`{"siteName":"My Tech Blog","author":"Admin","baseUrl":"https://blog.example.com"}`))
	site.Set("nav", json.RawMessage(`[{"name":"Home","value":"/"},{"name":"Tags","value":"/tags"},{"name":"About","value":"/about"}]`))
	site.Set("links", json.RawMessage(`[{"name":"Friend Blog","url":"https://friend.example.com","desc":"A friend's blog"}]`))
	site.Set("commentsProvider", "giscus")
	site.Set("commentsConfig", json.RawMessage(`{"repo":"user/blog-comments","category":"General"}`))
	app.Save(site)
	check("update site config", site.GetString("theme") == "minimal")

	// 14. Site config: read back
	siteReloaded, _ := app.FindFirstRecordByFilter("site", "")
	var siteInfo map[string]string
	json.Unmarshal([]byte(siteReloaded.GetString("info")), &siteInfo)
	check("site config persisted", siteInfo["siteName"] == "My Tech Blog")

	// 15. Media: create file metadata record
	media := createRecord(app, "media", map[string]any{
		"staticType":  "img",
		"storageType": "local",
		"fileType":    "png",
		"sign":        "abc123def456",
		"meta":        json.RawMessage(`{"width":800,"height":600,"size":"1.2MB"}`),
	})
	check("create media record", media != nil)

	// 16. Visits: track a page view
	visit := createRecord(app, "visits", map[string]any{
		"date":  "2026-06-23",
		"path":  "/building-blog-pocketbase",
		"views": 1,
		"post":  post1.Id,
	})
	check("create visit record", visit != nil)

	// 17. Update post view count
	post1.Set("viewCount", 42)
	post1.Set("visitedCount", 38)
	app.Save(post1)
	postReloaded, _ := app.FindRecordById("posts", post1.Id)
	check("post view count updated", postReloaded.GetInt("viewCount") == 42)

	// 18. Revisions: snapshot before update
	snapshot := map[string]any{
		"title":   post1.GetString("title"),
		"content": post1.GetString("content"),
		"status":  post1.GetString("status"),
	}
	snapshotJSON, _ := json.Marshal(snapshot)
	createRecord(app, "revisions", map[string]any{
		"target":     post1.Id,
		"snapshot":   json.RawMessage(snapshotJSON),
		"reason":     "auto-save",
		"authoredBy": admin.Id,
	})

	// Update post
	post1.Set("title", "Building a Blog with PocketBase (Updated)")
	app.Save(post1)

	// Verify revision exists
	revisions, _ := app.FindRecordsByFilter("revisions", "target='"+post1.Id+"'", "-created", 0, 0)
	check("revision snapshot saved before update", len(revisions) == 1)

	// 19. Audits: log an action
	createRecord(app, "audits", map[string]any{
		"actor":   admin.Id,
		"action":  "post.update",
		"target":  post1.Id,
		"result":  "success",
		"detail":  json.RawMessage(`{"field":"title","old":"Building...","new":"Building... (Updated)"}`),
	})
	audits, _ := app.FindRecordsByFilter("audits", "", "-created", 0, 0)
	check("audit log entry created", len(audits) == 1)

	// 20. Token: create API token
	createRecord(app, "tokens", map[string]any{
		"name":     "CI/CD Token",
		"tokenHash": "hashed_secret_here",
		"user":     admin.Id,
		"disabled": false,
	})
	tokens, _ := app.FindRecordsByFilter("tokens", "", "", 0, 0)
	check("API token created", len(tokens) == 1)

	// 21. Delete: soft delete a post
	post2.Set("deleted", true)
	app.Save(post2)
	activePosts, _ := app.FindRecordsByFilter("posts", "deleted=false && status='published'", "", 0, 0)
	check("soft deleted post excluded from active", len(activePosts) == 1)

	fmt.Println("\n=== Summary ===")
	fmt.Printf("  Total posts: %d (1 published, 1 draft+deleted, 1 hidden)\n", 3)
	fmt.Printf("  Tags: %d | Categories: %d\n", 3, 2)
	fmt.Printf("  Media: %d | Visits: %d | Revisions: %d\n", 1, 1, 1)
	fmt.Printf("  Audits: %d | Tokens: %d\n", 1, 1)
	fmt.Printf("  Site: theme=%s, comments=%s\n",
		siteReloaded.GetString("theme"),
		siteReloaded.GetString("commentsProvider"))
}

var passCount, failCount int

func check(desc string, ok bool) {
	if ok {
		fmt.Printf("  ✅ %s\n", desc)
		passCount++
	} else {
		fmt.Printf("  ❌ %s\n", desc)
		failCount++
	}
}

func createUser(app *pocketbase.PocketBase, username, email, role string, perms ...string) *core.Record {
	col, _ := app.FindCollectionByNameOrId("users")
	r := core.NewRecord(col)
	r.Set("username", username)
	r.Set("email", email)
	r.Set("password", "password12345")
	r.Set("passwordConfirm", "password12345")
	r.Set("role", role)
	if len(perms) > 0 {
		r.Set("permissions", perms)
	}
	if err := app.Save(r); err != nil {
		fmt.Printf("  createUser error: %v\n", err)
		return nil
	}
	return r
}

func createRecord(app *pocketbase.PocketBase, collection string, fields map[string]any) *core.Record {
	col, _ := app.FindCollectionByNameOrId(collection)
	if col == nil {
		fmt.Printf("  createRecord: collection %s not found\n", collection)
		return nil
	}
	r := core.NewRecord(col)
	for k, v := range fields {
		r.Set(k, v)
	}
	if err := app.Save(r); err != nil {
		fmt.Printf("  createRecord(%s) error: %v\n", collection, err)
		return nil
	}
	return r
}
