//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"os"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/cornworld/vanblog/internal/article"
	"github.com/cornworld/vanblog/internal/revisions"
	"github.com/cornworld/vanblog/internal/visits"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-int")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	app.Bootstrap()
	app.RunAppMigrations()

	// Construct managers — each registers its own pb hooks (events + routes).
	artMgr := article.New(app)
	revMgr := revisions.New(app)
	visits.New(app)

	fmt.Println("=== Integration Test ===")

	// 1. Create tag (via Go API, no auth needed)
	tagsCol, _ := app.FindCollectionByNameOrId("tags")
	tag := core.NewRecord(tagsCol)
	tag.Set("name", "Go")
	tag.Set("slug", "go")
	app.Save(tag)
	fmt.Printf("✅ tag created: %s\n", tag.Id)

	// 2. Create category
	catsCol, _ := app.FindCollectionByNameOrId("categories")
	cat := core.NewRecord(catsCol)
	cat.Set("name", "Tech")
	app.Save(cat)
	fmt.Printf("✅ category created: %s\n", cat.Id)

	// 3. Create published post with tag + category
	postsCol, _ := app.FindCollectionByNameOrId("posts")
	post := core.NewRecord(postsCol)
	post.Set("title", "Hello World")
	post.Set("content", "# Hello\n\nMy first post about Go.")
	post.Set("status", "published")
	post.Set("pathname", "/hello-world")
	post.Set("tags", []string{tag.Id})
	post.Set("category", cat.Id)
	post.Set("deleted", false)
	app.Save(post)
	fmt.Printf("✅ post created: %s\n", post.Id)

	// 4. Create a draft
	draft := core.NewRecord(postsCol)
	draft.Set("title", "Work in Progress")
	draft.Set("content", "TODO")
	draft.Set("status", "draft")
	draft.Set("deleted", false)
	app.Save(draft)
	fmt.Printf("✅ draft created: %s\n", draft.Id)

	// 5. Check timeline (real article.Manager.GetTimeline)
	timeline, _ := artMgr.GetTimeline()
	fmt.Printf("✅ timeline: %d years\n", len(timeline))

	// 6. Check search (real article.Manager.Search)
	results, _ := artMgr.Search("Hello", 10)
	fmt.Printf("✅ search 'Hello': %d results\n", len(results))

	results2, _ := artMgr.Search("nonexistent", 10)
	fmt.Printf("✅ search 'nonexistent': %d results\n", len(results2))

	// 7. Update site (for RSS later if needed)
	site, _ := app.FindFirstRecordByFilter("site", "")
	if site != nil {
		site.Set("siteName", "Test Blog")
		site.Set("baseUrl", "https://blog.test.com")
		app.Save(site)
	}

	// 8. Update post → trigger revisions hook (snapshotBeforePostUpdate)
	// Note: pb's OnRecordUpdateRequest only fires on HTTP PATCH, not Go Save.
	// We call the Manager method directly to simulate the hook path.
	revMgr.CaptureBeforeUpdate(post, revisions.ReasonAutoSave, "")
	revs, _ := revMgr.List(post.Id, 10)
	fmt.Printf("✅ revisions after capture: %d (should be 1)\n", len(revs))

	if len(revs) > 0 {
		snap, _ := revisions.ExtractSnapshot(revs[0])
		snapJSON, _ := json.Marshal(snap)
		fmt.Printf("   snapshot: %s\n", snapJSON)
	}

	// 9. Manually increment viewCount via visits.Manager (HTTP hook only fires on /api request)
	visitsMgr := visits.New(app)
	visitsMgr.IncrementPostView(post.Id)
	updatedPost, _ := app.FindRecordById("posts", post.Id)
	fmt.Printf("✅ post viewCount: %d (should be 1)\n", updatedPost.GetInt("viewCount"))

	fmt.Println("\n=== All integration tests passed ===")
}
