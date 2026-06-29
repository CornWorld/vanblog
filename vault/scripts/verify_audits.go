//go:build ignore

// End-to-end verification of vanblog audit hooks (JSVM).
// Boots a real pb instance with jsvm hook loader pointed at pb_hooks/,
// triggers CRUD via Go-layer app.Save (which fires both Go and JS hooks),
// then inspects the `audits` collection to confirm hooks fired.
//
// Run: go run scripts/verify_audits.go

package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"

	_ "github.com/cornworld/vanblog/pb_migrations"
)

func check(label string, err error) {
	if err != nil {
		fmt.Printf("  ✗ %s: %v\n", label, err)
		os.Exit(1)
	}
	fmt.Printf("  ✓ %s\n", label)
}

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-audit")
	defer os.RemoveAll(tmpDir)

	hooksDir, _ := filepath.Abs("./pb_hooks")

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		fmt.Printf("Bootstrap: %v\n", err)
		os.Exit(1)
	}
	if err := app.RunAppMigrations(); err != nil {
		fmt.Printf("Migration: %v\n", err)
		os.Exit(1)
	}

	// Register jsvm — this loads pb_hooks/*.pb.js and binds Go-layer
	// OnRecord* events to JS callbacks. Without this, audits stay empty.
	jsvm.MustRegister(app, jsvm.Config{
		HooksDir:    hooksDir,
		HooksWatch:  false,
		HooksPoolSize: 5,
	})

	// jsvm.MustRegister → registerHooks() → hooksBinds() + loads pb_hooks/*.pb.js
	// synchronously (it does NOT wait for OnServe). So by the time MustRegister
	// returns, the JS hooks are already bound to app.OnRecord* — no need to
	// trigger OnServe manually.

	fmt.Println("=== vanblog audit hook verification ===\n")

	// Sanity: audits collection exists.
	auditsCol, err := app.FindCollectionByNameOrId("audits")
	if err != nil {
		fmt.Printf("audits collection missing: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("  ✓ audits collection present (id=%s)\n", auditsCol.Id)

	// Trigger: create user, tag, category, post (each should produce one
	// audit entry). These go through app.Save, which fires Go-layer hooks;
	// jsvm's hook binds run inside the same Go-layer hook chain.
	usersCol, _ := app.FindCollectionByNameOrId("users")
	admin := core.NewRecord(usersCol)
	admin.Set("username", "admin")
	admin.Set("email", "admin@example.com")
	admin.Set("password", "password12345678")
	admin.Set("passwordConfirm", "password12345678")
	admin.Set("role", "admin")
	check("create admin user", app.Save(admin))

	tagsCol, _ := app.FindCollectionByNameOrId("tags")
	tag := core.NewRecord(tagsCol)
	tag.Set("name", "Go")
	check("create tag", app.Save(tag))

	catsCol, _ := app.FindCollectionByNameOrId("categories")
	cat := core.NewRecord(catsCol)
	cat.Set("name", "Tech")
	cat.Set("type", "category")
	check("create category", app.Save(cat))

	postsCol, _ := app.FindCollectionByNameOrId("posts")
	post := core.NewRecord(postsCol)
	post.Set("title", "Hello")
	post.Set("content", "first post")
	post.Set("status", "published")
	post.Set("category", cat.Id)
	post.Set("tags", []string{tag.Id})
	post.Set("author", admin.Id)
	check("create post", app.Save(post))

	// Re-load the post so it gets marked as not-new (PostScan → MarkAsNotNew).
	// Without this, the second Save() below would still go through the create
	// path because pb 0.39 leaves the in-memory record's IsNew flag set
	// after the initial insert.
	post2, err := app.FindRecordById(postsCol, post.Id)
	if err != nil || post2 == nil {
		fmt.Printf("reload post: %v\n", err)
		os.Exit(1)
	}

	// Update post
	post2.Set("title", "Hello (edited)")
	check("update post", app.Save(post2))

	// Hard delete (exercises onRecordAfterDeleteSuccess). Soft-delete
	// (deleted=true) goes through update path, not delete, so it would
	// produce a post.update audit row, not a post.delete one.
	check("hard delete post", app.Delete(post2))

	// Inspect audits
	audits, _ := app.FindRecordsByFilter("audits", "1=1", "-created", 100, 0)
	fmt.Printf("\n  audits collected: %d\n", len(audits))
	for i, a := range audits {
		fmt.Printf("    [%d] action=%s target=%s result=%s actor=%q\n",
			i, a.GetString("action"), a.GetString("target"),
			a.GetString("result"), a.GetString("actor"))
	}

	expected := map[string]bool{
		"tag.create":     false,
		"category.create": false,
		"post.create":    false,
		"post.update":    false,
		"post.delete":    false,
	}
	for _, a := range audits {
		k := a.GetString("action")
		if _, ok := expected[k]; ok {
			expected[k] = true
		}
	}

	fmt.Println()
	allPassed := true
	for k, found := range expected {
		mark := "✗"
		if found {
			mark = "✓"
		} else {
			allPassed = false
		}
		fmt.Printf("  %s %s\n", mark, k)
	}

	if !allPassed {
		fmt.Println("\nFAILED: some audit actions missing")
		os.Exit(1)
	}
	fmt.Println("\nAll expected audit actions fired.")
}
